#define _POSIX_C_SOURCE 200809L

#include <errno.h>
#include <stdbool.h>
#include <fcntl.h>
#include <node_api.h>
#include <poll.h>
#include <signal.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#include "ph_native_project_read.h"

extern char **environ;

enum {
  PH_ADDON_MAX_ARGUMENTS = 128,
  PH_ADDON_MAX_ARGUMENT_BYTES = 4096,
  PH_ADDON_MAX_ENVIRONMENT = 8,
  PH_ADDON_MAX_ENVIRONMENT_BYTES = 16384,
  PH_ADDON_MAX_INPUT = 4 * 1024 * 1024,
  PH_ADDON_MAX_OUTPUT = 96 * 1024 * 1024,
  PH_ADDON_MAX_TIMEOUT_MS = 130000,
  PH_ADDON_TERMINATION_GRACE_MS = 5000,
};

typedef struct {
  unsigned char *bytes;
  size_t length;
  size_t capacity;
} ph_addon_buffer;

static napi_value throw_runtime(napi_env env) {
  napi_throw_error(env, NULL, "source-read-runtime-unavailable");
  return NULL;
}

static int monotonic_milliseconds(uint64_t *value) {
  struct timespec current;
  if (clock_gettime(CLOCK_MONOTONIC, &current) != 0 || current.tv_sec < 0) return 0;
  *value = ((uint64_t)current.tv_sec * 1000ull) + ((uint64_t)current.tv_nsec / 1000000ull);
  return 1;
}

static int append_output(ph_addon_buffer *buffer, const unsigned char *bytes, size_t length, size_t limit) {
  if (length > limit - buffer->length) return 0;
  size_t required = buffer->length + length;
  if (required > buffer->capacity) {
    size_t capacity = buffer->capacity == 0 ? 8192 : buffer->capacity;
    while (capacity < required) {
      if (capacity > limit / 2) {
        capacity = limit;
        break;
      }
      capacity *= 2;
    }
    unsigned char *next = realloc(buffer->bytes, capacity);
    if (next == NULL) return 0;
    buffer->bytes = next;
    buffer->capacity = capacity;
  }
  memcpy(buffer->bytes + buffer->length, bytes, length);
  buffer->length += length;
  return 1;
}

static int write_exact(int descriptor, const unsigned char *bytes, size_t length) {
  size_t offset = 0;
  while (offset < length) {
    ssize_t written = write(descriptor, bytes + offset, length - offset);
    if (written > 0) {
      offset += (size_t)written;
      continue;
    }
    if (written < 0 && errno == EINTR) continue;
    return 0;
  }
  return 1;
}

static void wait_for_exit(pid_t child) {
  uint64_t started;
  if (!monotonic_milliseconds(&started)) started = 0;
  for (;;) {
    pid_t waited = waitpid(child, NULL, WNOHANG);
    if (waited < 0 && errno != EINTR && errno != ECHILD) break;
    if (kill(-child, 0) != 0 && errno != EPERM) return;
    uint64_t now;
    if (!monotonic_milliseconds(&now) || (started != 0 && now - started >= PH_ADDON_TERMINATION_GRACE_MS)) break;
    struct timespec pause = { .tv_sec = 0, .tv_nsec = 10000000 };
    nanosleep(&pause, NULL);
  }
  if (kill(-child, SIGKILL) != 0) kill(child, SIGKILL);
  while (waitpid(child, NULL, 0) < 0 && errno == EINTR) {}
}

static void terminate_child(pid_t child) {
  if (kill(-child, SIGTERM) != 0) kill(child, SIGTERM);
  wait_for_exit(child);
}

static int set_nonblocking(int descriptor) {
  int flags = fcntl(descriptor, F_GETFL);
  return flags >= 0 && fcntl(descriptor, F_SETFL, flags | O_NONBLOCK) == 0;
}

static char *read_string(napi_env env, napi_value value, size_t max_bytes) {
  napi_valuetype type;
  size_t length;
  if (napi_typeof(env, value, &type) != napi_ok || type != napi_string
    || napi_get_value_string_utf8(env, value, NULL, 0, &length) != napi_ok
    || length == 0 || length > max_bytes) {
    return NULL;
  }
  char *text = malloc(length + 1);
  if (text == NULL
    || napi_get_value_string_utf8(env, value, text, length + 1, &length) != napi_ok
    || memchr(text, '\0', length) != NULL) {
    free(text);
    return NULL;
  }
  return text;
}

static void free_strings(char **values, size_t count) {
  if (values == NULL) return;
  for (size_t index = 0; index < count; index += 1) free(values[index]);
  free(values);
}

