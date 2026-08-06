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
