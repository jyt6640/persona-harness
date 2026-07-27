// allow: SIZE_OK - one contiguous descriptor-relative protocol keeps every openat transition auditable.
#if defined(__APPLE__)
#define _DARWIN_C_SOURCE
#endif
#define _POSIX_C_SOURCE 200809L

#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

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

typedef struct {
  unsigned char *bytes;
  size_t capacity;
  size_t length;
} ph_buffer;

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
  ph_audit *audit;
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

static int open_root(struct stat *stat, ph_audit *audit) {
  int descriptor = open(".", O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW);
  if (descriptor < 0) return -1;
  if (fstat(descriptor, stat) != 0 || !S_ISDIR(stat->st_mode) || !audit_descriptor(audit, descriptor)) {
    close(descriptor);
    return -1;
  }
  return descriptor;
}

static enum ph_status open_child_directory(
  int parent,
  const char *name,
  int *child,
  struct stat *child_stat,
  ph_audit *audit
) {
  struct stat before;
  if (fstatat(parent, name, &before, AT_SYMLINK_NOFOLLOW) != 0) return errno_status();
  if (!S_ISDIR(before.st_mode)) return PH_UNSAFE;
  int descriptor = openat(parent, name, O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW);
  if (descriptor < 0) return errno_status();
  struct stat opened;
  struct stat after;
  if (fstat(descriptor, &opened) != 0 || !audit_descriptor(audit, descriptor)
    || fstatat(parent, name, &after, AT_SYMLINK_NOFOLLOW) != 0
    || !S_ISDIR(opened.st_mode) || !same_location(&before, &opened) || !same_location(&opened, &after)) {
    close(descriptor);
    return PH_UNSAFE;
  }
  *child = descriptor;
  *child_stat = opened;
  return PH_READY;
}

