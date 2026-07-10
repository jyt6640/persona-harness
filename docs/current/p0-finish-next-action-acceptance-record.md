# P0-2 Finish Next-Action Acceptance Record

Status: accepted on exact main

## Accepted Main

P0-2 accepts the workflow finish follow-up and report-transition behavior at:

```text
4270a0ed486f3368d09a404433725c7ac8ac6ec5
merge: integrate P0-2 finish follow-up
```

The merge parents are prior main `bdbe3bfb7d1895c112274207c505631dafb04fd5`
and accepted candidate `a82a3af99eef0c80c3ee3273ea51e5d2685088a9`.
Canonical QA accepted that exact main independently. The external package smoke
below also targeted that exact main, not a later docs-record commit.

## Provenance

The accepted candidate lineage is:

```text
1682369 -> b473981 -> a82a3af -> 4270a0e
```

- `1682369` introduced the prioritized workflow finish follow-up surface.
- `b473981` refined follow-up rendering into an action followed by a phased
  command where applicable.
- `a82a3af` added substantive report-content validation before report-filled
  transitions.
- `4270a0e` normally merged the accepted candidate into main without changing
  the accepted candidate commit.

## Accepted Contract

The literal report-filled command for an untouched or template-like
implementation or review report is rejected. That rejection leaves report
bytes, report status, and closure state unchanged. A report transition requires
substantive report evidence before it can be marked filled.

Blocked finish renders exactly one truthful prioritized action and at most one
phased command. The command is not an instruction to bypass the action it
follows. Verification distinguishes the work to do before a transition from a
command that is valid after that work is recorded.

For multiple blockers, plaintext finish retains the non-prioritized blockers
but does not emit competing action or command lists. Plaintext loop dry-run and
its JSON prompt preview use the same prioritized action and command lines and
do not write loop state. Unmapped blockers remain diagnostics/escalation
surfaces; this acceptance record makes no invented command claim for them.

This record does not introduce a `finish --json` contract.

## Exact-Main Evidence

Canonical QA: PASS on exact main `4270a0e`.

External: PASS through a fresh local-current tarball package smoke at:

```text
/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/p0-finish-next-action-main-package-smoke-4270a0e-20260710T165511Z
```

| Fact | Value |
| --- | --- |
| Target commit | `4270a0ed486f3368d09a404433725c7ac8ac6ec5` |
| Package | `persona-harness@0.6.0` |
| Evidence source | Fresh local-current tarball; registry not used |
| SHA-1 | `657d390e72f0bff4ed9b4fd2de2d10a61e4e718c` |
| SHA-256 | `f41738676865eebbcd6649777f4b427723c6c381ad9e63095d6d88871bca42aa` |
| Entry count | `714` |

The archive records nonzero rejection for template report transitions, successful
substantive transitions, one-action/one-command multi-blocker rendering,
verification phase behavior, plaintext/JSON loop parity, and unmapped
diagnostic behavior. It is local tarball evidence only, not registry evidence.

The existing docs taxonomy warning for
`docs/phase1-test-contract-repeat-report-review.md` and the existing direct
README-link expectation failure in `tests/package-files-policy.test.ts` are
pre-existing exceptions, not P0-2 regressions. This record does not change
either baseline.

## Boundaries

No runtime injection/default, schema/evidence-schema, version, release,
publish, tag, `latest`, or `next` movement is accepted here. This is not a
token-saving, efficacy, app-quality, broad-reliability, enforcement,
delegation, or generated-app certification claim.

P0-4 and LEAN work remain outside this acceptance unit.
