# Current Docs Pointer Index

`docs/current/` is the working area for active decisions, status files, release
operations, and maintenance-check inputs. Durable release facts should now be
recorded first under [`docs/releases/`](../releases/README.md).

This cleanup intentionally preserves older `current/` files in place. Many are
historical records that were created before the versioned release-docs
structure. Prefer append-only correction, summary, or migration pointers over
deleting evidence/status history.

## Current Canonical Pointers

- Versioned release capsule:
  [`docs/releases/v0.6.0/`](../releases/v0.6.0/README.md).
- Chronological package/version index:
  [`docs/releases/package-index.md`](../releases/package-index.md).
- Release operations and workflow-compatible release notes:
  [`release/README.md`](release/README.md) and
  [`release/v0.6.0-release-notes.md`](release/v0.6.0-release-notes.md).
- Canonical/archive/generated docs map:
  [`canonical-docs-index.md`](canonical-docs-index.md).
- External review adoption status:
  [`external-review-adoption-status.md`](external-review-adoption-status.md).
- Diff-rules classification:
  [`diff-rules-classification.md`](diff-rules-classification.md).
- Workflow string-gate parsing audit:
  [`workflow-string-gate-parsing-audit.md`](workflow-string-gate-parsing-audit.md).
- Ralph-loop measurement status:
  [`ralph-loop-measurement-status.md`](ralph-loop-measurement-status.md).
- Role Checklist Relay status:
  [`multiagent-relay-trial-status.md`](multiagent-relay-trial-status.md).
- Rail-entry and runtime-injection status:
  [`rail-entry-measurement-status.md`](rail-entry-measurement-status.md).
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
  `latest=0.6.0` and `next=0.6.0-rc.4`; the legacy `alpha` dist-tag has been
  retired after stable. Explicit historical alpha versions remain available by
  exact version. S-3 removed the failed-finish human `Summary:` header after
  S-2 regated it as non-inferior=false.
- `runtimeInjection` remains a parked opt-in preview.
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
- Relay is a Role Checklist Relay: a main-session checklist rail with optional
  host-dependent subagent invocation. A direct OpenCode task/subagent
  capability probe was observed, but PH relay still does not prove reliable
  automatic OpenCode role subagent orchestration. `--multi-agent-preview` and
  `multiAgent` remain compatibility names.
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
product guarantees.