static enum ph_status open_directory_relative(
  int root,
  const char *relative,
  int *directory,
  struct stat *directory_stat,
  ph_audit *audit
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
    *directory = current;
    *directory_stat = current_stat;
    return PH_READY;
  }

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
    int next = -1;
    struct stat next_stat;
    enum ph_status status = open_child_directory(current, name, &next, &next_stat, audit);
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
  size_t max_bytes,
  unsigned char **bytes,
  size_t *length,
  struct stat *identity,
  ph_audit *audit
) {
  struct stat before;
  if (fstatat(parent, name, &before, AT_SYMLINK_NOFOLLOW) != 0) return errno_status();
  if (!S_ISREG(before.st_mode)) return PH_UNSAFE;
  if (before.st_size < 0 || (uintmax_t)before.st_size > (uintmax_t)max_bytes) return PH_LIMIT;

  int descriptor = openat(parent, name, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (descriptor < 0) return errno_status();
  struct stat opened;
  struct stat after_open;
  if (fstat(descriptor, &opened) != 0 || !audit_descriptor(audit, descriptor)
    || fstatat(parent, name, &after_open, AT_SYMLINK_NOFOLLOW) != 0
    || !S_ISREG(opened.st_mode) || !same_location(&before, &opened) || !same_location(&opened, &after_open)
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
    || !same_location(&opened, &after_read) || !same_location(&after_read, &after_path)
    || after_read.st_size != opened.st_size) {
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

static enum ph_status read_relative_file(
  int root,
  const char *relative,
  size_t max_bytes,
  unsigned char **bytes,
  size_t *length,
  struct stat *identity,
  ph_audit *audit
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
    audit
  );
  free(parent_path);
  if (status != PH_READY) return status;
  status = read_regular_from_parent(parent, leaf, max_bytes, bytes, length, identity, audit);
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
    if (S_ISLNK(before.st_mode)) {
      tree->status = PH_UNSAFE;
      free(relative);
      break;
    }
    if (S_ISDIR(before.st_mode)) {
      int child = -1;
      struct stat child_stat;
      enum ph_status status = open_child_directory(directory, name, &child, &child_stat, tree->audit);
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
      tree->max_file_bytes,
      &bytes,
      &length,
      &identity,
      tree->audit
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

static int parse_audit_suffix(int argc, char **argv, int base_count, ph_audit *audit) {
  *audit = (ph_audit){0};
  if (argc == base_count) return 1;
  if (argc != base_count + 3 || strcmp(argv[base_count], "--audit") != 0) return 0;
  uint64_t dev;
  uint64_t ino;
  if (!parse_u64(argv[base_count + 1], &dev) || !parse_u64(argv[base_count + 2], &ino)) return 0;
  audit->dev = (dev_t)dev;
  audit->enabled = 1;
  audit->ino = (ino_t)ino;
  return 1;
}

static int parse_tree_audit_suffix(int argc, char **argv, int *body_count, ph_audit *audit) {
  *audit = (ph_audit){0};
  *body_count = argc;
  if (argc < 8 || strcmp(argv[argc - 3], "--audit") != 0) return 1;
  uint64_t dev;
  uint64_t ino;
  if (!parse_u64(argv[argc - 2], &dev) || !parse_u64(argv[argc - 1], &ino)) return 0;
  audit->dev = (dev_t)dev;
  audit->enabled = 1;
  audit->ino = (ino_t)ino;
  *body_count = argc - 3;
  return 1;
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
  ph_audit audit;
  if (!parse_audit_suffix(argc, argv, 4, &audit)) return emit_status(PH_INVALID) ? 0 : 1;
  const ph_audit *audit_result = audit.enabled ? &audit : NULL;
  const char *relative = argv[2];
  const char *max_text = argv[3];
  size_t max_bytes;
  if (!parse_size(max_text, &max_bytes) || !valid_relative_path(relative, 0)) return emit_status(PH_INVALID) ? 0 : 1;
  struct stat root_stat;
  int root = open_root(&root_stat, &audit);
  if (root < 0) return emit_status_with_audit(PH_UNSAFE, audit_result) ? 0 : 1;
  unsigned char *bytes = NULL;
  size_t length = 0;
  struct stat identity;
  enum ph_status status = read_relative_file(root, relative, max_bytes, &bytes, &length, &identity, &audit);
  close(root);
  int result = emit_read(status, &identity, bytes, length, audit_result) ? 0 : 1;
  free(bytes);
  return result;
}

static int run_directory(int argc, char **argv) {
  ph_audit audit;
  if (!parse_audit_suffix(argc, argv, 3, &audit)) return emit_status(PH_INVALID) ? 0 : 1;
  const ph_audit *audit_result = audit.enabled ? &audit : NULL;
  const char *relative = argv[2];
  if (!valid_relative_path(relative, 1)) return emit_status(PH_INVALID) ? 0 : 1;
  struct stat root_stat;
  int root = open_root(&root_stat, &audit);
  if (root < 0) return emit_status_with_audit(PH_UNSAFE, audit_result) ? 0 : 1;
  int directory = -1;
  struct stat identity;
  enum ph_status status = open_directory_relative(root, relative, &directory, &identity, &audit);
  close(root);
  if (directory >= 0) close(directory);
  return emit_directory(status, &identity, audit_result) ? 0 : 1;
}

static int run_tree(int argc, char **argv) {
  if (argc < 5) return emit_status(PH_INVALID) ? 0 : 1;
  int body_count;
  ph_audit audit;
  if (!parse_tree_audit_suffix(argc, argv, &body_count, &audit) || body_count < 5) return emit_status(PH_INVALID) ? 0 : 1;
  ph_tree tree = { .audit = audit.enabled ? &audit : NULL, .status = PH_READY };
  if (!parse_size(argv[2], &tree.max_entries) || !parse_size(argv[3], &tree.max_file_bytes) || !parse_size(argv[4], &tree.max_total_bytes)) {
    return emit_status(PH_INVALID) ? 0 : 1;
  }
  tree.exclusions = body_count == 5 ? NULL : &argv[5];
  tree.exclusion_count = body_count <= 5 ? 0 : (size_t)(body_count - 5);
  for (size_t index = 0; index < tree.exclusion_count; index += 1) {
    if (!valid_relative_path(tree.exclusions[index], 0)) return emit_status(PH_INVALID) ? 0 : 1;
  }
  struct stat root_stat;
  int root = open_root(&root_stat, &audit);
  if (root < 0) return emit_status_with_audit(PH_UNSAFE, tree.audit) ? 0 : 1;
  collect_tree(&tree, root, "");
  close(root);
  int result = emit_tree(&tree) ? 0 : 1;
  free_tree(&tree);
  return result;
}

int main(int argc, char **argv) {
  if (argc == 2 && strcmp(argv[1], "self-test") == 0) {
    static const unsigned char response[] = "ph-native-project-read.1\n";
    return write_all(response, sizeof(response) - 1) ? 0 : 1;
  }
  if (argc >= 4 && strcmp(argv[1], "read") == 0) return run_read(argc, argv);
  if (argc >= 3 && strcmp(argv[1], "directory") == 0) return run_directory(argc, argv);
  if (argc >= 5 && strcmp(argv[1], "tree") == 0) return run_tree(argc, argv);
  return emit_status(PH_INVALID) ? 0 : 1;
}
