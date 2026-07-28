// allow: SIZE_OK - one contiguous descriptor-relative protocol keeps every openat transition auditable.
#if defined(__APPLE__)
#define _DARWIN_C_SOURCE
#endif
#define _POSIX_C_SOURCE 200809L

#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <poll.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#include "ph_native_project_read.h"

extern char **environ;

#ifndef O_DIRECTORY
#define O_DIRECTORY 0
#endif

#ifndef O_CLOEXEC
#define O_CLOEXEC 0
#endif

#ifndef O_NOFOLLOW
#if defined(__APPLE__)
#define O_NOFOLLOW 0x00000100
#else
#define O_NOFOLLOW 0x00020000
#endif
#endif

enum ph_status {
  PH_READY = 0,
  PH_ABSENT = 1,
  PH_UNSAFE = 2,
  PH_LIMIT = 3,
  PH_IO = 4,
  PH_INVALID = 5,
};

enum ph_entry_kind {
  PH_DIRECTORY = 1,
  PH_FILE = 2,
};

enum {
  PH_FIXED_GIT_MAX_OUTPUT = 4 * 1024 * 1024,
  PH_FIXED_GIT_TIMEOUT_MS = 5000,
  PH_FIXED_GRADLE_MAX_STREAM_OUTPUT = 1024 * 1024,
  PH_FIXED_GRADLE_MAX_TOTAL_OUTPUT = 2 * 1024 * 1024,
};

enum ph_command_outcome {
  PH_COMMAND_PASSED = 0,
  PH_COMMAND_FAILED = 1,
  PH_COMMAND_SIGNAL = 2,
  PH_COMMAND_TIMEOUT = 3,
  PH_COMMAND_OUTPUT_LIMIT = 4,
};

typedef struct {
  unsigned char *bytes;
  size_t capacity;
  size_t length;
} ph_buffer;

typedef struct {
  ph_buffer error_output;
  int killed;
  enum ph_command_outcome outcome;
  int signal;
  int status;
  ph_buffer standard_output;
  int timed_out;
} ph_command_result;

typedef struct {
  unsigned char *bytes;
  size_t length;
  char *path;
  unsigned char kind;
  struct stat stat;
} ph_tree_entry;

typedef struct {
  dev_t dev;
  int enabled;
  ino_t ino;
  int opened;
} ph_audit;

typedef struct {
  dev_t parent_dev;
  int enabled;
  int parent_fd;
  ino_t parent_ino;
  int root_fd;
  const char *root_name;
} ph_root_context;

typedef struct {
  uint64_t ctime_ns;
  dev_t dev;
  ino_t ino;
  unsigned char kind;
  uint64_t mode;
  uint64_t mtime_ns;
  char *path;
  uint64_t size;
  int content_bound;
} ph_expected_identity;

typedef struct {
  int enabled;
  int root_only;
  ph_expected_identity *values;
  size_t count;
} ph_expectations;

typedef struct {
  ph_audit *audit;
  const ph_expectations *expectations;
  char **exclusions;
  size_t exclusion_count;
  ph_tree_entry *entries;
  size_t entry_capacity;
  size_t entry_count;
  size_t max_entries;
  size_t max_file_bytes;
  size_t max_total_bytes;
  size_t total_bytes;
  enum ph_status status;
} ph_tree;

static int append_bytes(ph_buffer *buffer, const void *bytes, size_t length) {
  if (length > SIZE_MAX - buffer->length) return 0;
  size_t required = buffer->length + length;
  if (required > buffer->capacity) {
    size_t capacity = buffer->capacity == 0 ? 256 : buffer->capacity;
    while (capacity < required) {
      if (capacity > SIZE_MAX / 2) return 0;
      capacity *= 2;
    }
    unsigned char *next = realloc(buffer->bytes, capacity);
    if (next == NULL) return 0;
    buffer->bytes = next;
    buffer->capacity = capacity;
  }
  if (length > 0) memcpy(buffer->bytes + buffer->length, bytes, length);
  buffer->length += length;
  return 1;
}

static int append_u8(ph_buffer *buffer, uint8_t value) {
  return append_bytes(buffer, &value, sizeof(value));
}

static int append_u16(ph_buffer *buffer, uint16_t value) {
  unsigned char bytes[2] = {
    (unsigned char)(value & 0xffu),
    (unsigned char)((value >> 8u) & 0xffu),
  };
  return append_bytes(buffer, bytes, sizeof(bytes));
}

static int append_u32(ph_buffer *buffer, uint32_t value) {
  unsigned char bytes[4] = {
    (unsigned char)(value & 0xffu),
    (unsigned char)((value >> 8u) & 0xffu),
    (unsigned char)((value >> 16u) & 0xffu),
    (unsigned char)((value >> 24u) & 0xffu),
  };
  return append_bytes(buffer, bytes, sizeof(bytes));
}

static int append_u64(ph_buffer *buffer, uint64_t value) {
  unsigned char bytes[8];
  for (size_t index = 0; index < sizeof(bytes); index += 1) {
    bytes[index] = (unsigned char)((value >> (index * 8u)) & 0xffu);
  }
  return append_bytes(buffer, bytes, sizeof(bytes));
}

static uint64_t stat_mtime_ns(const struct stat *stat) {
#if defined(__APPLE__)
  return ((uint64_t)stat->st_mtimespec.tv_sec * 1000000000ull) + (uint64_t)stat->st_mtimespec.tv_nsec;
#else
  return ((uint64_t)stat->st_mtim.tv_sec * 1000000000ull) + (uint64_t)stat->st_mtim.tv_nsec;
#endif
}

static uint64_t stat_ctime_ns(const struct stat *stat) {
#if defined(__APPLE__)
  return ((uint64_t)stat->st_ctimespec.tv_sec * 1000000000ull) + (uint64_t)stat->st_ctimespec.tv_nsec;
#else
  return ((uint64_t)stat->st_ctim.tv_sec * 1000000000ull) + (uint64_t)stat->st_ctim.tv_nsec;
#endif
}

static int append_identity(ph_buffer *buffer, const struct stat *stat) {
  return append_u64(buffer, (uint64_t)stat->st_dev)
    && append_u64(buffer, (uint64_t)stat->st_ino)
    && append_u64(buffer, (uint64_t)stat->st_mode)
    && append_u64(buffer, (uint64_t)stat->st_size)
    && append_u64(buffer, stat_mtime_ns(stat))
    && append_u64(buffer, stat_ctime_ns(stat));
}

static int write_all(const unsigned char *bytes, size_t length) {
  size_t written = 0;
  while (written < length) {
    ssize_t result = write(STDOUT_FILENO, bytes + written, length - written);
    if (result <= 0) return 0;
    written += (size_t)result;
  }
  return 1;
}

static int emit_status(enum ph_status status) {
  unsigned char byte = (unsigned char)status;
  return write_all(&byte, sizeof(byte));
}

static int same_location(const struct stat *left, const struct stat *right) {
  return left->st_dev == right->st_dev
    && left->st_ino == right->st_ino
    && (left->st_mode & S_IFMT) == (right->st_mode & S_IFMT);
}

static int same_file_identity(const struct stat *left, const struct stat *right) {
  return same_location(left, right)
    && left->st_mode == right->st_mode
    && left->st_size == right->st_size
    && stat_mtime_ns(left) == stat_mtime_ns(right)
    && stat_ctime_ns(left) == stat_ctime_ns(right);
}

static int expected_kind_matches(unsigned char kind, const struct stat *stat) {
  return (kind == PH_DIRECTORY && S_ISDIR(stat->st_mode))
    || (kind == PH_FILE && S_ISREG(stat->st_mode));
}

static const ph_expected_identity *expected_identity_for(
  const ph_expectations *expectations,
  const char *path
) {
  if (expectations == NULL || !expectations->enabled) return NULL;
  for (size_t index = 0; index < expectations->count; index += 1) {
    if (strcmp(expectations->values[index].path, path) == 0) return &expectations->values[index];
  }
  return NULL;
}

static int expected_identity_matches(
  const ph_expectations *expectations,
  const char *path,
  const struct stat *stat
) {
  if (expectations == NULL || !expectations->enabled) return 1;
  const ph_expected_identity *expected = expected_identity_for(expectations, path);
  if (expected == NULL && expectations->root_only) return 1;
  return expected != NULL
    && expected->dev == stat->st_dev
    && expected->ino == stat->st_ino
    && expected_kind_matches(expected->kind, stat)
    && (
      expected->kind != PH_FILE
      || !expected->content_bound
      || (
        stat->st_size >= 0
        && expected->mode == (uint64_t)(stat->st_mode & 07777)
        && expected->size == (uint64_t)stat->st_size
        && expected->mtime_ns == stat_mtime_ns(stat)
        && expected->ctime_ns == stat_ctime_ns(stat)
      )
    );
}

static void free_expectations(ph_expectations *expectations) {
  if (expectations == NULL) return;
  for (size_t index = 0; index < expectations->count; index += 1) {
    free(expectations->values[index].path);
  }
  free(expectations->values);
  *expectations = (ph_expectations){0};
}

static int audit_descriptor(ph_audit *audit, int descriptor) {
  if (audit == NULL || !audit->enabled) return 1;
  struct stat stat;
  if (fstat(descriptor, &stat) != 0) return 0;
  if (stat.st_dev == audit->dev && stat.st_ino == audit->ino) audit->opened = 1;
  return 1;
}

static enum ph_status errno_status(void) {
  return errno == ENOENT ? PH_ABSENT : PH_UNSAFE;
}

