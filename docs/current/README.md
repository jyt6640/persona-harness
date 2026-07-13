# Current Docs Pointer Index

> **New to Persona Harness? Do not start here.** Start with
> [`../../README.md`](../../README.md), [`../START-HERE.md`](../START-HERE.md),
> [`../QUICK-DEMO.md`](../QUICK-DEMO.md), and
> [`../MEASURED-CLAIMS.md`](../MEASURED-CLAIMS.md). Not every file under
> `current/` is a current product claim.

`docs/current/` is the working area for active decisions, status files, release
operations, and maintenance-check inputs. Durable release facts should now be
recorded first under [`docs/releases/`](../releases/README.md).

This cleanup intentionally preserves older `current/` files in place. Many are
historical records that were created before the versioned release-docs
structure. Prefer append-only correction, summary, or migration pointers over
deleting evidence/status history.

## Current Canonical Pointers

- Prepared-project CLI entry: `npx ph go "<concrete implementation goal>"`
  composes capture, split, next, and the existing implementation rail without
  a runtime hook. Its lock/conflict behavior is for cooperative local writers,
  and does not address hostile same-user filesystem path replacement. Existing
  draft/approval commands remain the route for vague product ideas.
- Current published next-channel capsule:
  [`docs/releases/v0.7.0-rc.2/`](../releases/v0.7.0-rc.2/README.md).
- Previous published next-channel capsule:
  [`docs/releases/v0.7.0-rc.1/`](../releases/v0.7.0-rc.1/README.md).
- Current published stable capsule:
  [`docs/releases/v0.6.0/`](../releases/v0.6.0/README.md).
- Chronological package/version index:
  [`docs/releases/package-index.md`](../releases/package-index.md).
- Release operations and workflow-compatible release notes:
  [`release/README.md`](release/README.md) and
  [`release/v0.7.0-rc.2-release-notes.md`](release/v0.7.0-rc.2-release-notes.md).
- P3 integrity roadmap and release hold:
  [`p3-integrity-roadmap.md`](p3-integrity-roadmap.md).
- P3-2 closure authority candidate:
  [`p3-2-closure-authority-acceptance-record.md`](p3-2-closure-authority-acceptance-record.md).
- P3-3 verification receipt candidate:
  [`p3-3-verification-receipt-acceptance-record.md`](p3-3-verification-receipt-acceptance-record.md).
- P3-8 CI/release integrity candidate:
  [`p3-8-ci-release-integrity-acceptance-record.md`](p3-8-ci-release-integrity-acceptance-record.md).
- P3-4 fresh fixed-command verifier candidate:
  [`p3-4-fresh-fixed-command-verifier-acceptance-record.md`](p3-4-fresh-fixed-command-verifier-acceptance-record.md).
- Canonical/archive/generated docs map:
  [`canonical-docs-index.md`](canonical-docs-index.md).
- External review adoption status:
  [`external-review-adoption-status.md`](external-review-adoption-status.md).
- Diff-rules classification:
  [`diff-rules-classification.md`](diff-rules-classification.md).
- ROLE-RULES dogfooding readiness:
  [`role-rules-dogfooding-readiness.md`](role-rules-dogfooding-readiness.md).
- Workflow string-gate parsing audit:
  [`workflow-string-gate-parsing-audit.md`](workflow-string-gate-parsing-audit.md).
- Workflow state concurrency model:
  [`workflow-state-concurrency.md`](workflow-state-concurrency.md).
- Role-scoped static rule delivery:
  [`role-scoped-rule-delivery.md`](role-scoped-rule-delivery.md).
- Ralph-loop measurement status:
  [`ralph-loop-measurement-status.md`](ralph-loop-measurement-status.md).
- Role Checklist Relay preview/advanced status:
  [`multiagent-relay-trial-status.md`](multiagent-relay-trial-status.md).
- Advanced/dormant source and preview-surface index:
  `advanced-surface-index.md`.
- Rail-entry and runtime-injection status:
  [`rail-entry-measurement-status.md`](rail-entry-measurement-status.md).
- Default-off OpenCode entry-steering corpus and status:
  [`entry-steering-status.md`](entry-steering-status.md).
- Rail-entry wording regression gate:
  [`rail-entry-prompt-regression-gate.md`](rail-entry-prompt-regression-gate.md).
- Measurement scorecard:
  [`measurement-scorecard.md`](measurement-scorecard.md).
- Runtime-injection value status JSON:
  [`injection-value-status.json`](injection-value-status.json).
- Full docs inventory:
  [`docs-inventory.md`](docs-inventory.md).

## Current Facts To Preserve

- `0.6.0` is published as the stable npm `latest` package after QA accepted
  the final External registry smoke. Current published channels are
  `latest=0.6.0` and `next=0.7.0-rc.2`; the legacy `alpha` dist-tag has been
  retired after stable. Explicit historical alpha versions remain available by
  exact version. S-3 removed the failed-finish human `Summary:` header after
  S-2 regated it as non-inferior=false.
