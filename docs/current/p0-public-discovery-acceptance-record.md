# P0-3 Public Discovery Acceptance Record

Status: accepted on exact main

## Accepted Main

P0-3 accepts the public command discovery and writer-safety behavior at:

```text
b97e56329761d8a777607abe5121557f9fbb38c0
fix(cli): reject smoke report arguments
```

Canonical QA accepted that exact main independently. The External package smoke
below also targeted that exact main, not a later docs-record commit.

## Provenance

The public-discovery candidate lineage is:

```text
e3ca0a2 -> fcf1790 -> b97e563
```

- `e3ca0a2` was the pre-main P0-2 final-docs record.
- `fcf1790` introduced the public command-discovery split.
- `b97e563` completed the accepted line by rejecting smoke/feedback report
  arguments.

`b97e563` fast-forwarded from pre-main `e3ca0a2`; no path deletion is accepted
by this record.

## Accepted Contract

Root `ph --help` is a human front door: in addition to `version`, it exposes
only `init`, `go`, and `doctor`. Internal workflow, dev, bootstrap, evidence,
and recovery paths are not promoted into root help. Existing legacy direct
paths remain available through their operational surfaces, including
`ph workflow --help`.

`ph dev --help` provides discovery aliases for `evidence`, `smoke`, `feedback`,
`ralph-loop`, `observe`, `bearshell`, and `review`. Direct and dev outputs for
evidence and ralph-loop match. Direct and dev smoke, feedback, observe,
bearshell, and review help paths remain available.

Invalid direct and dev smoke/feedback writer arguments exit nonzero with clear
error/usage and do not create `.persona` or report mutations. Zero-argument
direct and dev smoke/feedback writer behavior remains available and creates
the expected reports.

An unprepared `ph go` exits nonzero without auto-bootstrap or hook-config
creation. Recovery remains hidden from normal root and `ph go --help` output.
`runtimeInjection` remains default false and no hook is required.

This record does not introduce a `finish --json` contract.

## Exact-Main Evidence

Canonical QA: PASS on exact main `b97e563`.

External: PASS through a fresh local-current tarball package smoke at:

```text
/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/p0-public-discovery-main-package-smoke-b97e563-20260710T175127Z
```

| Fact | Value |
| --- | --- |
| Target commit | `b97e56329761d8a777607abe5121557f9fbb38c0` |
| Package | `persona-harness@0.6.0` |
| Evidence source | Fresh local-current tarball; registry not used |
| SHA-1 | `7fe277668ea21e9fce917ec1b70ac4e843c122d7` |
| SHA-256 | `7ccc24bbedec3a3f3b94a75797a1df9d726c4f57098c95397da3cc0f4425666a` |
| Entry count | `718` |

The archive records the root/workflow/dev help surfaces, direct/dev alias
parity, four invalid smoke/feedback writer calls with no `.persona` or report
mutation, four zero-argument writer calls, unprepared `go`, and the default
runtime-injection/hook boundary. It is local tarball evidence only, not
registry evidence.

The existing docs taxonomy warning for
`docs/phase1-test-contract-repeat-report-review.md` and the existing direct
README-link expectation failure in `tests/package-files-policy.test.ts` remain
separate baseline exceptions if reproduced; they are not P0-3 regressions.

## Boundaries

No path deletion, runtime/default, schema/evidence-schema, version, release,
publish, tag, `latest`, `next`, or LEAN movement is accepted here. This is not
a token-saving, efficacy, app-quality, broad-reliability, enforcement,
delegation, or generated-app certification claim.