static int read_string_array(
  napi_env env,
  napi_value value,
  size_t max_count,
  size_t max_bytes,
  int allow_empty,
  char ***values_out,
  size_t *count_out
) {
  bool is_array;
  uint32_t length;
  if (napi_is_array(env, value, &is_array) != napi_ok || !is_array
    || napi_get_array_length(env, value, &length) != napi_ok
    || (!allow_empty && length == 0) || length > max_count) {
    return 0;
  }
  char **values = calloc((size_t)length + 1, sizeof(*values));
  if (values == NULL) return 0;
  for (uint32_t index = 0; index < length; index += 1) {
    napi_value element;
    if (napi_get_element(env, value, index, &element) != napi_ok
      || (values[index] = read_string(env, element, max_bytes)) == NULL) {
      free_strings(values, index);
      return 0;
    }
  }
  *values_out = values;
  *count_out = (size_t)length;
  return 1;
}

static int read_optional_buffer(
  napi_env env,
  napi_value value,
  const unsigned char **bytes,
  size_t *length
) {
  napi_valuetype type;
  bool is_buffer;
  if (napi_typeof(env, value, &type) != napi_ok) return 0;
  if (type == napi_null || type == napi_undefined) {
    *bytes = NULL;
    *length = 0;
    return 1;
  }
  if (napi_is_buffer(env, value, &is_buffer) != napi_ok || !is_buffer
    || napi_get_buffer_info(env, value, (void **)bytes, length) != napi_ok
    || *length > PH_ADDON_MAX_INPUT) {
    return 0;
  }
  return 1;
}

static int read_int32(napi_env env, napi_value value, int32_t *output) {
  napi_valuetype type;
  return napi_typeof(env, value, &type) == napi_ok
    && type == napi_number
    && napi_get_value_int32(env, value, output) == napi_ok;
}

static int environment_allowed(const char *value) {
  static const char *const names[] = { "HOME=", "JAVA_HOME=", "PATH=", "TMPDIR=" };
  for (size_t index = 0; index < sizeof(names) / sizeof(names[0]); index += 1) {
    if (strncmp(value, names[index], strlen(names[index])) == 0) return 1;
  }
  return 0;
}

static int configure_environment(char **environment, size_t count) {
  char **next = calloc(count + 1, sizeof(*next));
  if (next == NULL) return 0;
  for (size_t index = 0; index < count; index += 1) {
    if (!environment_allowed(environment[index])) {
      free(next);
      return 0;
    }
    next[index] = environment[index];
  }
  environ = next;
  return 1;
}

static int child_main(
  char **arguments,
  size_t argument_count,
  char **environment,
  size_t environment_count,
  int input_descriptor,
  int output_descriptor,
  int root_descriptor,
  int parent_descriptor
) {
  setpgid(0, 0);
  if (dup2(input_descriptor, STDIN_FILENO) < 0
    || dup2(output_descriptor, STDOUT_FILENO) < 0) {
    return 127;
  }
  int null_descriptor = open("/dev/null", O_WRONLY | O_CLOEXEC);
  if (null_descriptor < 0 || dup2(null_descriptor, STDERR_FILENO) < 0) return 127;
  close(null_descriptor);
  if (root_descriptor >= 0 && parent_descriptor >= 0) {
    int root_copy = fcntl(root_descriptor, F_DUPFD_CLOEXEC, 10);
    int parent_copy = fcntl(parent_descriptor, F_DUPFD_CLOEXEC, 10);
    if (root_copy < 0 || parent_copy < 0
      || dup2(root_copy, 3) < 0 || dup2(parent_copy, 4) < 0) {
      return 127;
    }
    close(root_copy);
    close(parent_copy);
  }
  if (!configure_environment(environment, environment_count)) return 127;
  return ph_native_project_read_main((int)argument_count, arguments);
}

static int collect_child(
  pid_t child,
  int output_descriptor,
  size_t max_output,
  uint64_t timeout_ms,
  ph_addon_buffer *output,
  int *child_reaped,
  int *pipe_open_after
) {
  *child_reaped = 0;
  *pipe_open_after = 1;
  if (!set_nonblocking(output_descriptor)) return 0;
  uint64_t started;
  if (!monotonic_milliseconds(&started)) return 0;
  int pipe_open = 1;
  int child_done = 0;
  int child_status = 1;
  while (!child_done || pipe_open) {
    struct pollfd descriptor = { .fd = output_descriptor, .events = POLLIN, .revents = 0 };
    int polled = poll(&descriptor, 1, 50);
    if (polled < 0 && errno != EINTR) return 0;
    if (polled > 0 && (descriptor.revents & (POLLIN | POLLHUP)) != 0) {
      for (;;) {
        unsigned char bytes[8192];
        ssize_t received = read(output_descriptor, bytes, sizeof(bytes));
        if (received > 0) {
          if (!append_output(output, bytes, (size_t)received, max_output)) {
            *pipe_open_after = pipe_open;
            return 0;
          }
          continue;
        }
        if (received == 0) pipe_open = 0;
        if (received < 0 && errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR) {
          *pipe_open_after = pipe_open;
          return 0;
        }
        break;
      }
    }
    if (!child_done) {
      pid_t waited = waitpid(child, &child_status, WNOHANG);
      if (waited == child) {
        child_done = 1;
        *child_reaped = 1;
      }
      if (waited < 0 && errno != EINTR) {
        *pipe_open_after = pipe_open;
        return 0;
      }
    }
    uint64_t now;
    if (!monotonic_milliseconds(&now) || now - started > timeout_ms) {
      *pipe_open_after = pipe_open;
      return 0;
    }
  }
  *pipe_open_after = pipe_open;
  return WIFEXITED(child_status) && WEXITSTATUS(child_status) == 0;
}

