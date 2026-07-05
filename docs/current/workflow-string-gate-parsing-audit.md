# Workflow String Gate Parsing Audit

Status: current T4 audit record.

This document records the ROLE-RULES T4 string-parsing audit. It is an
implementation-maintenance record, not product-efficacy evidence and not a
claim that all gate logic is free of text heuristics.

## T4 Decision

Workflow report status now uses a shared parser with this precedence:

1. `status:` in leading markdown frontmatter.
2. Legacy report `Status:` text forms.
3. `unknown` when neither supported form is present.

If frontmatter and a legacy `Status:` text line are both present and disagree,
the legacy text line wins. That preserves the pre-T4 finish/check result and
avoids making `ph workflow finish implement`, `ph workflow check`,
`ph plan --next`, or rail-compliance hooks stricter for existing reports.

`ph plan --report-filled` updates frontmatter `status:` when present and falls
back to the legacy `Status:` line when frontmatter status is absent. Reports
with no supported status marker still fail with the existing missing-status
diagnostic.

## Removed Or Centralized In T4

| Surface | Pre-T4 behavior | T4 behavior | Coverage |
| --- | --- | --- | --- |
| `ph plan --report-filled` | Replaced only a raw `Status:` line in report markdown. | Updates report frontmatter `status:` first, then legacy `Status:` fallback. | `tests/persona-harness-plan-report-status.test.ts` |
| `ph workflow check` / `ph workflow finish implement` report status | `workflow-status` independently scanned report status text. | Reads report status through the shared frontmatter-first parser. | `tests/persona-harness-workflow-status-parser.test.ts` |
| `ph plan --next` / `ph plan --resume` report status | `plan-next` independently parsed report status text. | Reads report status through the shared frontmatter-first parser. | `tests/persona-harness-plan-next-resume.test.ts` |
| Runtime rail-compliance missing-report check | Hook code independently tested for `Status: filled`. | Reads report status through the shared frontmatter-first parser. | `tests/phase0-rail-compliance.test.ts` |

## Deliberately Retained String Gates

These are not T4 report-status parsing and remain intentionally string-based.
They are either markdown ledger contracts, source-code convention observers, or
runtime command-observation heuristics. They should not be silently converted
without their own compatibility gate.

| Area | Examples | Reason retained | Contract coverage |
| --- | --- | --- | --- |
| Workflow plan status | `src/cli/plan-status.ts`, `src/cli/workflow-status.ts` plan status line. | Plan lifecycle is still a markdown status-line contract; T4 only changed workflow report status. | Plan/next/status workflow tests. |
| Workflow tickets and backlog | `src/cli/workflow-ticket-*`, pending-ticket status/context parsing. | Ticket/backlog markdown is the persisted human-editable state surface. T3 added `schemaVersion:` and metadata filtering. | `tests/persona-harness-workflow-ticket.test.ts`. |
| Read coverage and command discipline | `src/cli/workflow-status.ts`, report coverage/read-range/command evidence patterns. | These are explicit report-content gate heuristics and need a separate evidence model before removal. | Workflow status parser, mechanical finish, closure tests. |
| Verification failure and stack alignment | `src/cli/verification-failure.ts`, `src/cli/stack-alignment.ts`. | These scan report/evidence text for existing gate diagnostics. Replacing them can change finish blockers. | Workflow finish/check guard tests. |
| Runtime rail observation | `src/runtime/rail-compliance.ts`, intent routers, command/tool pattern checks. | Hooks inspect observed tool text and command names by design. | `tests/phase0-rail-compliance.test.ts`, runtime hook tests. |
| Java/Spring observer heuristics | `src/observer/**`. | Observer rules inspect source text where AST tooling is not always available. T2 only adds diagnostics for rule/convention packs. | Observer and convention tests. |
| Rule/convention glob matching | `src/rules/rule-glob.ts`, convention target globs. | Glob matching is a rule-pack contract, not report status parsing. | Rule glob and convention diagnostics tests. |

## Boundary

T4 does not change gate exit codes, JSON schemas, defaults, evidence schemas,
runtime injection state, package version, publish/tag/dist-tags, or product
claims. It only centralizes report status parsing and records the remaining
string-gate inventory for future tranche work.
