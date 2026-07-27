# Native Project Read Runtime

`native/project-read` is a package-visible, fixed-policy runtime for source
reads that must not reopen caller-controlled project paths after the public
CLI captures the canonical project directory capability.

## Runtime Contract

The runtime implements descriptor-relative traversal with `openat`-style
operations. It receives held project and parent directory descriptors, checks
the root identity against its parent entry, opens each relative directory or
regular-file segment through the held parent descriptor with no-follow flags,
and verifies the expected device/inode identity before returning bytes.

The product supports the package Node engine range (`^20.17.0 || >=22.9.0`),
including Node 20, 22, and 24. The helper has no Node ABI dependency: the
package contains fixed binaries for `darwin` and `linux`, each on `arm64` and
`x64`. An unsupported platform/architecture, absent binary, malformed
manifest, or source/binary checksum mismatch is the bounded
`source-read-runtime-unavailable` result. There is no pathname, stat-after-open,
or install-time compiler fallback.

## Reproducible Inputs

`manifest.json` binds the C source and each committed binary by SHA-256. The
package has no `install` or `postinstall` build command and performs no runtime
network build. Rebuild the Darwin targets with the platform `clang` compiler
and the Linux musl targets with Zig 0.14.1 using:

```sh
clang -std=c17 -O2 -Wall -Wextra -Werror -arch <arm64|x86_64> \
  native/project-read/ph_native_project_read.c -o <darwin-output>
zig cc -std=c17 -O2 -Wall -Wextra -Werror -target <x86_64|aarch64>-linux-musl \
  -static -s native/project-read/ph_native_project_read.c -o <linux-output>
```

Recompute every manifest digest after rebuilding. The committed C source,
manifest, and four artifacts are the only runtime inputs; test hooks that
observe descriptor opening are source-only and are never exposed by the public
CLI.