static napi_value run(napi_env env, napi_callback_info info) {
  size_t argument_length = 7;
  napi_value values[7];
  if (napi_get_cb_info(env, info, &argument_length, values, NULL, NULL) != napi_ok || argument_length != 7) {
    return throw_runtime(env);
  }
  char **arguments = NULL;
  char **environment = NULL;
  size_t argument_count = 0;
  size_t environment_count = 0;
  const unsigned char *input = NULL;
  size_t input_length = 0;
  int32_t max_output;
  int32_t timeout_ms;
  int32_t root_descriptor;
  int32_t parent_descriptor;
  if (!read_string_array(env, values[0], PH_ADDON_MAX_ARGUMENTS, PH_ADDON_MAX_ARGUMENT_BYTES, 0, &arguments, &argument_count)
    || !read_optional_buffer(env, values[1], &input, &input_length)
    || !read_string_array(env, values[2], PH_ADDON_MAX_ENVIRONMENT, PH_ADDON_MAX_ENVIRONMENT_BYTES, 1, &environment, &environment_count)
    || !read_int32(env, values[3], &max_output) || max_output <= 0 || max_output > PH_ADDON_MAX_OUTPUT
    || !read_int32(env, values[4], &timeout_ms) || timeout_ms <= 0 || timeout_ms > PH_ADDON_MAX_TIMEOUT_MS
    || !read_int32(env, values[5], &root_descriptor)
    || !read_int32(env, values[6], &parent_descriptor)
    || ((root_descriptor < 0) != (parent_descriptor < 0))) {
    free_strings(arguments, argument_count);
    free_strings(environment, environment_count);
    return throw_runtime(env);
  }

  int input_pipe[2] = { -1, -1 };
  int output_pipe[2] = { -1, -1 };
  ph_addon_buffer output = {0};
  napi_value response = NULL;
  if (pipe(input_pipe) != 0 || pipe(output_pipe) != 0) goto cleanup;
  pid_t child = fork();
  if (child < 0) goto cleanup;
  if (child == 0) {
    close(input_pipe[1]);
    close(output_pipe[0]);
    int status = child_main(
      arguments,
      argument_count,
      environment,
      environment_count,
      input_pipe[0],
      output_pipe[1],
      root_descriptor,
      parent_descriptor
    );
    _exit(status);
  }
  setpgid(child, child);
  close(input_pipe[0]);
  input_pipe[0] = -1;
  close(output_pipe[1]);
  output_pipe[1] = -1;
  if (!write_exact(input_pipe[1], input, input_length)) {
    terminate_child(child);
    goto cleanup;
  }
  close(input_pipe[1]);
  input_pipe[1] = -1;
  int child_reaped = 0;
  int pipe_open_after = 1;
  if (!collect_child(
    child,
    output_pipe[0],
    (size_t)max_output,
    (uint64_t)timeout_ms,
    &output,
    &child_reaped,
    &pipe_open_after
  )) {
    if (!child_reaped || pipe_open_after) terminate_child(child);
    goto cleanup;
  }
  if (napi_create_buffer_copy(env, output.length, output.bytes, NULL, &response) != napi_ok) response = NULL;

cleanup:
  if (input_pipe[0] >= 0) close(input_pipe[0]);
  if (input_pipe[1] >= 0) close(input_pipe[1]);
  if (output_pipe[0] >= 0) close(output_pipe[0]);
  if (output_pipe[1] >= 0) close(output_pipe[1]);
  free(output.bytes);
  free_strings(arguments, argument_count);
  free_strings(environment, environment_count);
  if (response == NULL) return throw_runtime(env);
  return response;
}

static napi_value initialize(napi_env env, napi_value exports) {
  napi_value function;
  if (napi_create_function(env, "run", NAPI_AUTO_LENGTH, run, NULL, &function) != napi_ok
    || napi_set_named_property(env, exports, "run", function) != napi_ok) {
    return NULL;
  }
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, initialize)