static int valid_segment(const char *segment, size_t length) {
  if (length == 0 || length > 255) return 0;
  if ((length == 1 && segment[0] == '.') || (length == 2 && segment[0] == '.' && segment[1] == '.')) return 0;
  for (size_t index = 0; index < length; index += 1) {
    if (segment[index] == '/' || segment[index] == '\0' || segment[index] == '\\') return 0;
  }
  return 1;
}

static int valid_relative_path(const char *path, int allow_root) {
  if (allow_root && strcmp(path, ".") == 0) return 1;
  if (path == NULL || path[0] == '\0' || path[0] == '/') return 0;
  const char *start = path;
  for (const char *cursor = path;; cursor += 1) {
    if (*cursor == '/' || *cursor == '\0') {
      if (!valid_segment(start, (size_t)(cursor - start))) return 0;
      if (*cursor == '\0') return 1;
      start = cursor + 1;
    }
  }
}

static enum ph_status open_child_directory(
  int parent,
  const char *name,
  const char *relative_path,
  int *child,
  struct stat *child_stat,
  ph_audit *audit,
  const ph_expectations *expectations
) {
  struct stat before;
  if (fstatat(parent, name, &before, AT_SYMLINK_NOFOLLOW) != 0) return errno_status();
  if (!S_ISDIR(before.st_mode) || !expected_identity_matches(expectations, relative_path, &before)) {
    return PH_UNSAFE;
  }
  int descriptor = openat(parent, name, O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW);
  if (descriptor < 0) return errno_status();
  struct stat opened;
  struct stat after;
  if (fstat(descriptor, &opened) != 0 || !audit_descriptor(audit, descriptor)
    || fstatat(parent, name, &after, AT_SYMLINK_NOFOLLOW) != 0
    || !S_ISDIR(opened.st_mode) || !same_location(&before, &opened) || !same_location(&opened, &after)
    || !expected_identity_matches(expectations, relative_path, &opened)
    || !expected_identity_matches(expectations, relative_path, &after)) {
    close(descriptor);
    return PH_UNSAFE;
  }
  *child = descriptor;
  *child_stat = opened;
  return PH_READY;
}

static int open_root(
  const char *relative,
  struct stat *stat,
  ph_audit *audit,
  const ph_expectations *expectations,
  const ph_root_context *context
) {
  if (!valid_relative_path(relative, 1)) return -1;
  if (context != NULL && context->enabled) {
    if (context->root_fd != 3 || context->parent_fd != 4
      || !valid_segment(context->root_name, strlen(context->root_name))) return -1;
    int root = fcntl(context->root_fd, F_DUPFD_CLOEXEC, 5);
    int parent = fcntl(context->parent_fd, F_DUPFD_CLOEXEC, 5);
    if (root < 0 || parent < 0) {
      if (root >= 0) close(root);
      if (parent >= 0) close(parent);
      return -1;
    }
    struct stat root_stat;
    struct stat parent_stat;
    struct stat named;
    int valid = fstat(root, &root_stat) == 0
      && fstat(parent, &parent_stat) == 0
      && S_ISDIR(root_stat.st_mode)
      && S_ISDIR(parent_stat.st_mode)
      && parent_stat.st_dev == context->parent_dev
      && parent_stat.st_ino == context->parent_ino
      && fstatat(parent, context->root_name, &named, AT_SYMLINK_NOFOLLOW) == 0
      && S_ISDIR(named.st_mode)
      && same_location(&root_stat, &named)
      && (strcmp(relative, ".") != 0 || expected_identity_matches(expectations, ".", &named))
      && audit_descriptor(audit, root);
    close(parent);
    if (!valid) {
      close(root);
      return -1;
    }
    if (strcmp(relative, ".") == 0) {
      if (!expected_identity_matches(expectations, ".", &root_stat)) {
        close(root);
        return -1;
      }
      *stat = root_stat;
      return root;
    }
    int current = root;
    struct stat current_stat = root_stat;
    const char *start = relative;
    char path[1024] = {0};
    size_t path_length = 0;
    for (const char *cursor = relative;; cursor += 1) {
      if (*cursor != '/' && *cursor != '\0') continue;
      size_t length = (size_t)(cursor - start);
      char name[256];
      if (!valid_segment(start, length)) {
        close(current);
        return -1;
      }
      memcpy(name, start, length);
      name[length] = '\0';
      if (path_length > 0) {
        if (path_length + 1 >= sizeof(path)) {
          close(current);
          return -1;
        }
        path[path_length] = '/';
        path_length += 1;
      }
      if (path_length + length >= sizeof(path)) {
        close(current);
        return -1;
      }
      memcpy(path + path_length, name, length);
      path_length += length;
      path[path_length] = '\0';
      int next = -1;
      struct stat next_stat;
      const char *expected_path = *cursor == '\0' ? "." : path;
      enum ph_status status = open_child_directory(
        current,
        name,
        expected_path,
        &next,
        &next_stat,
        audit,
        expectations
      );
      close(current);
      if (status != PH_READY) return -1;
      current = next;
      current_stat = next_stat;
      if (*cursor == '\0') break;
      start = cursor + 1;
    }
    *stat = current_stat;
    return current;
  }
  if (strcmp(relative, ".") != 0 && expected_identity_for(expectations, ".") == NULL) {
    return -1;
  }
  int current = open(".", O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW);
  if (current < 0) return -1;
  struct stat current_stat;
  if (fstat(current, &current_stat) != 0 || !S_ISDIR(current_stat.st_mode) || !audit_descriptor(audit, current)) {
    close(current);
    return -1;
  }
  if (strcmp(relative, ".") == 0) {
    if (!expected_identity_matches(expectations, ".", &current_stat)) {
      close(current);
      return -1;
    }
    *stat = current_stat;
    return current;
  }

  const char *start = relative;
  char path[1024] = {0};
  size_t path_length = 0;
  const char *separator = strchr(relative, '/');
  size_t direct_child_length = separator == NULL ? strlen(relative) : (size_t)(separator - relative);
  int direct_child = 0;
  if (
    expectations != NULL
    && expectations->enabled
    && expected_identity_for(expectations, ".") != NULL
    && direct_child_length > 0
    && direct_child_length < 256
  ) {
    char selected[256];
    memcpy(selected, relative, direct_child_length);
    selected[direct_child_length] = '\0';
    direct_child = valid_segment(selected, direct_child_length)
      && expected_identity_for(expectations, selected) == NULL;
  }
  for (const char *cursor = relative;; cursor += 1) {
    if (*cursor != '/' && *cursor != '\0') continue;
    size_t length = (size_t)(cursor - start);
    char name[256];
    if (!valid_segment(start, length)) {
      close(current);
      return -1;
    }
    memcpy(name, start, length);
    name[length] = '\0';
    if (path_length > 0) {
      if (path_length + 1 >= sizeof(path)) {
        close(current);
        return -1;
      }
      path[path_length] = '/';
      path_length += 1;
    }
    if (path_length + length >= sizeof(path)) {
      close(current);
      return -1;
    }
    memcpy(path + path_length, name, length);
    path_length += length;
    path[path_length] = '\0';
    int next = -1;
    struct stat next_stat;
    const char *expected_path = path;
    if (direct_child) {
      expected_path = path_length == direct_child_length ? "." : path + direct_child_length + 1;
    } else {
      const ph_expected_identity *named_expected = expected_identity_for(expectations, path);
      if (*cursor == '\0' && named_expected == NULL) expected_path = ".";
    }
    enum ph_status status = open_child_directory(
      current,
      name,
      expected_path,
      &next,
      &next_stat,
      audit,
      expected_path == NULL ? NULL : expectations
    );
    close(current);
    if (status != PH_READY) return -1;
    current = next;
    current_stat = next_stat;
    if (*cursor == '\0') break;
    start = cursor + 1;
  }
  *stat = current_stat;
  return current;
}

static enum ph_status open_directory_relative(
  int root,
  const char *relative,
  int *directory,
  struct stat *directory_stat,
  ph_audit *audit,
  const ph_expectations *expectations
) {
  if (!valid_relative_path(relative, 1)) return PH_INVALID;
  int current = dup(root);
  if (current < 0) return PH_IO;
  struct stat current_stat;
  if (fstat(current, &current_stat) != 0 || !S_ISDIR(current_stat.st_mode)) {
    close(current);
    return PH_IO;
  }
  if (strcmp(relative, ".") == 0) {
    if (!expected_identity_matches(expectations, ".", &current_stat)) {
      close(current);
      return PH_UNSAFE;
    }
    *directory = current;
    *directory_stat = current_stat;
    return PH_READY;
  }

  char path[1024] = {0};
  size_t path_length = 0;
  const char *start = relative;
  for (const char *cursor = relative;; cursor += 1) {
    if (*cursor != '/' && *cursor != '\0') continue;
    size_t length = (size_t)(cursor - start);
    char name[256];
    if (!valid_segment(start, length)) {
      close(current);
      return PH_INVALID;
    }
    memcpy(name, start, length);
    name[length] = '\0';
    if (path_length > 0) {
      if (path_length + 1 >= sizeof(path)) {
        close(current);
        return PH_INVALID;
      }
      path[path_length] = '/';
      path_length += 1;
    }
    if (path_length + length >= sizeof(path)) {
      close(current);
      return PH_INVALID;
    }
    memcpy(path + path_length, name, length);
    path_length += length;
    path[path_length] = '\0';
    int next = -1;
    struct stat next_stat;
    enum ph_status status = open_child_directory(current, name, path, &next, &next_stat, audit, expectations);
    close(current);
    if (status != PH_READY) return status;
    current = next;
    current_stat = next_stat;
    if (*cursor == '\0') break;
    start = cursor + 1;
  }
  *directory = current;
  *directory_stat = current_stat;
  return PH_READY;
}

