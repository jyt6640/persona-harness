# External Environment Verification

Until 2026-08-05 every measurement in this repository had been taken on one
machine. `scripts/external-environment-verify.sh` exists so that stops being
true, and so anyone can repeat the check rather than take a maintainer's word
for it.

## What it does

It installs a packed tarball into a throwaway project and exercises the surfaces
a consumer actually touches. Repository source is never consulted, so the result
reflects the package rather than the working tree.

```bash
npm pack
bash scripts/external-environment-verify.sh persona-harness-<version>.tgz [work-dir]
```

The optional second argument places the throwaway project somewhere other than
the default temp directory — useful when temp is on a small disk.

Nineteen checks across seven groups:

| Group | Checks |
| --- | --- |
| Environment | Node satisfies the `>=20` engine floor; Java and preinstalled ast-grep recorded |
| Fresh install | tarball installs; `ph --help` runs; `observe` is a public command |
| ast-grep | the optional dependency actually delivered a usable binary |
| Bootstrap | `init` and `bootstrap backend` succeed; templates are English; conventions ship |
| Doctor | ast-grep availability is reported honestly; finish authority reports BLOCKED |
| Java detection | concatenated SQL, Spring field injection, unproxied `@Transactional`, Controller→Repository, and flat-package `@Entity` exposure |
| Adversarial | finish blocks with no evidence, blocks with forged execution evidence, and refuses a forged authority artifact |

The run leaves `report.txt` plus the raw command output in the work directory.

## What it is not

It is a **reproducible procedure**, not an independent audit. Running it does not
establish who ran it. Any audit that requires independence — see #116 — still has
to record the operator separately, and a maintainer running it is a maintainer
self-check.

It also asserts nothing about platforms it has not been run on.

## Recorded runs

### Windows 11, 2026-08-05

Windows 11 build 10.0.26200, Node v22.9.0, npm 11.6.0, Git Bash, x86_64. Packed
tarball of `0.8.0-beta.33`, fresh install, no preinstalled ast-grep.

This was the first time this project had been verified anywhere other than the
development Mac. It found three defects that single-machine measurement could
not surface:

- A skipped ast-grep convention was reported as a violation, fabricating ten
  findings that pointed at `.persona/conventions` rather than at any source file.
- `@ast-grep/cli` installed but was unusable, because `node_modules/.bin` is not
  always on PATH and Node cannot spawn the Windows `.cmd` shim.
- `bootstrap backend` could not succeed at all, because `O_DIRECTORY` and
  `O_NOFOLLOW` do not exist on Windows.

All three are fixed. The suite now reports 19 PASS / 0 FAIL on that host, with
`Workflow directory guard: lstat-verified` stated in doctor.

**This is not a Windows support claim.** One host, one Node version, one manual
run. The support matrix and the README platform table are unchanged, and
`scripts/check-supported-node-matrix.mjs` still refuses a Windows matrix job.
Whether that policy should change is a separate decision that needs its own
evidence.

### Windows 11, 2026-08-08

Same host, Node v22.9.0, npm 11.6.0, Temurin 21 and JDK 25, PowerShell rather
than Git Bash. Packed tarballs of `main`, plus published tarballs from the
registry for comparison.

This run followed the documented user path end to end instead of running the
check script, and that difference is what it found.

**`ph workflow finish` was completely non-functional on Windows.** Installing
published tarballs back to back isolated it to a version range:

| version | `workflow finish` |
| --- | --- |
| `0.7.0` (`latest`) | reaches `Blocker: verification-unknown` |
| `0.7.0-rc.3` (`next`) | reaches `Blocker: verification-unknown` |
| `0.8.0-beta.23` (`staging`) | `source-read-runtime-unavailable` before evaluating anything |

The first diagnosis — the `O_DIRECTORY`/`O_NOFOLLOW` flags, the same cause as the
2026-08-05 run — was wrong. Patching them changed nothing on this host. The
actual cause is one level down: the source-read snapshot loads a native addon,
and `native/project-read/manifest.json` builds `darwin-arm64`, `darwin-x64`,
`linux-x64`, and `linux-arm64` only. Nothing on Windows to load.

Three defects found, all fixed:

- `workflow finish` demanded a native artifact that is not built for the
  platform, instead of falling back to the unsnapshotted path it already uses
  elsewhere. Fixed in #214, which also separates "no artifact exists for this
  platform" from "the artifact failed to load", so a built platform keeps
  failing closed. **The fallback was incomplete** — see the 2026-08-09 run
  below.
