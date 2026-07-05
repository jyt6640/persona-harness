# Docs Inventory

This inventory classifies every file under `docs/**` as of the docs taxonomy cleanup. It is an index, not a move record: historical files remain in place unless a future cleanup can move them without breaking checks or links.

## Policy

- Versioned durable facts belong in `docs/releases/v<version>/`.
- `docs/current/` should stay a small active pointer/status area plus stable operational files that checks or users read directly.
- Historical version-specific files in `docs/current/` are retained for compatibility and should be summarized or linked from version capsules before any move.
- Operational runbooks, templates, fixtures, and HQ orchestration docs stay non-versioned unless a release needs a frozen copy.
- Evidence reviews and phase docs are durable history, not active current status.
- Deleting evidence/status history is avoided; use append-only correction or pointer updates first.

## Classification Counts

- archived historical: 3
- current active pointer/status: 11
- current compatibility doc: 21
- current index: 1
- current or historical decision/status: 16
- current status JSON: 1
- evidence review archive: 47
- historical version-specific current doc: 27
- legacy current evidence review: 2
- operational stable: 31
- phase archive: 46
- version-specific release note: 51
- versioned durable: 14

Total indexed files: 271

## File Inventory

| File | Classification | Version | Disposition |
| --- | --- | --- | --- |
| `docs/README.md` | operational stable | - | Stable non-versioned guide or index. |
| `docs/archive/README.md` | archived historical | - | Historical/superseded record; leave in place and link from indexes when relevant. |
| `docs/archive/docs-taxonomy-archive-plan.md` | archived historical | - | Historical/superseded record; leave in place and link from indexes when relevant. |
| `docs/archive/project-progress-board-2026-06-19-pre-taxonomy.md` | archived historical | - | Historical/superseded record; leave in place and link from indexes when relevant. |
| `docs/current/README.md` | current active pointer/status | - | Current active pointer, checklist, status, or release-operation index. |
| `docs/current/acceptance-results/README.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/acceptance-results/TEMPLATE.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/acceptance-results/results/2026-07-02-local-current-acceptance-ab.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/acceptance-test-checklist.md` | current active pointer/status | - | Current active pointer, checklist, status, or release-operation index. |
| `docs/current/ast-enforcement-rfc.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/backend-clean-code-uniformity-rubric.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/backend-product-code-style-direction.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/canonical-docs-index.md` | current active pointer/status | - | Current active pointer, checklist, status, or release-operation index. |
| `docs/current/clean-opencode-ph-bearshell-smoke.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/desktop-test-artifacts-index.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/docs-inventory.md` | current index | - | Inventory for all docs files; active pointer/index file. |
| `docs/current/evaluation-fixtures/ambiguous-idea-first.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/evaluation-fixtures/backend-api-no-stack.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/evaluation-fixtures/multi-step-backend-small.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/evaluation-fixtures/multi-step-backend.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/evaluation-methodology.md` | operational stable | - | Stable non-versioned guide or index. |
| `docs/current/external-review-adoption-status.md` | current active pointer/status | - | Current active pointer, checklist, status, or release-operation index. |
| `docs/current/evidence-reviews/v0.3.8-alpha.0-clean-workflow-smoke.md` | legacy current evidence review | v0.3.8-alpha.0 | Compatibility location for older evidence review; keep linked rather than moving blindly. |
| `docs/current/evidence-reviews/v0.3.8-alpha.1-clean-tarball-workflow-smoke.md` | legacy current evidence review | v0.3.8-alpha.1 | Compatibility location for older evidence review; keep linked rather than moving blindly. |
| `docs/current/hq-orchestration/README.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/hq-orchestration/protocol.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/hq-orchestration/templates/common-dispatch-header.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/hq-orchestration/templates/dispatch-cli-workflow.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/hq-orchestration/templates/dispatch-docs-release.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/hq-orchestration/templates/dispatch-qa-coverage.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/hq-orchestration/templates/dispatch-research-reference.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/hq-orchestration/templates/dispatch-runtime-injection.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/hq-orchestration/templates/dispatch-skills-prompting.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/hq-orchestration/templates/result-report-format.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/hq-orchestration/thread-index.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/injection-value-status.json` | current active pointer/status | - | Current active pointer, checklist, status, or release-operation index. |
| `docs/current/injection-value-stopping-rule.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/java-backend-actual-quality-shape-review.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/java-backend-bootstrap-injection-design.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/java-backend-bootstrap-open-code-demo.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/java-backend-mvp-install-guide.md` | operational stable | - | Stable non-versioned guide or index. |
| `docs/current/java-backend-mvp-packaging-readiness.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/loop-engineering.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/measurement-scorecard.md` | current active pointer/status | - | Current active pointer, checklist, status, or release-operation index. |
| `docs/current/multi-agent-relay-design.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/multiagent-relay-trial-status.md` | current active pointer/status | - | Current active pointer, checklist, status, or release-operation index. |
| `docs/current/mvp-goal.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/mvp-scope-consistency-check.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/mvp-scope-status.json` | current status JSON | - | Machine-readable status; keep path stable for checks and tools. |
| `docs/current/next-rail-prompt-drafts.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/npm-beta-publish-preparation.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/omo-steal-measurement-report.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/persona-harness-detailed-usage.md` | operational stable | - | Stable non-versioned guide or index. |
| `docs/current/persona-harness-state-and-version.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/persona-workflow-roles-v0.3.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/ph-bearshell-mvp.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/phase-artifact-retention-policy.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/phase2-scope-settlement.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/productization-path-decision.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/programming-shared-skill-actual-usage-review.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/rail-compliance-evidence-design.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/rail-entry-measurement-status.md` | current active pointer/status | - | Current active pointer, checklist, status, or release-operation index. |
| `docs/current/rail-entry-prompt-regression-gate.md` | current active pointer/status | - | Current active pointer, checklist, status, or release-operation index. |
| `docs/current/ralph-loop-measurement-status.md` | current active pointer/status | - | Current active pointer, checklist, status, or release-operation index. |
| `docs/current/release/README.md` | current active pointer/status | - | Current active pointer, checklist, status, or release-operation index. |
| `docs/current/release/github-actions-release-automation.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/release/next-version-blocked.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/release/next-version-readiness.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/release/npm-trusted-publishing-runbook.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/release/release-checklist.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/release/release-notes-template.md` | operational stable | - | Operational fixture/template/runbook; stays non-versioned unless a release freezes a copy. |
| `docs/current/release/v0.3.0-alpha.3-candidate.md` | version-specific release note | v0.3.0-alpha.3 | Workflow-compatible release-note source for v0.3.0-alpha.3; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.0-alpha.3-demo-packaging-decision.md` | version-specific release note | v0.3.0-alpha.3 | Workflow-compatible release-note source for v0.3.0-alpha.3; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.0-alpha.3-release-notes.md` | version-specific release note | v0.3.0-alpha.3 | Workflow-compatible release-note source for v0.3.0-alpha.3; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.1-alpha.0-release-notes.md` | version-specific release note | v0.3.1-alpha.0 | Workflow-compatible release-note source for v0.3.1-alpha.0; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.2-alpha.0-release-notes.md` | version-specific release note | v0.3.2-alpha.0 | Workflow-compatible release-note source for v0.3.2-alpha.0; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.2-alpha.1-release-notes.md` | version-specific release note | v0.3.2-alpha.1 | Workflow-compatible release-note source for v0.3.2-alpha.1; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.2-alpha.2-release-notes.md` | version-specific release note | v0.3.2-alpha.2 | Workflow-compatible release-note source for v0.3.2-alpha.2; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.2-alpha.3-clean-short-request-review.md` | version-specific release note | v0.3.2-alpha.3 | Workflow-compatible release-note source for v0.3.2-alpha.3; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.2-alpha.3-on-off-ab-review.md` | version-specific release note | v0.3.2-alpha.3 | Workflow-compatible release-note source for v0.3.2-alpha.3; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.2-alpha.3-release-notes.md` | version-specific release note | v0.3.2-alpha.3 | Workflow-compatible release-note source for v0.3.2-alpha.3; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.3-alpha.0-release-notes.md` | version-specific release note | v0.3.3-alpha.0 | Workflow-compatible release-note source for v0.3.3-alpha.0; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.4-alpha.0-release-notes.md` | version-specific release note | v0.3.4-alpha.0 | Workflow-compatible release-note source for v0.3.4-alpha.0; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.5-alpha.0-release-notes.md` | version-specific release note | v0.3.5-alpha.0 | Workflow-compatible release-note source for v0.3.5-alpha.0; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.6-alpha.0-release-notes.md` | version-specific release note | v0.3.6-alpha.0 | Workflow-compatible release-note source for v0.3.6-alpha.0; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.6-alpha.1-release-notes.md` | version-specific release note | v0.3.6-alpha.1 | Workflow-compatible release-note source for v0.3.6-alpha.1; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.7-alpha.1-release-notes.md` | version-specific release note | v0.3.7-alpha.1 | Workflow-compatible release-note source for v0.3.7-alpha.1; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.8-alpha.0-release-notes.md` | version-specific release note | v0.3.8-alpha.0 | Workflow-compatible release-note source for v0.3.8-alpha.0; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.8-alpha.1-release-notes.md` | version-specific release note | v0.3.8-alpha.1 | Workflow-compatible release-note source for v0.3.8-alpha.1; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.8-alpha.2-release-notes.md` | version-specific release note | v0.3.8-alpha.2 | Workflow-compatible release-note source for v0.3.8-alpha.2; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.8-alpha.3-release-notes.md` | version-specific release note | v0.3.8-alpha.3 | Workflow-compatible release-note source for v0.3.8-alpha.3; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.8-alpha.4-release-notes.md` | version-specific release note | v0.3.8-alpha.4 | Workflow-compatible release-note source for v0.3.8-alpha.4; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.8-alpha.5-release-notes.md` | version-specific release note | v0.3.8-alpha.5 | Workflow-compatible release-note source for v0.3.8-alpha.5; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.9-alpha.0-release-notes.md` | version-specific release note | v0.3.9-alpha.0 | Workflow-compatible release-note source for v0.3.9-alpha.0; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.9-alpha.1-release-notes.md` | version-specific release note | v0.3.9-alpha.1 | Workflow-compatible release-note source for v0.3.9-alpha.1; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.9-alpha.2-release-notes.md` | version-specific release note | v0.3.9-alpha.2 | Workflow-compatible release-note source for v0.3.9-alpha.2; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.9-alpha.3-release-notes.md` | version-specific release note | v0.3.9-alpha.3 | Workflow-compatible release-note source for v0.3.9-alpha.3; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.9-alpha.4-release-notes.md` | version-specific release note | v0.3.9-alpha.4 | Workflow-compatible release-note source for v0.3.9-alpha.4; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.9-alpha.5-release-notes.md` | version-specific release note | v0.3.9-alpha.5 | Workflow-compatible release-note source for v0.3.9-alpha.5; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.9-alpha.6-release-notes.md` | version-specific release note | v0.3.9-alpha.6 | Workflow-compatible release-note source for v0.3.9-alpha.6; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.9-alpha.7-release-notes.md` | version-specific release note | v0.3.9-alpha.7 | Workflow-compatible release-note source for v0.3.9-alpha.7; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.3.9-alpha.8-release-notes.md` | version-specific release note | v0.3.9-alpha.8 | Workflow-compatible release-note source for v0.3.9-alpha.8; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.4.0-rc.1-release-notes.md` | version-specific release note | v0.4.0-rc.1 | Workflow-compatible release-note source for v0.4.0-rc.1; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.4.0-rc.10-release-notes.md` | version-specific release note | v0.4.0-rc.10 | Workflow-compatible release-note source for v0.4.0-rc.10; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.4.0-rc.2-release-notes.md` | version-specific release note | v0.4.0-rc.2 | Workflow-compatible release-note source for v0.4.0-rc.2; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.4.0-rc.3-release-notes.md` | version-specific release note | v0.4.0-rc.3 | Workflow-compatible release-note source for v0.4.0-rc.3; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.4.0-rc.4-release-notes.md` | version-specific release note | v0.4.0-rc.4 | Workflow-compatible release-note source for v0.4.0-rc.4; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.4.0-rc.5-release-notes.md` | version-specific release note | v0.4.0-rc.5 | Workflow-compatible release-note source for v0.4.0-rc.5; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.4.0-rc.6-release-notes.md` | version-specific release note | v0.4.0-rc.6 | Workflow-compatible release-note source for v0.4.0-rc.6; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.4.0-rc.7-release-notes.md` | version-specific release note | v0.4.0-rc.7 | Workflow-compatible release-note source for v0.4.0-rc.7; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.4.0-rc.8-release-notes.md` | version-specific release note | v0.4.0-rc.8 | Workflow-compatible release-note source for v0.4.0-rc.8; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.4.0-rc.9-release-notes.md` | version-specific release note | v0.4.0-rc.9 | Workflow-compatible release-note source for v0.4.0-rc.9; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.4.0-release-notes.md` | version-specific release note | v0.4.0 | Workflow-compatible release-note source for v0.4.0; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.4.1-rc.1-release-notes.md` | version-specific release note | v0.4.1-rc.1 | Workflow-compatible release-note source for v0.4.1-rc.1; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.4.1-rc.2-release-notes.md` | version-specific release note | v0.4.1-rc.2 | Workflow-compatible release-note source for v0.4.1-rc.2; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.5.0-rc.1-release-notes.md` | version-specific release note | v0.5.0-rc.1 | Workflow-compatible release-note source for v0.5.0-rc.1; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.5.0-rc.2-release-notes.md` | version-specific release note | v0.5.0-rc.2 | Workflow-compatible release-note source for v0.5.0-rc.2; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.5.0-release-notes.md` | version-specific release note | v0.5.0 | Workflow-compatible release-note source for v0.5.0; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.6.0-rc.1-release-notes.md` | version-specific release note | v0.6.0-rc.1 | Workflow-compatible release-note source for v0.6.0-rc.1; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.6.0-rc.2-release-notes.md` | version-specific release note | v0.6.0-rc.2 | Workflow-compatible release-note source for v0.6.0-rc.2; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.6.0-rc.3-release-notes.md` | version-specific release note | v0.6.0-rc.3 | Workflow-compatible release-note source for v0.6.0-rc.3; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/release/v0.6.0-rc.4-release-notes.md` | version-specific release note | v0.6.0-rc.4 | Workflow-compatible release-note source for v0.6.0-rc.4; summarize durable facts in docs/releases/v<version>/ when current. |
| `docs/current/rule-curation.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/rule-policy.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/shared-skill-reference-direction.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/skill-auto-routing-result.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/skill-hook-role-agentization-roadmap.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/stop-continuation-hook-design.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/team-project-adoption-guide.md` | operational stable | - | Stable non-versioned guide or index. |
| `docs/current/top-level-intent-router-design.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/v0.2.1-package-metadata-audit.md` | historical version-specific current doc | v0.2.1 | Historical v0.2.1 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.2.1-release-readiness.md` | historical version-specific current doc | v0.2.1 | Historical v0.2.1 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.2.1-support-contract.md` | historical version-specific current doc | v0.2.1 | Historical v0.2.1 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-alpha-publish-readiness.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-backend-profile-summary-injection-design.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-blackbear-plan-artifact.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-domain-behavior-guidance-review.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-external-tester-feedback-template.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-external-tester-guide.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-gradle-spring-build-guidance.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-installed-package-evidence-noise-policy.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-intake-transcript-fixture.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-interactive-intake-design.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-philosophy-policy-overlay-design.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-plan-acceptance.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-profile-schema-decision.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-project-intake-philosophy-workflow.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-step-api-contract-scope-decision.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-workflow-history.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-workflow-next-surface-decision.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.0-workflow-report-status-lifecycle.md` | historical version-specific current doc | v0.3.0 | Historical v0.3.0 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.1-external-tester-feedback-template.md` | historical version-specific current doc | v0.3.1 | Historical v0.3.1 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.1-external-tester-guide.md` | historical version-specific current doc | v0.3.1 | Historical v0.3.1 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.1-workflow-diagnostics-surface.md` | historical version-specific current doc | v0.3.1 | Historical v0.3.1 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.3-existing-project-adaptation-mode.md` | historical version-specific current doc | v0.3.3 | Historical v0.3.3 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.6-requirements-draft-workflow.md` | historical version-specific current doc | v0.3.6 | Historical v0.3.6 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.3.6-workflow-ticket-backlog.md` | historical version-specific current doc | v0.3.6 | Historical v0.3.6 current-era doc; summarize in a version capsule only when the version becomes active again. |
| `docs/current/v0.4-evaluation-plan.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/v0.4-evaluation-runbook.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/vendored-shared-skills-tarball-policy.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/workflow-closure-state-machine-design.md` | current or historical decision/status | - | Decision/status document; active only if named by docs/current/README.md, otherwise historical reference. |
| `docs/current/workflow-transition-test-map.md` | current compatibility doc | - | Compatibility/current-era doc retained in place; migrate by summary and pointer before moving. |
| `docs/current/workflow.md` | operational stable | - | Stable non-versioned guide or index. |
| `docs/evidence-reviews/README.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/backend-clean-code-parallel-ab-review.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/backend-clean-code-task-fixture-ab-review.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/backend-clean-code-task-fixture-design.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/coupon-product-code-flow-ab-review.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/generated-demo-quality-synthesis.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/gradle-ab-actual-run-review.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/inventory-product-code-flow-ab-review.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/java-common-routing-ab-review.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/java-domain-root-package-plan-ab-review.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/java-global-package-plan-surface.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/java-package-structure-plan-ab-review.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/java-package-structure-plan-surface.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/java-product-code-flow-ab-regrade.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/java-root-semantics-ab-review.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/response-dto-boundary-ab-review.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/spring-boot-entrypoint-package-shape-review.md` | evidence review archive | - | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.2.1-clean-project-quality-review.md` | evidence review archive | v0.2.1 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-alpha2-fresh-install-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-alpha2-read-coverage-tui-rerun.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-alpha2-tui-short-implementation-review.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-bearshell-guidance-clean-generation-review.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-blackbear-plan-fill-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-bootjar-guidance-fresh-on-review.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-domain-behavior-clean-generation-review.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-generated-java-target-role-followup.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-gradle-spring-buildline-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-intake-planned-implementation-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-intake-planning-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-interactive-accepted-plan-implementation-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-interactive-intake-planning-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-live-http-qa-opencode-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-live-http-qa-template-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-plan-acceptance-implementation-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-plan-based-implementation-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-policy-overlay-accepted-implementation-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-policy-overlay-clean-workflow-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-profile-summary-injection-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-repeat-workflow-evidence-noise-review.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-step-contract-scoped-clean-workflow-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-template-fill-history-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.0-workflow-report-status-lifecycle-smoke.md` | evidence review archive | v0.3.0 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.1-review-report-short-tui-smoke.md` | evidence review archive | v0.3.1 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.1-short-tui-workflow-smoke.md` | evidence review archive | v0.3.1 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.1-workflow-guard-clean-tui-smoke.md` | evidence review archive | v0.3.1 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.1-workflow-noise-classification-smoke.md` | evidence review archive | v0.3.1 | Evidence/review record; durable but not the current status surface. |
| `docs/evidence-reviews/v0.3.1-workflow-runner-clean-tui-smoke.md` | evidence review archive | v0.3.1 | Evidence/review record; durable but not the current status surface. |
| `docs/phases/README.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase-next/README.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase-next/phase-next-controller-sql-observer-design.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase-next/phase-next-guard-ast-linter-observation-design.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase-next/phase-next-java-parser-fixture-contract.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase-next/phase-next-java-parser-metadata-spike.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase-next/phase-next-observation-candidate.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase-next/phase-next-plan.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase-next/phase-next-service-storage-observer-design.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase0/README.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase0/phase-0-report.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase0/phase0-rule-selection-review.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase0/phase0-step2-scope.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/README.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-1-frontmatter-worktree-settlement.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-1-schema-validation-policy-decision.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-1-schema-validation-result.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-2-actual-report-review.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-2-additional-actual-report-review.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-2-controller-rule-improvement.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-2-controller-sql-actual-report-review.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-2-controller-sql-next-decision.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-2-next-decision.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-2-next-observation-decision.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-2-observation-pass-decision.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-2-observer-design.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-2-parser-decision.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-2-plan.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-2-report-review.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-completion-audit.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-next-observation-decision.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-plan.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-rule-loader-design.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-service-storage-actual-report-review.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-service-storage-repeat-report-review.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-test-contract-actual-report-review.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-test-contract-cleanup-decision.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-test-contract-follow-up-decision.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-test-contract-matcher-adjustment-design.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-test-contract-matcher-adjustment-result.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-test-contract-observer-design.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-test-contract-repeat-report-review.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-test-contract-response-time-repeat-review.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-test-contract-third-report-review.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-test-contract-time-list-matcher-decision.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/phases/phase1/phase1-test-contract-time-list-matcher-result.md` | phase archive | - | Phase plan/decision/result record; durable phase history. |
| `docs/project-progress-board.md` | operational stable | - | Stable non-versioned guide or index. |
| `docs/releases/README.md` | versioned durable | - | Canonical versioned release capsule, package/version index, or release-capsule index. |
| `docs/releases/package-index.md` | versioned durable | - | Canonical versioned release capsule, package/version index, or release-capsule index. |
| `docs/releases/v0.6.0-rc.1/README.md` | versioned durable | v0.6.0-rc.1 | Canonical versioned release capsule, package/version index, or release-capsule index. |
| `docs/releases/v0.6.0-rc.1/measurements.md` | versioned durable | v0.6.0-rc.1 | Canonical versioned release capsule, package/version index, or release-capsule index. |
| `docs/releases/v0.6.0-rc.1/release-facts.md` | versioned durable | v0.6.0-rc.1 | Canonical versioned release capsule, package/version index, or release-capsule index. |
| `docs/releases/v0.6.0-rc.2/README.md` | versioned durable | v0.6.0-rc.2 | Canonical versioned release capsule, package/version index, or release-capsule index. |
| `docs/releases/v0.6.0-rc.2/measurements.md` | versioned durable | v0.6.0-rc.2 | Canonical versioned release capsule, package/version index, or release-capsule index. |
| `docs/releases/v0.6.0-rc.2/release-facts.md` | versioned durable | v0.6.0-rc.2 | Canonical versioned release capsule, package/version index, or release-capsule index. |
| `docs/releases/v0.6.0-rc.3/README.md` | versioned durable | v0.6.0-rc.3 | Canonical versioned release capsule, package/version index, or release-capsule index. |
| `docs/releases/v0.6.0-rc.3/measurements.md` | versioned durable | v0.6.0-rc.3 | Canonical versioned release capsule, package/version index, or release-capsule index. |
| `docs/releases/v0.6.0-rc.3/release-facts.md` | versioned durable | v0.6.0-rc.3 | Canonical versioned release capsule, package/version index, or release-capsule index. |
| `docs/releases/v0.6.0-rc.4/README.md` | versioned durable | v0.6.0-rc.4 | Canonical versioned release capsule, package/version index, or release-capsule index. |
| `docs/releases/v0.6.0-rc.4/measurements.md` | versioned durable | v0.6.0-rc.4 | Canonical versioned release capsule, package/version index, or release-capsule index. |
| `docs/releases/v0.6.0-rc.4/release-facts.md` | versioned durable | v0.6.0-rc.4 | Canonical versioned release capsule, package/version index, or release-capsule index. |