static enum ph_status read_regular_from_parent(
  int parent,
  const char *name,
  const char *relative_path,
  size_t max_bytes,
  unsigned char **bytes,
  size_t *length,
  struct stat *identity,
  ph_audit *audit,
  const ph_expectations *expectations
) {
  struct stat before;
  if (fstatat(parent, name, &before, AT_SYMLINK_NOFOLLOW) != 0) return errno_status();
  if (!S_ISREG(before.st_mode) || !expected_identity_matches(expectations, relative_path, &before)) {
    return PH_UNSAFE;
  }
  if (before.st_size < 0 || (uintmax_t)before.st_size > (uintmax_t)max_bytes) return PH_LIMIT;

  int descriptor = openat(parent, name, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (descriptor < 0) return errno_status();
  struct stat opened;
  struct stat after_open;
  if (fstat(descriptor, &opened) != 0 || !audit_descriptor(audit, descriptor)
    || fstatat(parent, name, &after_open, AT_SYMLINK_NOFOLLOW) != 0
    || !S_ISREG(opened.st_mode) || !same_file_identity(&before, &opened) || !same_file_identity(&opened, &after_open)
    || !expected_identity_matches(expectations, relative_path, &opened)
    || !expected_identity_matches(expectations, relative_path, &after_open)
    || opened.st_size < 0 || (uintmax_t)opened.st_size > (uintmax_t)max_bytes) {
    close(descriptor);
    return PH_UNSAFE;
  }

  size_t expected = (size_t)opened.st_size;
  unsigned char *content = expected == 0 ? NULL : malloc(expected);
  if (expected > 0 && content == NULL) {
    close(descriptor);
    return PH_IO;
  }
  size_t received = 0;
  while (received < expected) {
    ssize_t result = read(descriptor, content + received, expected - received);
    if (result <= 0) {
      free(content);
      close(descriptor);
      return PH_IO;
    }
    received += (size_t)result;
  }

  struct stat after_read;
  struct stat after_path;
  if (fstat(descriptor, &after_read) != 0 || fstatat(parent, name, &after_path, AT_SYMLINK_NOFOLLOW) != 0
    || !same_file_identity(&opened, &after_read) || !same_file_identity(&after_read, &after_path)
    || !expected_identity_matches(expectations, relative_path, &after_read)
    || !expected_identity_matches(expectations, relative_path, &after_path)
  ) {
    free(content);
    close(descriptor);
    return PH_UNSAFE;
  }
  close(descriptor);
  *bytes = content;
  *length = expected;
  *identity = after_read;
  return PH_READY;
}

static enum ph_status capture_regular_identity_from_parent(
  int parent,
  const char *name,
  const char *relative_path,
  struct stat *identity,
  ph_audit *audit,
  const ph_expectations *expectations
) {
  struct stat before;
  if (fstatat(parent, name, &before, AT_SYMLINK_NOFOLLOW) != 0) return errno_status();
  if (!S_ISREG(before.st_mode) || !expected_identity_matches(expectations, relative_path, &before)) {
    return PH_UNSAFE;
  }
  int descriptor = openat(parent, name, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (descriptor < 0) return errno_status();
  struct stat opened;
  struct stat after;
  if (fstat(descriptor, &opened) != 0 || !audit_descriptor(audit, descriptor)
    || fstatat(parent, name, &after, AT_SYMLINK_NOFOLLOW) != 0
    || !S_ISREG(opened.st_mode) || !same_file_identity(&before, &opened) || !same_file_identity(&opened, &after)
    || !expected_identity_matches(expectations, relative_path, &opened)
    || !expected_identity_matches(expectations, relative_path, &after)) {
    close(descriptor);
    return PH_UNSAFE;
  }
  close(descriptor);
  *identity = opened;
  return PH_READY;
}

static enum ph_status read_relative_file(
  int root,
  const char *relative,
  size_t max_bytes,
  unsigned char **bytes,
  size_t *length,
  struct stat *identity,
  ph_audit *audit,
  const ph_expectations *expectations
) {
  if (!valid_relative_path(relative, 0)) return PH_INVALID;
  const char *slash = strrchr(relative, '/');
  const char *leaf = slash == NULL ? relative : slash + 1;
  char *parent_path = NULL;
  if (slash != NULL) {
    size_t parent_length = (size_t)(slash - relative);
    parent_path = malloc(parent_length + 1);
    if (parent_path == NULL) return PH_IO;
    memcpy(parent_path, relative, parent_length);
    parent_path[parent_length] = '\0';
  }
  int parent = -1;
  struct stat parent_stat;
  enum ph_status status = open_directory_relative(
    root,
    parent_path == NULL ? "." : parent_path,
    &parent,
    &parent_stat,
    audit,
    expectations
  );
  free(parent_path);
  if (status != PH_READY) return status;
  status = read_regular_from_parent(parent, leaf, relative, max_bytes, bytes, length, identity, audit, expectations);
  close(parent);
  return status;
}

static int compare_names(const void *left, const void *right) {
  const char *const *a = left;
  const char *const *b = right;
  return strcmp(*a, *b);
}

static void free_names(char **names, size_t count) {
  for (size_t index = 0; index < count; index += 1) free(names[index]);
  free(names);
}

static int read_directory_names(int directory, char ***names_out, size_t *count_out) {
  int copy = dup(directory);
  if (copy < 0) return 0;
  DIR *stream = fdopendir(copy);
  if (stream == NULL) {
    close(copy);
    return 0;
  }
  char **names = NULL;
  size_t capacity = 0;
  size_t count = 0;
  struct dirent *entry;
  while ((entry = readdir(stream)) != NULL) {
    if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) continue;
    size_t length = strlen(entry->d_name);
    if (!valid_segment(entry->d_name, length)) {
      free_names(names, count);
      closedir(stream);
      return 0;
    }
    if (count == capacity) {
      size_t next_capacity = capacity == 0 ? 16 : capacity * 2;
      char **next = realloc(names, next_capacity * sizeof(*next));
      if (next == NULL) {
        free_names(names, count);
        closedir(stream);
        return 0;
      }
      names = next;
      capacity = next_capacity;
    }
    names[count] = strdup(entry->d_name);
    if (names[count] == NULL) {
      free_names(names, count);
      closedir(stream);
      return 0;
    }
    count += 1;
  }
  closedir(stream);
  qsort(names, count, sizeof(*names), compare_names);
  *names_out = names;
  *count_out = count;
  return 1;
}

static char *join_relative(const char *prefix, const char *name) {
  size_t prefix_length = strlen(prefix);
  size_t name_length = strlen(name);
  size_t length = prefix_length == 0 ? name_length : prefix_length + 1 + name_length;
  char *path = malloc(length + 1);
  if (path == NULL) return NULL;
  if (prefix_length == 0) {
    memcpy(path, name, name_length);
  } else {
    memcpy(path, prefix, prefix_length);
    path[prefix_length] = '/';
    memcpy(path + prefix_length + 1, name, name_length);
  }
  path[length] = '\0';
  return path;
}

static int is_excluded(const ph_tree *tree, const char *path) {
  for (size_t index = 0; index < tree->exclusion_count; index += 1) {
    const char *prefix = tree->exclusions[index];
    size_t length = strlen(prefix);
    if (strncmp(path, prefix, length) == 0 && (path[length] == '\0' || path[length] == '/')) return 1;
  }
  return 0;
}

static int add_tree_entry(
  ph_tree *tree,
  unsigned char kind,
  char *path,
  const struct stat *stat,
  unsigned char *bytes,
  size_t length
) {
  if (tree->entry_count >= tree->max_entries) {
    tree->status = PH_LIMIT;
    return 0;
  }
  if (kind == PH_FILE && (length > tree->max_file_bytes || length > tree->max_total_bytes - tree->total_bytes)) {
    tree->status = PH_LIMIT;
    return 0;
  }
  if (tree->entry_count == tree->entry_capacity) {
    size_t capacity = tree->entry_capacity == 0 ? 64 : tree->entry_capacity * 2;
    ph_tree_entry *next = realloc(tree->entries, capacity * sizeof(*next));
    if (next == NULL) {
      tree->status = PH_IO;
      return 0;
    }
    tree->entries = next;
    tree->entry_capacity = capacity;
  }
  tree->entries[tree->entry_count] = (ph_tree_entry){
    .bytes = bytes,
    .kind = kind,
    .length = length,
    .path = path,
    .stat = *stat,
  };
  tree->entry_count += 1;
  if (kind == PH_FILE) tree->total_bytes += length;
  return 1;
}

static void free_tree(ph_tree *tree) {
  for (size_t index = 0; index < tree->entry_count; index += 1) {
    free(tree->entries[index].bytes);
    free(tree->entries[index].path);
  }
  free(tree->entries);
}

static void collect_tree(ph_tree *tree, int directory, const char *prefix) {
  if (tree->status != PH_READY) return;
  char **names = NULL;
  size_t count = 0;
  if (!read_directory_names(directory, &names, &count)) {
    tree->status = PH_IO;
    return;
  }
  for (size_t index = 0; index < count && tree->status == PH_READY; index += 1) {
    const char *name = names[index];
    char *relative = join_relative(prefix, name);
    if (relative == NULL) {
      tree->status = PH_IO;
      break;
    }
    if (is_excluded(tree, relative)) {
      free(relative);
      continue;
    }
    struct stat before;
    if (fstatat(directory, name, &before, AT_SYMLINK_NOFOLLOW) != 0) {
      tree->status = errno_status();
      free(relative);
      break;
    }
    if (S_ISLNK(before.st_mode) || !expected_identity_matches(tree->expectations, relative, &before)) {
      tree->status = PH_UNSAFE;
      free(relative);
      break;
    }
    if (S_ISDIR(before.st_mode)) {
      int child = -1;
      struct stat child_stat;
      enum ph_status status = open_child_directory(
        directory,
        name,
        relative,
        &child,
        &child_stat,
        tree->audit,
        tree->expectations
      );
      if (status != PH_READY) {
        tree->status = status;
        free(relative);
        break;
      }
      if (!add_tree_entry(tree, PH_DIRECTORY, relative, &child_stat, NULL, 0)) {
        close(child);
        free(relative);
        break;
      }
      collect_tree(tree, child, tree->entries[tree->entry_count - 1].path);
      close(child);
      continue;
    }
    if (!S_ISREG(before.st_mode)) {
      tree->status = PH_UNSAFE;
      free(relative);
      break;
    }
    unsigned char *bytes = NULL;
    size_t length = 0;
    struct stat identity;
    enum ph_status status = read_regular_from_parent(
      directory,
      name,
      relative,
      tree->max_file_bytes,
      &bytes,
      &length,
      &identity,
      tree->audit,
      tree->expectations
    );
    if (status != PH_READY) {
      tree->status = status;
      free(relative);
      break;
    }
    if (!add_tree_entry(tree, PH_FILE, relative, &identity, bytes, length)) {
      free(bytes);
      free(relative);
      break;
    }
  }
  free_names(names, count);
}

static void collect_tree_manifest(ph_tree *tree, int directory, const char *prefix) {
  if (tree->status != PH_READY) return;
  char **names = NULL;
  size_t count = 0;
  if (!read_directory_names(directory, &names, &count)) {
    tree->status = PH_IO;
    return;
  }
  for (size_t index = 0; index < count && tree->status == PH_READY; index += 1) {
    const char *name = names[index];
    char *relative = join_relative(prefix, name);
    if (relative == NULL) {
      tree->status = PH_IO;
      break;
    }
    if (is_excluded(tree, relative)) {
      free(relative);
      continue;
    }
    struct stat before;
    if (fstatat(directory, name, &before, AT_SYMLINK_NOFOLLOW) != 0) {
      tree->status = errno_status();
      free(relative);
      break;
    }
    if (S_ISLNK(before.st_mode) || !expected_identity_matches(tree->expectations, relative, &before)) {
      tree->status = PH_UNSAFE;
      free(relative);
      break;
    }
    if (S_ISDIR(before.st_mode)) {
      int child = -1;
      struct stat child_stat;
      enum ph_status status = open_child_directory(
        directory,
        name,
        relative,
        &child,
        &child_stat,
        tree->audit,
        tree->expectations
      );
      if (status != PH_READY) {
        tree->status = status;
        free(relative);
        break;
      }
      if (!add_tree_entry(tree, PH_DIRECTORY, relative, &child_stat, NULL, 0)) {
        close(child);
        free(relative);
        break;
      }
      collect_tree_manifest(tree, child, tree->entries[tree->entry_count - 1].path);
      close(child);
      continue;
    }
    if (!S_ISREG(before.st_mode)) {
      tree->status = PH_UNSAFE;
      free(relative);
      break;
    }
    struct stat identity;
    enum ph_status status = capture_regular_identity_from_parent(
      directory,
      name,
      relative,
      &identity,
      tree->audit,
      tree->expectations
    );
    if (status != PH_READY) {
      tree->status = status;
      free(relative);
      break;
    }
    if (!add_tree_entry(tree, PH_FILE, relative, &identity, NULL, 0)) {
      free(relative);
      break;
    }
  }
  free_names(names, count);
}

static int valid_generated_root(const char *path) {
  return strcmp(path, "build/test-results/test") == 0
    || strcmp(path, "target/surefire-reports") == 0;
}

static enum ph_status capture_generated_root(
  ph_tree *tree,
  int root,
  const char *relative,
  int *selected
) {
  if (!valid_generated_root(relative)) return PH_INVALID;
  int current = dup(root);
  if (current < 0) return PH_IO;
  char path[1024] = {0};
  size_t path_length = 0;
  const char *start = relative;
  for (const char *cursor = relative;; cursor += 1) {
    if (*cursor != '/' && *cursor != '\0') continue;
    size_t length = (size_t)(cursor - start);
    char name[256];
    if (!valid_segment(start, length)) {
      close(current);
      return PH_INVALID;
    }
    memcpy(name, start, length);
    name[length] = '\0';
    if (path_length > 0) {
      if (path_length + 1 >= sizeof(path)) {
        close(current);
        return PH_INVALID;
      }
      path[path_length++] = '/';
    }
    if (path_length + length >= sizeof(path)) {
      close(current);
      return PH_INVALID;
    }
    memcpy(path + path_length, name, length);
    path_length += length;
    path[path_length] = '\0';
    int child = -1;
    struct stat child_stat;
    enum ph_status status = open_child_directory(
      current,
      name,
      path,
      &child,
      &child_stat,
      tree->audit,
      tree->expectations
    );
    close(current);
    if (status != PH_READY) return status;
    char *entry_path = strdup(path);
    if (entry_path == NULL || !add_tree_entry(tree, PH_DIRECTORY, entry_path, &child_stat, NULL, 0)) {
      free(entry_path);
      close(child);
      return tree->status == PH_READY ? PH_IO : tree->status;
    }
    current = child;
    if (*cursor == '\0') break;
    start = cursor + 1;
  }
  *selected = current;
  return PH_READY;
}

static int parse_size(const char *text, size_t *value) {
  if (text == NULL || text[0] == '\0') return 0;
  char *end = NULL;
  errno = 0;
  unsigned long long parsed = strtoull(text, &end, 10);
  if (errno != 0 || end == NULL || *end != '\0' || parsed == 0 || parsed > SIZE_MAX) return 0;
  *value = (size_t)parsed;
  return 1;
}

static int parse_u64(const char *text, uint64_t *value) {
  if (text == NULL || text[0] == '\0') return 0;
  char *end = NULL;
  errno = 0;
  unsigned long long parsed = strtoull(text, &end, 10);
  if (errno != 0 || end == NULL || *end != '\0') return 0;
  *value = (uint64_t)parsed;
  return 1;
}

static int parse_root_audit_suffix(
  int argc,
  char **argv,
  int minimum_count,
  int *body_count,
  const char **root,
  ph_audit *audit,
  ph_root_context *context
) {
  *audit = (ph_audit){0};
  *context = (ph_root_context){0};
  *body_count = argc;
  *root = ".";
  if (argc >= minimum_count + 3 && strcmp(argv[argc - 3], "--audit") == 0) {
    uint64_t dev;
    uint64_t ino;
    if (!parse_u64(argv[argc - 2], &dev) || !parse_u64(argv[argc - 1], &ino)) return 0;
    audit->dev = (dev_t)dev;
    audit->enabled = 1;
    audit->ino = (ino_t)ino;
    *body_count = argc - 3;
  }
  if (*body_count >= minimum_count + 2 && strcmp(argv[*body_count - 2], "--root") == 0) {
    *root = argv[*body_count - 1];
    *body_count -= 2;
  }
  if (*body_count >= minimum_count + 6 && strcmp(argv[*body_count - 6], "--root-fds") == 0) {
    uint64_t parent_dev;
    uint64_t parent_ino;
    uint64_t parent_fd;
    uint64_t root_fd;
    const char *name = argv[*body_count - 3];
    if (!parse_u64(argv[*body_count - 5], &root_fd)
      || !parse_u64(argv[*body_count - 4], &parent_fd)
      || !parse_u64(argv[*body_count - 2], &parent_dev)
      || !parse_u64(argv[*body_count - 1], &parent_ino)
      || root_fd != 3 || parent_fd != 4 || !valid_segment(name, strlen(name))) return 0;
    context->enabled = 1;
    context->root_fd = (int)root_fd;
    context->parent_fd = (int)parent_fd;
    context->root_name = name;
    context->parent_dev = (dev_t)parent_dev;
    context->parent_ino = (ino_t)parent_ino;
    *body_count -= 6;
  }
  if (*body_count < minimum_count || !valid_relative_path(*root, 1)) return 0;
  return 1;
}

static int parse_expected_arguments(
  int start,
  int end,
  char **argv,
  ph_expectations *expectations
) {
  *expectations = (ph_expectations){0};
  if (start == end) return 1;
  if (start > end || (end - start) % 5 != 0) return 0;
  size_t count = (size_t)((end - start) / 5);
  if (count == 0 || count > 20000) return 0;
  ph_expected_identity *values = calloc(count, sizeof(*values));
  if (values == NULL) return 0;
  for (size_t index = 0; index < count; index += 1) {
    int offset = start + (int)(index * 5);
    if (strcmp(argv[offset], "--expect") != 0 || !valid_relative_path(argv[offset + 1], 1)) {
      free_expectations(&(ph_expectations){ .values = values, .count = count });
      return 0;
    }
    unsigned char kind;
    if (strcmp(argv[offset + 2], "d") == 0) {
      kind = PH_DIRECTORY;
    } else if (strcmp(argv[offset + 2], "f") == 0) {
      kind = PH_FILE;
    } else {
      free_expectations(&(ph_expectations){ .values = values, .count = count });
      return 0;
    }
    uint64_t dev;
    uint64_t ino;
    if (!parse_u64(argv[offset + 3], &dev) || !parse_u64(argv[offset + 4], &ino)) {
      free_expectations(&(ph_expectations){ .values = values, .count = count });
      return 0;
    }
    values[index].path = strdup(argv[offset + 1]);
    if (values[index].path == NULL) {
      free_expectations(&(ph_expectations){ .values = values, .count = count });
      return 0;
    }
    values[index].dev = (dev_t)dev;
    values[index].ino = (ino_t)ino;
    values[index].kind = kind;
    for (size_t prior = 0; prior < index; prior += 1) {
      if (strcmp(values[prior].path, values[index].path) == 0) {
        free_expectations(&(ph_expectations){ .values = values, .count = count });
        return 0;
      }
    }
  }
  *expectations = (ph_expectations){ .enabled = 1, .values = values, .count = count };
  return 1;
}

static int read_stdin_exact(unsigned char *bytes, size_t length) {
  size_t received = 0;
  while (received < length) {
    ssize_t result = read(STDIN_FILENO, bytes + received, length - received);
    if (result <= 0) return 0;
    received += (size_t)result;
  }
  return 1;
}

static int read_u16_stdin(uint16_t *value) {
  unsigned char bytes[2];
  if (!read_stdin_exact(bytes, sizeof(bytes))) return 0;
  *value = (uint16_t)bytes[0] | ((uint16_t)bytes[1] << 8u);
  return 1;
}

static int read_u32_stdin(uint32_t *value) {
  unsigned char bytes[4];
  if (!read_stdin_exact(bytes, sizeof(bytes))) return 0;
  *value = (uint32_t)bytes[0]
    | ((uint32_t)bytes[1] << 8u)
    | ((uint32_t)bytes[2] << 16u)
    | ((uint32_t)bytes[3] << 24u);
  return 1;
}

static int read_u64_stdin(uint64_t *value) {
  unsigned char bytes[8];
  if (!read_stdin_exact(bytes, sizeof(bytes))) return 0;
  uint64_t parsed = 0;
  for (size_t index = 0; index < sizeof(bytes); index += 1) {
    parsed |= ((uint64_t)bytes[index]) << (index * 8u);
  }
  *value = parsed;
  return 1;
}

static int parse_expected_stdin(ph_expectations *expectations) {
  *expectations = (ph_expectations){0};
  uint32_t count32;
  if (!read_u32_stdin(&count32) || count32 == 0 || count32 > 20000) return 0;
  size_t count = (size_t)count32;
  ph_expected_identity *values = calloc(count, sizeof(*values));
  if (values == NULL) return 0;
  for (size_t index = 0; index < count; index += 1) {
    uint16_t path_length;
    if (!read_u16_stdin(&path_length) || path_length == 0 || path_length > 1024) {
      free_expectations(&(ph_expectations){ .values = values, .count = count });
      return 0;
    }
    char *path = malloc((size_t)path_length + 1);
    if (path == NULL || !read_stdin_exact((unsigned char *)path, path_length)) {
      free(path);
      free_expectations(&(ph_expectations){ .values = values, .count = count });
      return 0;
    }
    path[path_length] = '\0';
    unsigned char kind;
    uint64_t dev;
    uint64_t ino;
    uint64_t mode;
    uint64_t size;
    uint64_t mtime_ns;
    uint64_t ctime_ns;
    if (!read_stdin_exact(&kind, sizeof(kind))
      || (kind != PH_DIRECTORY && kind != PH_FILE)
      || !read_u64_stdin(&dev)
      || !read_u64_stdin(&ino)
      || !read_u64_stdin(&mode)
      || !read_u64_stdin(&size)
      || !read_u64_stdin(&mtime_ns)
      || !read_u64_stdin(&ctime_ns)
      || !valid_relative_path(path, 1)) {
      free(path);
      free_expectations(&(ph_expectations){ .values = values, .count = count });
      return 0;
    }
    values[index] = (ph_expected_identity){
      .dev = (dev_t)dev,
      .ino = (ino_t)ino,
      .kind = kind,
      .mode = mode,
      .size = size,
      .mtime_ns = mtime_ns,
      .ctime_ns = ctime_ns,
      .content_bound = 1,
      .path = path,
    };
    for (size_t prior = 0; prior < index; prior += 1) {
      if (strcmp(values[prior].path, path) == 0) {
        free_expectations(&(ph_expectations){ .values = values, .count = count });
        return 0;
      }
    }
  }
  unsigned char trailing;
  if (read(STDIN_FILENO, &trailing, sizeof(trailing)) != 0) {
    free_expectations(&(ph_expectations){ .values = values, .count = count });
    return 0;
  }
  *expectations = (ph_expectations){ .enabled = 1, .values = values, .count = count };
  return 1;
}

static int parse_expectation_input(
  int start,
  int end,
  char **argv,
  ph_expectations *expectations
) {
  if (end - start == 1 && strcmp(argv[start], "--expect-stdin") == 0) {
    return parse_expected_stdin(expectations);
  }
  return parse_expected_arguments(start, end, argv, expectations);
}

static int monotonic_milliseconds(uint64_t *value) {
  struct timespec time;
  if (clock_gettime(CLOCK_MONOTONIC, &time) != 0) return 0;
  *value = ((uint64_t)time.tv_sec * 1000ull) + ((uint64_t)time.tv_nsec / 1000000ull);
  return 1;
}

static void terminate_process_group(pid_t child) {
  if (kill(-child, SIGTERM) != 0) kill(child, SIGTERM);
  struct timespec pause = { .tv_sec = 0, .tv_nsec = 100000000 };
  nanosleep(&pause, NULL);
  if (kill(-child, 0) == 0 || errno == EPERM) {
    if (kill(-child, SIGKILL) != 0) kill(child, SIGKILL);
  }
  int status;
  while (waitpid(child, &status, 0) < 0 && errno == EINTR) {}
}

static int fixed_git_arguments(const char *command, char *argv[16]) {
  size_t index = 0;
  argv[index++] = "/usr/bin/git";
  argv[index++] = "--no-optional-locks";
  argv[index++] = "-c";
  argv[index++] = "core.filemode=true";
  argv[index++] = "-c";
  argv[index++] = "core.fsmonitor=false";
  argv[index++] = "-c";
  argv[index++] = "core.untrackedCache=false";
  if (strcmp(command, "prefix") == 0) {
    argv[index++] = "rev-parse";
    argv[index++] = "--show-prefix";
  } else if (strcmp(command, "head") == 0) {
    argv[index++] = "rev-parse";
    argv[index++] = "--verify";
    argv[index++] = "HEAD^{commit}";
  } else if (strcmp(command, "status") == 0) {
    argv[index++] = "status";
    argv[index++] = "--porcelain=v1";
    argv[index++] = "-z";
    argv[index++] = "--untracked-files=all";
  } else if (strcmp(command, "index") == 0) {
    argv[index++] = "ls-files";
    argv[index++] = "--stage";
    argv[index++] = "-z";
  } else {
    return 0;
  }
  argv[index] = NULL;
  return 1;
}

static enum ph_status run_fixed_git(int root, const char *command, ph_buffer *output) {
  char *argv[16];
  if (!fixed_git_arguments(command, argv)) return PH_INVALID;
  int pipefd[2];
  if (pipe(pipefd) != 0) return PH_IO;
  pid_t child = fork();
  if (child < 0) {
    close(pipefd[0]);
    close(pipefd[1]);
    return PH_IO;
  }
  if (child == 0) {
    static char *const environment[] = {
      "GIT_CONFIG_GLOBAL=/dev/null",
      "GIT_CONFIG_NOSYSTEM=1",
      "GIT_CONFIG_SYSTEM=/dev/null",
      "GIT_OPTIONAL_LOCKS=0",
      "GIT_PAGER=cat",
      "GIT_TERMINAL_PROMPT=0",
      "LANG=C",
      "LC_ALL=C",
      "PATH=/usr/bin",
      NULL,
    };
    setpgid(0, 0);
    close(pipefd[0]);
    int nullfd = open("/dev/null", O_WRONLY | O_CLOEXEC);
    if (nullfd < 0 || fchdir(root) != 0 || dup2(pipefd[1], STDOUT_FILENO) < 0 || dup2(nullfd, STDERR_FILENO) < 0) _exit(127);
    close(root);
    close(pipefd[1]);
    close(nullfd);
    execve(argv[0], argv, environment);
    _exit(127);
  }
  close(pipefd[1]);
  int flags = fcntl(pipefd[0], F_GETFL);
  if (flags < 0 || fcntl(pipefd[0], F_SETFL, flags | O_NONBLOCK) != 0) {
    close(pipefd[0]);
    terminate_process_group(child);
    return PH_IO;
  }
  uint64_t started;
  if (!monotonic_milliseconds(&started)) {
    close(pipefd[0]);
    terminate_process_group(child);
    return PH_IO;
  }
  int child_done = 0;
  int pipe_closed = 0;
  int child_status = 1;
  while (!child_done || !pipe_closed) {
    struct pollfd descriptor = { .fd = pipefd[0], .events = POLLIN, .revents = 0 };
    int polled = poll(&descriptor, 1, 50);
    if (polled < 0 && errno != EINTR) {
      close(pipefd[0]);
      terminate_process_group(child);
      return PH_IO;
    }
    if (polled > 0 && (descriptor.revents & (POLLIN | POLLHUP)) != 0) {
      for (;;) {
        unsigned char bytes[8192];
        ssize_t received = read(pipefd[0], bytes, sizeof(bytes));
        if (received > 0) {
          if (output->length > PH_FIXED_GIT_MAX_OUTPUT - (size_t)received || !append_bytes(output, bytes, (size_t)received)) {
            close(pipefd[0]);
            terminate_process_group(child);
            return PH_LIMIT;
          }
          continue;
        }
        if (received == 0) pipe_closed = 1;
        if (received < 0 && errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR) {
          close(pipefd[0]);
          terminate_process_group(child);
          return PH_IO;
        }
        break;
      }
    }
    if (!child_done) {
      pid_t waited = waitpid(child, &child_status, WNOHANG);
      if (waited == child) child_done = 1;
      if (waited < 0 && errno != EINTR) {
        close(pipefd[0]);
        return PH_IO;
      }
    }
    uint64_t now;
    if (!monotonic_milliseconds(&now) || now - started > PH_FIXED_GIT_TIMEOUT_MS) {
      close(pipefd[0]);
      terminate_process_group(child);
      return PH_IO;
    }
  }
  close(pipefd[0]);
  if (!WIFEXITED(child_status) || WEXITSTATUS(child_status) != 0) return PH_IO;
  return PH_READY;
}

static enum ph_status open_fixed_gradle_wrapper(
  int root,
  const ph_expectations *expectations,
  int *wrapper_descriptor
) {
  struct stat before;
  if (fstatat(root, "gradlew", &before, AT_SYMLINK_NOFOLLOW) != 0) return errno_status();
  if (!S_ISREG(before.st_mode)
    || (before.st_mode & 0111) == 0
    || !expected_identity_matches(expectations, "gradlew", &before)) {
    return PH_UNSAFE;
  }
  int descriptor = openat(root, "gradlew", O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (descriptor < 0) return errno_status();
  struct stat opened;
  struct stat after;
  unsigned char prefix[10];
  if (fstat(descriptor, &opened) != 0
    || fstatat(root, "gradlew", &after, AT_SYMLINK_NOFOLLOW) != 0
    || !S_ISREG(opened.st_mode)
    || (opened.st_mode & 0111) == 0
    || !same_file_identity(&before, &opened)
    || !same_file_identity(&opened, &after)
    || !expected_identity_matches(expectations, "gradlew", &opened)
    || !expected_identity_matches(expectations, "gradlew", &after)
    || pread(descriptor, prefix, sizeof(prefix), 0) != (ssize_t)sizeof(prefix)
    || memcmp(prefix, "#!/bin/sh\n", sizeof(prefix)) != 0) {
    close(descriptor);
    return PH_UNSAFE;
  }
  *wrapper_descriptor = descriptor;
  return PH_READY;
}

static int fixed_gradle_arguments(const char *command, char *argv[20]) {
  size_t index = 0;
  argv[index++] = "./gradlew";
  argv[index++] = "-s";
  argv[index++] = "--";
  argv[index++] = "--no-daemon";
  argv[index++] = "--no-build-cache";
  if (strcmp(command, "test") == 0) {
    argv[index++] = "cleanTest";
    argv[index++] = "test";
  } else if (strcmp(command, "build") == 0) {
    argv[index++] = "build";
  } else {
    return 0;
  }
  argv[index++] = "--console=plain";
  argv[index] = NULL;
  return 1;
}

static int set_nonblocking(int descriptor) {
  int flags = fcntl(descriptor, F_GETFL);
  return flags >= 0 && fcntl(descriptor, F_SETFL, flags | O_NONBLOCK) == 0;
}

static void close_descriptor(int *descriptor) {
  if (*descriptor < 0) return;
  close(*descriptor);
  *descriptor = -1;
}

static int consume_command_output(
  int *descriptor,
  ph_buffer *capture,
  size_t other_bytes,
  int *open
) {
  for (;;) {
    unsigned char bytes[8192];
    ssize_t received = read(*descriptor, bytes, sizeof(bytes));
    if (received > 0) {
      size_t length = (size_t)received;
      if (capture->length > PH_FIXED_GRADLE_MAX_STREAM_OUTPUT - length
        || other_bytes > PH_FIXED_GRADLE_MAX_TOTAL_OUTPUT - capture->length - length
        || !append_bytes(capture, bytes, length)) {
        return -1;
      }
      continue;
    }
    if (received == 0) {
      close_descriptor(descriptor);
      *open = 0;
      return 1;
    }
    if (errno == EINTR) continue;
    if (errno == EAGAIN || errno == EWOULDBLOCK) return 1;
    return 0;
  }
}

static enum ph_status run_fixed_gradle(
  int root,
  const char *command,
  uint64_t timeout_ms,
  const ph_expectations *expectations,
  ph_command_result *result
) {
  char *argv[20];
  if (!fixed_gradle_arguments(command, argv) || timeout_ms == 0 || timeout_ms > 120000) return PH_INVALID;
  int wrapper_descriptor = -1;
  enum ph_status wrapper = open_fixed_gradle_wrapper(root, expectations, &wrapper_descriptor);
  if (wrapper != PH_READY) return wrapper;
  int stdout_pipe[2] = { -1, -1 };
  int stderr_pipe[2] = { -1, -1 };
  if (pipe(stdout_pipe) != 0 || pipe(stderr_pipe) != 0) {
    close_descriptor(&wrapper_descriptor);
    close_descriptor(&stdout_pipe[0]);
    close_descriptor(&stdout_pipe[1]);
    close_descriptor(&stderr_pipe[0]);
    close_descriptor(&stderr_pipe[1]);
    return PH_IO;
  }
  pid_t child = fork();
  if (child < 0) {
    close_descriptor(&wrapper_descriptor);
    close_descriptor(&stdout_pipe[0]);
    close_descriptor(&stdout_pipe[1]);
    close_descriptor(&stderr_pipe[0]);
    close_descriptor(&stderr_pipe[1]);
    return PH_IO;
  }
  if (child == 0) {
    setpgid(0, 0);
    close_descriptor(&stdout_pipe[0]);
    close_descriptor(&stderr_pipe[0]);
    if (fchdir(root) != 0
      || lseek(wrapper_descriptor, 0, SEEK_SET) < 0
      || dup2(wrapper_descriptor, STDIN_FILENO) < 0
      || dup2(stdout_pipe[1], STDOUT_FILENO) < 0
      || dup2(stderr_pipe[1], STDERR_FILENO) < 0) {
      _exit(127);
    }
    close_descriptor(&wrapper_descriptor);
    close_descriptor(&stdout_pipe[1]);
    close_descriptor(&stderr_pipe[1]);
    execve("/bin/sh", argv, environ);
    _exit(127);
  }
  close_descriptor(&wrapper_descriptor);
  close_descriptor(&stdout_pipe[1]);
  close_descriptor(&stderr_pipe[1]);
  if (!set_nonblocking(stdout_pipe[0]) || !set_nonblocking(stderr_pipe[0])) {
    close_descriptor(&stdout_pipe[0]);
    close_descriptor(&stderr_pipe[0]);
    terminate_process_group(child);
    return PH_IO;
  }
  uint64_t started;
  if (!monotonic_milliseconds(&started)) {
    close_descriptor(&stdout_pipe[0]);
    close_descriptor(&stderr_pipe[0]);
    terminate_process_group(child);
    return PH_IO;
  }
  int stdout_open = 1;
  int stderr_open = 1;
  int child_done = 0;
  int child_status = 1;
  while (!child_done || stdout_open || stderr_open) {
    struct pollfd descriptors[2];
    nfds_t count = 0;
    if (stdout_open) descriptors[count++] = (struct pollfd){ .fd = stdout_pipe[0], .events = POLLIN, .revents = 0 };
    if (stderr_open) descriptors[count++] = (struct pollfd){ .fd = stderr_pipe[0], .events = POLLIN, .revents = 0 };
    int polled = poll(descriptors, count, 50);
    if (polled < 0 && errno != EINTR) {
      close_descriptor(&stdout_pipe[0]);
      close_descriptor(&stderr_pipe[0]);
      terminate_process_group(child);
      return PH_IO;
    }
    if (polled > 0) {
      for (nfds_t index = 0; index < count; index += 1) {
        if ((descriptors[index].revents & (POLLIN | POLLHUP)) == 0) continue;
        int consumed = descriptors[index].fd == stdout_pipe[0]
          ? consume_command_output(&stdout_pipe[0], &result->standard_output, result->error_output.length, &stdout_open)
          : consume_command_output(&stderr_pipe[0], &result->error_output, result->standard_output.length, &stderr_open);
        if (consumed < 0) {
          close_descriptor(&stdout_pipe[0]);
          close_descriptor(&stderr_pipe[0]);
          terminate_process_group(child);
          result->killed = 1;
          result->outcome = PH_COMMAND_OUTPUT_LIMIT;
          return PH_READY;
        }
        if (consumed == 0) {
          close_descriptor(&stdout_pipe[0]);
          close_descriptor(&stderr_pipe[0]);
          terminate_process_group(child);
          return PH_IO;
        }
      }
    }
    if (!child_done) {
      pid_t waited = waitpid(child, &child_status, WNOHANG);
      if (waited == child) child_done = 1;
      if (waited < 0 && errno != EINTR) {
        close_descriptor(&stdout_pipe[0]);
        close_descriptor(&stderr_pipe[0]);
        terminate_process_group(child);
        return PH_IO;
      }
    }
    uint64_t now;
    if (!monotonic_milliseconds(&now) || now - started > timeout_ms) {
      close_descriptor(&stdout_pipe[0]);
      close_descriptor(&stderr_pipe[0]);
      terminate_process_group(child);
      result->killed = 1;
      result->outcome = PH_COMMAND_TIMEOUT;
      result->timed_out = 1;
      return PH_READY;
    }
  }
  if (WIFSIGNALED(child_status)) {
    result->outcome = PH_COMMAND_SIGNAL;
    result->signal = WTERMSIG(child_status);
    result->status = 128 + result->signal;
    return PH_READY;
  }
  result->status = WIFEXITED(child_status) ? WEXITSTATUS(child_status) : 1;
  result->outcome = result->status == 0 ? PH_COMMAND_PASSED : PH_COMMAND_FAILED;
  return PH_READY;
}

static int append_audit(ph_buffer *output, const ph_audit *audit) {
  return audit == NULL ? 1 : append_u8(output, audit->opened ? 1u : 0u);
}

static int emit_status_with_audit(enum ph_status status, const ph_audit *audit) {
  if (audit == NULL) return emit_status(status);
  ph_buffer output = {0};
  int ok = append_u8(&output, (uint8_t)status) && append_audit(&output, audit) && write_all(output.bytes, output.length);
  free(output.bytes);
  return ok;
}

static int emit_read(
  enum ph_status status,
  const struct stat *identity,
  const unsigned char *bytes,
  size_t length,
  const ph_audit *audit
) {
  if (status != PH_READY) return emit_status_with_audit(status, audit);
  ph_buffer output = {0};
  int ok = append_u8(&output, PH_READY)
    && append_identity(&output, identity)
    && length <= UINT32_MAX
    && append_u32(&output, (uint32_t)length)
    && append_bytes(&output, bytes, length)
    && append_audit(&output, audit)
    && write_all(output.bytes, output.length);
  free(output.bytes);
  return ok;
}

static int emit_directory(enum ph_status status, const struct stat *identity, const ph_audit *audit) {
  if (status != PH_READY) return emit_status_with_audit(status, audit);
  ph_buffer output = {0};
  int ok = append_u8(&output, PH_READY)
    && append_identity(&output, identity)
    && append_audit(&output, audit)
    && write_all(output.bytes, output.length);
  free(output.bytes);
  return ok;
}

static int emit_git(enum ph_status status, const ph_buffer *output, const ph_audit *audit) {
  if (status != PH_READY) return emit_status_with_audit(status, audit);
  if (output->length > UINT32_MAX) return emit_status_with_audit(PH_LIMIT, audit);
  ph_buffer response = {0};
  int ok = append_u8(&response, PH_READY)
    && append_u32(&response, (uint32_t)output->length)
    && append_bytes(&response, output->bytes, output->length)
    && append_audit(&response, audit)
    && write_all(response.bytes, response.length);
  free(response.bytes);
  return ok;
}

static int emit_command(enum ph_status status, const ph_command_result *command, const ph_audit *audit) {
  if (status != PH_READY) return emit_status_with_audit(status, audit);
  if (command->standard_output.length > UINT32_MAX || command->error_output.length > UINT32_MAX) {
    return emit_status_with_audit(PH_LIMIT, audit);
  }
  ph_buffer response = {0};
  int ok = append_u8(&response, PH_READY)
    && append_u8(&response, (uint8_t)command->outcome)
    && append_u32(&response, (uint32_t)command->status)
    && append_u32(&response, (uint32_t)command->signal)
    && append_u8(&response, command->timed_out ? 1u : 0u)
    && append_u8(&response, command->killed ? 1u : 0u)
    && append_u32(&response, (uint32_t)command->standard_output.length)
    && append_bytes(&response, command->standard_output.bytes, command->standard_output.length)
    && append_u32(&response, (uint32_t)command->error_output.length)
    && append_bytes(&response, command->error_output.bytes, command->error_output.length)
    && append_audit(&response, audit)
    && write_all(response.bytes, response.length);
  free(response.bytes);
  return ok;
}

static int emit_tree(ph_tree *tree) {
  if (tree->status != PH_READY) return emit_status_with_audit(tree->status, tree->audit);
  if (tree->entry_count > UINT32_MAX) return emit_status_with_audit(PH_LIMIT, tree->audit);
  ph_buffer output = {0};
  int ok = append_u8(&output, PH_READY) && append_u32(&output, (uint32_t)tree->entry_count);
  for (size_t index = 0; ok && index < tree->entry_count; index += 1) {
    const ph_tree_entry *entry = &tree->entries[index];
    size_t path_length = strlen(entry->path);
    ok = path_length <= UINT16_MAX
      && entry->length <= UINT32_MAX
      && append_u8(&output, entry->kind)
      && append_u16(&output, (uint16_t)path_length)
      && append_bytes(&output, entry->path, path_length)
      && append_identity(&output, &entry->stat)
      && append_u32(&output, (uint32_t)entry->length)
      && append_bytes(&output, entry->bytes, entry->length);
  }
  if (ok) ok = append_audit(&output, tree->audit);
  if (ok) ok = write_all(output.bytes, output.length);
  free(output.bytes);
  return ok;
}

static int run_read(int argc, char **argv) {
  int body_count;
  const char *root_relative;
  ph_audit audit;
  ph_root_context root_context;
  if (!parse_root_audit_suffix(argc, argv, 4, &body_count, &root_relative, &audit, &root_context)) return emit_status(PH_INVALID) ? 0 : 1;
  ph_expectations expectations;
  if (!parse_expectation_input(4, body_count, argv, &expectations)) return emit_status(PH_INVALID) ? 0 : 1;
  const ph_audit *audit_result = audit.enabled ? &audit : NULL;
  const char *relative = argv[2];
  const char *max_text = argv[3];
  size_t max_bytes;
  if (!parse_size(max_text, &max_bytes) || !valid_relative_path(relative, 0)) {
    free_expectations(&expectations);
    return emit_status(PH_INVALID) ? 0 : 1;
  }
  struct stat root_stat;
  int root = open_root(root_relative, &root_stat, &audit, &expectations, &root_context);
  if (root < 0) {
    free_expectations(&expectations);
    return emit_status_with_audit(PH_UNSAFE, audit_result) ? 0 : 1;
  }
  unsigned char *bytes = NULL;
  size_t length = 0;
  struct stat identity;
  enum ph_status status = read_relative_file(root, relative, max_bytes, &bytes, &length, &identity, &audit, &expectations);
  close(root);
  int result = emit_read(status, &identity, bytes, length, audit_result) ? 0 : 1;
  free(bytes);
  free_expectations(&expectations);
  return result;
}

static int run_directory(int argc, char **argv) {
  int body_count;
  const char *root_relative;
  ph_audit audit;
  ph_root_context root_context;
  if (!parse_root_audit_suffix(argc, argv, 3, &body_count, &root_relative, &audit, &root_context)) return emit_status(PH_INVALID) ? 0 : 1;
  ph_expectations expectations;
  if (!parse_expectation_input(3, body_count, argv, &expectations)) return emit_status(PH_INVALID) ? 0 : 1;
  const ph_audit *audit_result = audit.enabled ? &audit : NULL;
  const char *relative = argv[2];
  if (!valid_relative_path(relative, 1)) {
    free_expectations(&expectations);
    return emit_status(PH_INVALID) ? 0 : 1;
  }
  struct stat root_stat;
  int root = open_root(root_relative, &root_stat, &audit, &expectations, &root_context);
  if (root < 0) {
    free_expectations(&expectations);
    return emit_status_with_audit(PH_UNSAFE, audit_result) ? 0 : 1;
  }
  int directory = -1;
  struct stat identity;
  enum ph_status status = open_directory_relative(root, relative, &directory, &identity, &audit, &expectations);
  close(root);
  if (directory >= 0) close(directory);
  int result = emit_directory(status, &identity, audit_result) ? 0 : 1;
  free_expectations(&expectations);
  return result;
}

static int run_capture_root(int argc, char **argv) {
  if (argc != 3 || !valid_segment(argv[2], strlen(argv[2]))) return emit_status(PH_INVALID) ? 0 : 1;
  int parent = open(".", O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW);
  if (parent < 0) return emit_status(errno_status()) ? 0 : 1;
  struct stat parent_stat;
  int child = -1;
  struct stat identity;
  enum ph_status status = fstat(parent, &parent_stat) != 0 || !S_ISDIR(parent_stat.st_mode)
    ? PH_UNSAFE
    : open_child_directory(parent, argv[2], ".", &child, &identity, NULL, NULL);
  close(parent);
  if (child >= 0) close(child);
  return emit_directory(status, &identity, NULL) ? 0 : 1;
}

static int run_tree(int argc, char **argv) {
  if (argc < 5) return emit_status(PH_INVALID) ? 0 : 1;
  int body_count;
  const char *root_relative;
  ph_audit audit;
  ph_root_context root_context;
  if (!parse_root_audit_suffix(argc, argv, 5, &body_count, &root_relative, &audit, &root_context) || body_count < 5) return emit_status(PH_INVALID) ? 0 : 1;
  int expectation_start = 5;
  while (
    expectation_start < body_count
    && strcmp(argv[expectation_start], "--expect") != 0
    && strcmp(argv[expectation_start], "--expect-stdin") != 0
  ) {
    expectation_start += 1;
  }
  ph_expectations expectations;
  if (!parse_expectation_input(expectation_start, body_count, argv, &expectations)) {
    return emit_status(PH_INVALID) ? 0 : 1;
  }
  if (
    expectations.count == 1
    && expectations.values[0].kind == PH_DIRECTORY
    && strcmp(expectations.values[0].path, ".") == 0
  ) {
    expectations.root_only = 1;
  }
  ph_tree tree = {
    .audit = audit.enabled ? &audit : NULL,
    .expectations = expectations.enabled ? &expectations : NULL,
    .status = PH_READY,
  };
  if (!parse_size(argv[2], &tree.max_entries) || !parse_size(argv[3], &tree.max_file_bytes) || !parse_size(argv[4], &tree.max_total_bytes)) {
    free_expectations(&expectations);
    return emit_status(PH_INVALID) ? 0 : 1;
  }
  tree.exclusions = expectation_start == 5 ? NULL : &argv[5];
  tree.exclusion_count = expectation_start <= 5 ? 0 : (size_t)(expectation_start - 5);
  for (size_t index = 0; index < tree.exclusion_count; index += 1) {
    if (!valid_relative_path(tree.exclusions[index], 0)) {
      free_expectations(&expectations);
      return emit_status(PH_INVALID) ? 0 : 1;
    }
  }
  struct stat root_stat;
  int root = open_root(root_relative, &root_stat, &audit, tree.expectations, &root_context);
  if (root < 0) {
    free_expectations(&expectations);
    return emit_status_with_audit(PH_UNSAFE, tree.audit) ? 0 : 1;
  }
  collect_tree(&tree, root, "");
  close(root);
  int result = emit_tree(&tree) ? 0 : 1;
  free_tree(&tree);
  free_expectations(&expectations);
  return result;
}

static int run_generated_manifest(int argc, char **argv) {
  if (argc < 3) return emit_status(PH_INVALID) ? 0 : 1;
  int body_count;
  const char *root_relative;
  ph_audit audit;
  ph_root_context root_context;
  if (!parse_root_audit_suffix(argc, argv, 3, &body_count, &root_relative, &audit, &root_context) || body_count < 3) {
    return emit_status(PH_INVALID) ? 0 : 1;
  }
  const char *generated_root = argv[2];
  if (!valid_generated_root(generated_root)) {
    return emit_status(PH_INVALID) ? 0 : 1;
  }
  int expectation_start = 3;
  ph_expectations expectations;
  if (!parse_expectation_input(expectation_start, body_count, argv, &expectations)
    || expectations.count != 1
    || expectations.values[0].kind != PH_DIRECTORY
    || strcmp(expectations.values[0].path, ".") != 0) {
    free_expectations(&expectations);
    return emit_status(PH_INVALID) ? 0 : 1;
  }
  expectations.root_only = 1;
  ph_tree tree = {
    .audit = audit.enabled ? &audit : NULL,
    .expectations = &expectations,
    .max_entries = 4096,
    .max_file_bytes = 1,
    .max_total_bytes = 1,
    .status = PH_READY,
  };
  struct stat root_stat;
  int root = open_root(root_relative, &root_stat, &audit, tree.expectations, &root_context);
  if (root < 0) {
    free_expectations(&expectations);
    return emit_status_with_audit(PH_UNSAFE, tree.audit) ? 0 : 1;
  }
  int selected = -1;
  enum ph_status status = capture_generated_root(&tree, root, generated_root, &selected);
  close(root);
  if (status != PH_READY) {
    tree.status = status;
  } else {
    collect_tree_manifest(&tree, selected, generated_root);
  }
  if (selected >= 0) close(selected);
  int result = emit_tree(&tree) ? 0 : 1;
  free_tree(&tree);
  free_expectations(&expectations);
  return result;
}

static int run_generated_tree(int argc, char **argv) {
  if (argc < 6) return emit_status(PH_INVALID) ? 0 : 1;
  int body_count;
  const char *root_relative;
  ph_audit audit;
  ph_root_context root_context;
  if (!parse_root_audit_suffix(argc, argv, 6, &body_count, &root_relative, &audit, &root_context) || body_count < 6) {
    return emit_status(PH_INVALID) ? 0 : 1;
  }
  const char *generated_root = argv[2];
  if (!valid_generated_root(generated_root)) return emit_status(PH_INVALID) ? 0 : 1;
  ph_expectations expectations;
  if (!parse_expectation_input(6, body_count, argv, &expectations)) {
    return emit_status(PH_INVALID) ? 0 : 1;
  }
  const ph_expected_identity *project = expected_identity_for(&expectations, ".");
  if (project == NULL || project->kind != PH_DIRECTORY) {
    free_expectations(&expectations);
    return emit_status(PH_INVALID) ? 0 : 1;
  }
  ph_tree tree = {
    .audit = audit.enabled ? &audit : NULL,
    .expectations = &expectations,
    .max_entries = 0,
    .max_file_bytes = 0,
    .max_total_bytes = 0,
    .status = PH_READY,
  };
  if (!parse_size(argv[3], &tree.max_entries)
    || !parse_size(argv[4], &tree.max_file_bytes)
    || !parse_size(argv[5], &tree.max_total_bytes)) {
    free_expectations(&expectations);
    return emit_status(PH_INVALID) ? 0 : 1;
  }
  struct stat root_stat;
  int root = open_root(root_relative, &root_stat, &audit, tree.expectations, &root_context);
  if (root < 0) {
    free_expectations(&expectations);
    return emit_status_with_audit(PH_UNSAFE, tree.audit) ? 0 : 1;
  }
  int selected = -1;
  enum ph_status status = capture_generated_root(&tree, root, generated_root, &selected);
  close(root);
  if (status != PH_READY) {
    tree.status = status;
  } else {
    collect_tree(&tree, selected, generated_root);
  }
  if (selected >= 0) close(selected);
  int result = emit_tree(&tree) ? 0 : 1;
  free_tree(&tree);
  free_expectations(&expectations);
  return result;
}

static int run_git(int argc, char **argv) {
  int body_count;
  const char *root_relative;
  ph_audit audit;
  ph_root_context root_context;
  if (!parse_root_audit_suffix(argc, argv, 3, &body_count, &root_relative, &audit, &root_context)) {
    return emit_status(PH_INVALID) ? 0 : 1;
  }
  ph_expectations expectations;
  if (!parse_expectation_input(3, body_count, argv, &expectations)) return emit_status(PH_INVALID) ? 0 : 1;
  const ph_audit *audit_result = audit.enabled ? &audit : NULL;
  struct stat root_stat;
  int root = open_root(root_relative, &root_stat, &audit, &expectations, &root_context);
  if (root < 0) {
    free_expectations(&expectations);
    return emit_status_with_audit(PH_UNSAFE, audit_result) ? 0 : 1;
  }
  ph_buffer output = {0};
  enum ph_status status = run_fixed_git(root, argv[2], &output);
  close(root);
  int result = emit_git(status, &output, audit_result) ? 0 : 1;
  free(output.bytes);
  free_expectations(&expectations);
  return result;
}

static int run_gradle(int argc, char **argv) {
  int body_count;
  const char *root_relative;
  ph_audit audit;
  ph_root_context root_context;
  if (!parse_root_audit_suffix(argc, argv, 4, &body_count, &root_relative, &audit, &root_context)) {
    return emit_status(PH_INVALID) ? 0 : 1;
  }
  ph_expectations expectations;
  if (!parse_expectation_input(4, body_count, argv, &expectations)) return emit_status(PH_INVALID) ? 0 : 1;
  const ph_audit *audit_result = audit.enabled ? &audit : NULL;
  uint64_t timeout_ms;
  if (!parse_u64(argv[3], &timeout_ms)) {
    free_expectations(&expectations);
    return emit_status_with_audit(PH_INVALID, audit_result) ? 0 : 1;
  }
  struct stat root_stat;
  int root = open_root(root_relative, &root_stat, &audit, &expectations, &root_context);
  if (root < 0) {
    free_expectations(&expectations);
    return emit_status_with_audit(PH_UNSAFE, audit_result) ? 0 : 1;
  }
  ph_command_result result = {0};
  enum ph_status status = run_fixed_gradle(root, argv[2], timeout_ms, &expectations, &result);
  close(root);
  int emitted = emit_command(status, &result, audit_result);
  free(result.standard_output.bytes);
  free(result.error_output.bytes);
  free_expectations(&expectations);
  return emitted ? 0 : 1;
}

int ph_native_project_read_main(int argc, char **argv) {
  if (argc == 2 && strcmp(argv[1], "self-test") == 0) {
    static const unsigned char response[] = "ph-native-project-read.1\n";
    return write_all(response, sizeof(response) - 1) ? 0 : 1;
  }
  if (argc >= 4 && strcmp(argv[1], "read") == 0) return run_read(argc, argv);
  if (argc == 3 && strcmp(argv[1], "capture-root") == 0) return run_capture_root(argc, argv);
  if (argc >= 3 && strcmp(argv[1], "directory") == 0) return run_directory(argc, argv);
  if (argc >= 5 && strcmp(argv[1], "tree") == 0) return run_tree(argc, argv);
  if (argc >= 3 && strcmp(argv[1], "generated-manifest") == 0) return run_generated_manifest(argc, argv);
  if (argc >= 6 && strcmp(argv[1], "generated-tree") == 0) return run_generated_tree(argc, argv);
  if (argc >= 3 && strcmp(argv[1], "git") == 0) return run_git(argc, argv);
  if (argc >= 4 && strcmp(argv[1], "gradle") == 0) return run_gradle(argc, argv);
  return emit_status(PH_INVALID) ? 0 : 1;
}

#if !defined(PH_NATIVE_PROJECT_READ_ADDON)
int main(int argc, char **argv) {
  return ph_native_project_read_main(argc, argv);
}
#endif