- `ph evidence read` returned `Evidence read unavailable.` for the same reason.
  Since it is the only producer of the `fileRole` evidence
  `java-role-read-coverage` accepts, a cooperative PASS was unreachable on
  Windows even after the finish path worked. Fixed in #215.
- Nothing told a Windows user that a cooperative PASS is unavailable to them.
  They would work through the entire rail and be stopped at the last step.
  Fixed in #216: `ph doctor` now states it beside Node support.

The run also verified acceptance evidence for #124 and #112 on this host —
Sigstore readiness bounded at ~5.6–5.9s with no token, URL, absolute-path, or
raw-bundle leakage, and `authority status`/`explain` plaintext–JSON parity with
one actionable next step. Both are recorded on those issues with their
limitations stated.

**Cooperative assurance remains darwin and linux only.** The cooperative path has
55 references to the native boundary, including `runFixedGradle` and
`runFixedGit` — the boundary is what runs the build, which is the entire content
of the assurance. Degrading it would keep the word and remove the thing it names,
so a `win32-x64` artifact is tracked separately in #217 rather than worked around.

### Windows 11, 2026-08-09

Same host, win32/x64, node v22.9.0, `persona-harness@0.8.0` installed from the
registry rather than packed from a branch. The point of this run was to check
whether the three fixes above hold for a user who installs the released version.

**Two of the three hold. The `#214` fallback does not.**

```
> npx ph workflow finish implement --assurance cooperative
exit=1
- Cooperative verification blocked: source-read-runtime-unavailable.

... Cooperative verification ran without the snapshot boundary ...
```

Both lines at once, and they contradict each other. The platform branch is
taken — that is what prints the notice — and then
`prepareCooperativeFinishContext` re-reserves the boundary the branch skipped on
purpose, so the finish is blocked before judging anything. The notice reported
that as a completed unsnapshotted run.

Two independent reasons nothing caught it:

- No platform in the test matrix can reach the branch. On darwin and linux the
  re-reservation always succeeds, so the degraded path is indistinguishable from
  the normal one. All 2,190 tests passed.
- `windows-platform-smoke.yml` had never run the cooperative path. The default
  assurance is `external` (`src/cli/workflow-args.ts:186`) and the smoke passed
  no `--assurance`, so every Windows assertion recorded before this run
  exercised the external path only.

Fixed in #236: the notice no longer claims a verification that did not happen,
and the smoke now invokes `--assurance cooperative` explicitly. The functional
half stays open in #235, where scoping it surfaced the more important finding —
the obvious fix routes Windows into a **non-boundary verification path that can
return `passed`** (`src/cli/cooperative-finish-authority.ts:63`), which would
produce a cooperative PASS on the one platform whose `doctor` output states in
words that it cannot reach one.

This run also settled #217 with measurement rather than estimate, in two passes —
and the first pass was wrong in a way worth keeping visible.

The toolchain is not the obstacle: MSVC 19.41.34120 and Windows SDK 10.0.22621
are present and `cl` works. From there I concluded that `openat`,
`fork`+`execve`, and device+inode identity have no faithful Win32 equivalents,
and that the first would need `NtCreateFile` with `RootDirectory` — ntdll, not a
stable public API.

**That overstated it.** A C probe compiled and run on the host answered three of
the four with documented Win32 APIs:

```
rename blocked while handle held                     YES
delete blocked while handle held                     YES
FILE_ID_INFO available from handle                   YES
junction detected, not followed                      YES
Win32 handle-relative open (openat equivalent)       NO   (no such API)
```

A directory handle held without `FILE_SHARE_DELETE` blocks rename and delete of
that directory. `GetFileInformationByHandleEx(FileIdInfo)` gives a volume serial
and a 128-bit file ID from the handle. `FILE_FLAG_OPEN_REPARSE_POINT` with
`FileAttributeTagInfo` refuses a junction instead of following it.

Only handle-relative open is genuinely absent, and it matters less than it
reads. `openat` exists to make a path-component swap *harmless*; holding the
handle makes the swap *impossible*. The same goal by the opposite route.

So a win32 artifact is feasible without any undocumented API — it is still a
reimplementation of a 2,164-line security-critical component on different
primitives, which is why #217 was closed as a recorded decision rather than as
an impossibility. The lesson for this document is the ordinary one: the first
answer came from knowledge, the second from a program, and they disagreed.
