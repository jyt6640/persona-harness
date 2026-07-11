# Canonical Docs Index

This index is the current map for finding active Persona Harness records without
guessing whether a file is canonical, archived history, or generated output.
It is a navigation document only; it does not add release evidence or broaden
product claims.

## Canonical Current Records

Use these files when making current product, measurement, or release decisions.

| Topic | Canonical file | Notes |
| --- | --- | --- |
| Current docs pointer | `docs/current/README.md` | Short entrypoint for active status and versioned records. |
| P0-1 `ph go` acceptance | `docs/current/p0-go-acceptance-record.md` | Exact-main acceptance, provenance, cooperative recovery boundary, and item-7 package evidence. |
| P0-2 finish next-action acceptance | `docs/current/p0-finish-next-action-acceptance-record.md` | Exact-main finish follow-up and report-transition acceptance with local-tarball package evidence. |
| P0-3 public discovery acceptance | `docs/current/p0-public-discovery-acceptance-record.md` | Exact-main root/dev discovery and writer-safety acceptance with local-tarball package evidence. |
| Item 12 diff-rules distribution retirement | `docs/current/diff-rules-distribution-retirement-acceptance-record.md` | Exact-main package/init retirement record; repository corpus remains. |
| Advanced surface index | `docs/current/advanced-surface-index.md` | Repository-only dormant-source and preview-surface index; not an npm package support contract. |
| CI finish gate and closure JSON | `docs/current/ci-finish-contract.md` | Exact `finish` exit/stream contract, supported unversioned closure JSON artifact, and CI recipe; no `finish --json` surface exists. |
| CI evidence reverification acceptance | `docs/current/ci-evidence-reverification-acceptance-record.md` | Item 19 exact-main opt-in `--reverify` and explicit CI-mode acceptance with bounded artifact and package evidence. |
| CI evidence reverification design | `docs/current/ci-evidence-reverification-design.md` | Item 19 pre-implementation design lineage; the accepted current contract is recorded separately. |
| Full docs inventory | `docs/current/docs-inventory.md` | Classification for every retained `docs/**` file. |
| 0.7.0-rc.1 release-prep capsule | `docs/releases/v0.7.0-rc.1/README.md` | Next-channel candidate facts and boundaries; not published, tagged, or registry-verified. |
| Stable release facts | `docs/releases/v0.6.0/README.md` | Durable stable `latest` registry-smoke capsule. |
| Package/version timeline | `docs/releases/package-index.md` | Chronological package index from `0.1.0` through current prereleases. |
| Release operations | `docs/current/release/README.md` | Release runbook and workflow-compatible release-note sources. |
| External review adoption status | `docs/current/external-review-adoption-status.md` | Stage 16-e adoption/rejection/defer matrix for external review items; docs-only, no schema/product expansion. |
| Diff-rules classification | `docs/current/diff-rules-classification.md` | T6 classification of all 50 `references/diff-rules` files for future role delivery or T8 gate-candidate work. |
| Java Iron List gate matrix | `docs/current/java-ironlist-gate-matrix.md` | Item 11 source/fixture/convention-state inventory; it does not add Java enforcement. |
| Item 21 Java precision warnings | `docs/current/java-precision-warnings-acceptance-record.md` | Exact-main, three-rule high-precision warn-only acceptance; not full Iron List enforcement. |
| Item 24 QUICK-DEMO gate flow | `docs/current/quick-demo-acceptance-record.md` | Exact-main public three-beat setup, plaintext finish gate, and goal-entry acceptance record. |
| Item 25 PH-core / adapter boundary | `docs/current/ph-core-adapter-boundary-design.md` | Design-only ownership and dependency direction; no module move or adapter implementation. |
| ROLE-RULES dogfooding readiness | `docs/current/role-rules-dogfooding-readiness.md` | T10 exit checklist, violation-log template, and next queue for starting Woowacourse mission dogfooding. |
| Workflow string-gate parsing audit | `docs/current/workflow-string-gate-parsing-audit.md` | T4 audit of report-status parsing migration and retained string-based gate contracts. |
| Ralph-loop status | `docs/current/ralph-loop-measurement-status.md` | Trigger, completion-integrity, cooldown, and default-off status. |
| Role Checklist Relay status | `docs/current/multiagent-relay-trial-status.md` | Relay trial, subagent capability, and checklist-first status. |
| Rail-entry/runtime-injection status | `docs/current/rail-entry-measurement-status.md` | Rail-entry measurement and runtimeInjection park status. |
| Rail-entry prompt regression gate | `docs/current/rail-entry-prompt-regression-gate.md` | Operator-run n>=5 wording regression/non-inferiority gate. |
| Measurement scorecard | `docs/current/measurement-scorecard.md` | Secondary scorecard contract and no-override boundary. |
| Runtime-injection value state | `docs/current/injection-value-status.json` | Machine-readable current decision state. |

## Archive And History Records

Historical records stay in place unless a separate migration can preserve links
and checks. Treat these as evidence history, not current product direction.

| Area | Path | Use |
| --- | --- | --- |
| Versioned durable release history | `docs/releases/v<version>/` | Frozen release facts, registry smoke records, and measurement summaries. |
| Older current-era compatibility docs | `docs/current/v*`, older current docs | Compatibility records retained for link stability. |
| Evidence reviews | `docs/evidence-reviews/` | A/B reviews, actual-run reviews, regrades, and generated-run observations. |
| Phase archives | `docs/phases/` | Phase-specific plans, decisions, and completion notes. |
| Superseded docs | `docs/archive/` | Historical snapshots and retired transition plans. |

## Generated Or Check-Maintained Records

These files are produced or checked by scripts and should be updated through the
matching workflow when their inputs change.

| File | Maintainer/check |
| --- | --- |
| `docs/current/docs-inventory.md` | Updated with docs taxonomy changes; checked by `npm run check:docs`. |
| `docs/current/release/v*-release-notes.md` | Checked by `npm run check:github-release-notes`. |
| `docs/current/acceptance-results/README.md` | Checked by `npm run check:acceptance-results`. |
| `docs/current/injection-value-status.json` | Updated only when accepted measurement state changes. |

## Archive Path Convention

Measurement and smoke archives use:

```text
/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/<run-name>-<timestamp>
```

Each accepted archive should contain at minimum a human-readable `RESULT.md`
or equivalent summary, machine-readable summary JSON where feasible, raw logs
needed for replay or spot checks, and package/source facts when package behavior
is involved. Registry smoke archives must distinguish registry evidence from
local-current tarball evidence.

## Current Measurement Records

- Ralph-loop trigger/completion measurements:
  `docs/current/ralph-loop-measurement-status.md`.
- Role Checklist Relay and OpenCode subagent capability status:
  `docs/current/multiagent-relay-trial-status.md`.
- RuntimeInjection and rail-entry measurements:
  `docs/current/rail-entry-measurement-status.md`.
- Secondary scorecard contract:
  `docs/current/measurement-scorecard.md`.

## Boundaries

This index is navigation only. It must not be cited as token/provider-token
saving, product efficacy, navigation benefit, app quality, full-TDD/test
sufficiency, broad reliability, closure guarantee, autonomous completion,
generated-app certification, deterministic role enforcement, production-ready
delegation, automatic completion/downgrade/removal, CodeGraph/LSP
effectiveness, default-change, registry evidence, or measurement evidence.
