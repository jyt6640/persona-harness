# Workflow Closure Lifecycle Projection

Status: current canonical lifecycle contract.

This document is the selected current contract for `workflow-lifecycle.1`.
It supersedes earlier planner-only descriptions for status, closure, report, and
loop-state consistency. Historical report-marker notes remain at
[`v0.3.0-workflow-report-status-lifecycle.md`](v0.3.0-workflow-report-status-lifecycle.md)
but are not current lifecycle input.

## Scope

The projection is a read-only, fail-closed view of workflow state. It is shared
by:

- `readWorkflowStatus` and `npx ph workflow check`;
- `npx ph workflow closure status --json` and `next --json`;
- closure step selection and finish follow-up guidance; and
- persisted workflow-loop and ralph-loop state readers.

It is not a release state machine. It does not issue or consume authority, run
a producer, create a signature, publish a package, move a tag, create a GitHub
release, or decide that a release is complete.

## Projection Shape

`workflow-lifecycle.1` contains the following stable groups:

```ts
type WorkflowLifecycleProjection = {
  readonly schemaVersion: "workflow-lifecycle.1"
  readonly reports: {
    readonly implementation: { readonly source: "file" | "frontmatter" | "legacy" | "missing"; readonly status: ReportStatus }
    readonly review: { readonly source: "file" | "frontmatter" | "legacy" | "missing"; readonly status: ReportStatus }
  }
  readonly evidence: { readonly source: string; readonly status: "missing" | "present" }
  readonly paths: { readonly harness: "invalid" | "safe"; readonly rules: PathStatus; readonly evidence: PathStatus }
  readonly loops: { readonly workflow: "absent" | "current" | "malformed" | "stale" | "unassessed"; readonly ralph: "absent" | "current" | "malformed" }
  readonly tickets: { readonly status: "clear" | "pending" }
  readonly finishAuthority: { readonly status: "blocked" | "trusted"; readonly blocker: LifecycleBlocker | null }
  readonly readiness: "blocked" | "ready-for-closure"
  readonly blockers: readonly LifecycleBlocker[]
}

type ReportStatus = "conflicting" | "filled" | "malformed" | "missing" | "template" | "unknown"
type PathStatus = "safe" | "unavailable" | "unsafe"
```

`readiness` describes the deterministic local lifecycle only. A value of
`ready-for-closure` is not Finish PASS and is not release readiness.
`finishAuthority` is a separate final-gate observation using the already
implemented authority reader. A blocked authority remains a closure/finish
blocker after the local closure gates are clear; it is intentionally not
silently converted into local lifecycle readiness.

## Fail-Closed Rules

1. An invalid harness configuration, unsafe rules path, or unsafe evidence path
   is returned as a safety blocker before downstream state is trusted.
2. A missing report, untouched template, unknown status, malformed frontmatter,
   repeated contradictory status marker, or conflict between frontmatter and a
   legacy `Status:` marker blocks the relevant report. The parser does not pick
   a fallback winner.
3. Missing evidence blocks lifecycle progression. Evidence presence alone does
   not create trusted authority.
4. A malformed workflow-loop or ralph-loop state blocks continuation. A valid
   workflow-loop state whose rule-pack hash differs from the current rule pack
   is `stale` and blocks continuation. The reader never rewrites or repairs the
   state while reporting it.
5. Pending tickets block closure; history-only backlog state remains a repair
   case instead of an implicit archive.
6. Workflow status and normal closure planning call the existing authority
   reader without consumption. Its blocked result continues to reject copied,
   synthetic, stale, or otherwise untrusted local evidence. This contract does
   not alter authority verification, attestation consumption, or producer behavior.

## Closure And Finish Boundary

Closure reads one status summary and carries its exact lifecycle projection in
`state.lifecycle`. Safe JSON rendering preserves schema, bounded blocker IDs,
and safe artifact references while omitting raw diagnostic prose.

Closure orders work as follows:

1. lifecycle safety blockers;
2. deterministic verification, report, evidence, coverage, ticket, and loop
   blockers; then
3. the existing `trusted-authority-required` final blocker when all earlier
   blockers are clear and `finishAuthority.status` is `blocked`.

`workflow finish implement` still decides Finish PASS through its existing
finish and authority path. The projection cannot manufacture a pass by having
no local blockers. Conversely, a copied or synthetic #111-like report or
evidence file remains diagnostic-only and cannot satisfy the final authority
boundary.

## Repair Guidance

Closure maps invalid report states to `repair-implementation-report-status` or
`repair-review-report-status`, requiring the markers to be corrected before a
fresh `npx ph workflow check`. Stale or malformed persisted state maps to
`repair-workflow-loop-state` or `repair-ralph-loop-state`; these are review and
repair actions, not automatic recovery commands.

## Concurrency And Paths

The projection consumes snapshot readers only. State writers retain their
existing token checks and must refuse replacement races. See
[`workflow-state-concurrency.md`](workflow-state-concurrency.md) for ownership,
no-follow/path constraints, and the rule that malformed or stale persisted
state must be reviewed before a writer replaces it.

## Current-Document Selection

Use this file through [`README.md`](README.md) or the
[`canonical docs index`](canonical-docs-index.md). A retained historical file,
including any `v0.*` lifecycle note or historical release-readiness decision,
must not be selected as current based on its directory alone.

## Nonclaims

This contract does not claim #111 producer success, signature verification,
registry publication, tag movement, GitHub release creation, release
completion, generated-application quality, broad reliability, or independent
External verification. It is workflow lifecycle and closure-state truth only.

## Coverage

Focused coverage exercises shared status/closure projection parity, conflicting
report markers, malformed report frontmatter, stale and malformed loop state,
unsafe path handling, pending tickets, no authority, and synthetic local
evidence that remains blocked by the existing authority boundary.