- `0.7.0-rc.1` was published to npm `next` on 2026-07-11 with registry
  gitHead/tag/release-branch commit `d4d4d9acb1e4198fb2001ac81fe77f6bd9d4efd9`.
- `0.7.0-rc.2` was published to npm `next` from exact main
  `185885b7918459ef12bbea120a4261962cd57059`. Registry gitHead and matching
  tag/GitHub prerelease `v0.7.0-rc.2` target that commit; package hashes and
  workflow provenance are recorded in its durable release facts.
- P3 is accepted as the next blocking program before P2 product/release use:
  Stable/GA and npm `latest` movement are NO-GO until P3 closes. The
  2026-07-12 local production audit inputs are recorded in
  `p3-integrity-roadmap.md`; they are release-planning evidence, not a
  published third-party certification. Completed P2 source-only evidence and
  bundles remain held, not discarded.
- The P3-2 candidate branch blocks finish PASS when no trusted Persona Harness
  or external authority receipt exists. Unsigned local reports, bearshell
  output, JUnit XML, TDD JSON, markers, and self-computed digests remain
  diagnostic-only; this candidate is not yet accepted into canonical main.
- P3-3 defines receipt/attempt parsing and read-only lifecycle diagnostics only.
  It does not issue, verify, migrate, or accept any receipt as finish authority;
  P3-2 remains blocked until a later trusted path exists.
- P3-8 is a candidate-only CI/publish/release workflow hardening unit. It adds
  PR/main CI, canonical-main/tag ancestry checks, registry integrity readback,
  and fail-closed GitHub release idempotency. It does not mutate GitHub
  settings, publish npm, create tags/releases, or claim release readiness.
- P3-4 adds fresh fixed-command execution and nonzero JUnit testcase
  enforcement. Local cooperative receipts remain untrusted under P3-2; no
  finish authority or strong integrity claim is enabled.
- `runtimeInjection` remains a parked opt-in preview.
- P0-1 `ph go` is accepted on exact main `c097428` for its cooperative local
  writer/workspace-edit contract. Recovery remains hidden from normal help,
  requires a claimed generation, and revalidates before clearing; hostile
  same-user path replacement remains outside scope.
- The rail-entry prompt regression gate is an operator-run n>=5
  non-inferiority check for rail/AGENTS/gate-output wording changes. It is not
  product-efficacy or runtime-injection benefit evidence.
- Ralph-loop idle trigger delivery failed to prove model-facing continuation.
  The later default-off hybrid tool-output trigger has accepted
  trigger-survival evidence, including n=15 PASS for marker/state/follow-up,
  but blocker-delta correction, cooldown caveats, completion-integrity
  movement, and default-change limits remain active.
- `ph workflow loop` is an explicit capped fresh-session blocker loop command
  with fixture-scoped Stage 18 completion-integrity evidence. It is not a hook,
  not a default, and not evidence of broad product efficacy or token savings.
- Static rule delivery is scoped narrowly by role/stage where T7 delivery
  points include rules in prompt/card surfaces; closure, check, and finish
  gates remain broad/global.
- Relay is an advanced preview Role Checklist Relay: a main-session checklist
  rail with optional host-dependent subagent invocation. A direct OpenCode
  task/subagent capability probe was observed, but PH relay still does not
  prove reliable automatic OpenCode role subagent orchestration.
  `--multi-agent-preview` and `multiAgent` remain compatibility names.
- `workflow role-boundary` remains report-only/heuristic. The wrong-actor
  attribution blind spot is documented.
- `scorecard.1` is secondary archive observation only and does not override
  preregistered kill criteria.
- Fake Gradle/Spring gate-gaming through a `gradle-shim.js`-style shim is a
  candidate measured adversarial case after forged-TDD detection, not a broad
  reliability or product-efficacy proof.

## Classification

- Versioned release records belong in `docs/releases/v<version>/`.
- Release runbooks and workflow-compatible note files remain in
  `docs/current/release/`.
- Active measurements and decision statuses may remain in `docs/current/` while
  they are changing.
- `docs-inventory.md` tracks every file under `docs/**`, including files that
  are intentionally retained in legacy locations.
- Older `v0.3.*`, `v0.4.*`, and transitional files under `docs/current/` are
  historical unless a current pointer above names them. Do not rewrite them to
  look current; add explicit correction or migration notes if needed.

## Product Positioning Boundary

Persona Harness is a gate-first workflow rail, evidence, and continuation
harness. Do not claim token/provider-token saving, product efficacy, navigation
benefit, app quality, full-TDD/test sufficiency, broad reliability, closure
guarantee, autonomous completion, generated-app certification, deterministic
role enforcement, production-ready delegation, automatic
completion/downgrade/removal, CodeGraph/LSP default/effectiveness, or broad
product guarantees. Do not claim strong completion-integrity, anti-forgery,
Stable/GA, or npm `latest` readiness until P3 closes.
