# P2 U4-A Korean Output Coverage Audit

Status: read-only coverage audit. No localization implementation is included.

Audit snapshot: `c675e9213ec6e76fe4c220737445f0aa546491f4`, the QA-closed R3
lineage. All source and test citations below are exact `file:line @ c675e92`
snapshots at that commit.

## Scope And Method

This audit inventories user-facing English output families, checks the current
Korean coverage, and identifies the smallest future acceptance units. It
inspected CLI formatters, runtime output boundaries, and existing output
fixtures/tests. It does not run a translated CLI, change a locale, or infer
that the `user-language` profile answer currently selects CLI output language.

Classification meanings:

- `already localized`: a bounded Korean interaction is already present, with
  any remaining English technical values called out.
- `English-only intentional machine contract`: identifiers, flags, JSON keys,
  enum values, paths, or other machine-facing values that must remain stable.
- `English-only human candidate`: user-readable prose with no current Korean
  variant.
- `blocked by CI or snapshot contract`: changing the text requires a
  separately accepted stdout/stderr or fixture/snapshot compatibility unit.
- `out of scope`: not a CLI human-output localization surface for U4-A.

## Findings

| Family and source snapshot | Current Korean coverage and classification | Priority | Package-visible impact | Fixtures/tests that would change | Smallest future unit |
| --- | --- | --- | --- | --- | --- |
| Root/public help: `src/cli/cli-usage.ts:1-20 @ c675e92`; language discovery: `src/cli/language.ts:12-54 @ c675e92` | `ph help`, command descriptions, usage, and language help are English-only human prose. The language list includes the Korean label but does not localize the surrounding output. `English-only human candidate`. | P1 | Yes. Built CLI and npm entry point. | `tests/persona-harness-language-help.test.ts:24-58 @ c675e92`; add locale-specific help assertions while preserving public command visibility. | U4-B1: root help and `ph language` output, with an explicit locale-selection contract. |
| Interactive intake: `src/cli/intake.ts:114-170,188-210 @ c675e92`; question catalog: `src/cli/intake-profile.ts:55-194 @ c675e92` | Intro, choice prompts, retry text, and question labels have Korean coverage. Technical choice values and some input keywords remain stable English identifiers. `already localized`. | P2 | Yes, but only interactive CLI output. | `tests/persona-harness-interactive-intake.test.ts:80-155 @ c675e92`; `tests/persona-harness-intake.test.ts:30-180 @ c675e92`. | U4-B1 may add parity checks only; do not rewrite profile schema or choice IDs. |
| Doctor, reachability, platform, and entry-status: `src/cli/doctor-reachability.ts:135-194,209-244 @ c675e92`; `src/cli/doctor.ts:189-236,249-339 @ c675e92`; `src/runtime/entry-steering-status.ts:12-21,75-110,114-145 @ c675e92` | Doctor findings, platform/runtime warnings, actions, and entry-steering counts are English-only human output. Entry status files are bounded JSON records with stable fields, not Korean prose. `English-only human candidate` for doctor text; `English-only intentional machine contract` for status JSON. | P1 | Yes for doctor CLI; status JSON is an installed runtime evidence surface. | `tests/persona-harness-doctor-reachability.test.ts:77-168 @ c675e92`; `tests/persona-harness-doctor-review.test.ts:47-121 @ c675e92`; `tests/persona-harness-entry-steering-doctor.test.ts:33-64 @ c675e92`. | U4-B2: doctor/reachability/platform prose; keep `PASS`, `WARN`, `BLOCK`, paths, status fields, and exit behavior stable. |
| Attach, init, and go preflight: `src/cli/attach-command-contract.ts:8-54 @ c675e92`; `src/cli/attach.ts:41-229 @ c675e92`; `src/cli/init-output.ts:3-65 @ c675e92`; `src/cli/go-command.ts:51-145,191-240 @ c675e92`; `src/cli/go-preflight.ts:26-97 @ c675e92` | Confirmation, inferred-stack, recovery, next-action, and preflight prose are English-only. Commands, paths, `--yes`, `--repair`, `--stdin`, and status words are machine/user contract tokens. `English-only human candidate` for prose; `English-only intentional machine contract` for tokens. | P1 | Yes. These are public package CLI surfaces. | `tests/persona-harness-attach.test.ts:57-172 @ c675e92`; `tests/persona-harness-go.test.ts:27-126 @ c675e92`; intake/init fixtures in `tests/persona-harness-intake.test.ts:30-180 @ c675e92`. | U4-B2: attach/init/go prose as one acceptance unit only if it preserves invalid-argument exit codes, one-action/one-command rendering, and no-write boundaries. |
| Workflow status/check: `src/cli/workflow-status.ts:460-493 @ c675e92`; `src/cli/workflow-command.ts:161-204 @ c675e92`; workflow usage: `src/cli/workflow-args.ts:36-64,66-125 @ c675e92` | Status labels, artifact summaries, next-step text, guard errors, and usage are English-only human output. `PASS`, `WARN`, paths, command names, and blocker IDs are stable contract values. `English-only human candidate` with machine-token boundary. | P1 | Yes. Common installed CLI output. | `tests/persona-harness-workflow-status-parser.test.ts:169-252 @ c675e92`; `tests/persona-harness-workflow-check.test.ts:164-240 @ c675e92`; `tests/persona-harness-workflow-output.test.ts:29-64 @ c675e92`. | U4-B3: workflow check/status and usage, with exact fixture updates and no changed gate meaning. |
| Closure and finish follow-up: `src/cli/workflow-closure-finish.ts:34-187 @ c675e92`; `src/cli/workflow-finish-follow-up.ts:115-205 @ c675e92`; finish output: `src/cli/workflow-output.ts:86-103,214-230 @ c675e92` | Required fixes, blocker reasons, `Next action`, `Next command`, and finish PASS/FAIL text are English-only. The exact truthful action/command cardinality and finish stdout/stderr are authoritative. `blocked by CI or snapshot contract`. | P0 | Yes. This is the finish gate users and CI observe. | `tests/persona-harness-workflow-finish-next-action.test.ts:224-260 @ c675e92`; `tests/persona-harness-workflow-closure.test.ts:224-260,460-504 @ c675e92`; `tests/persona-harness-mechanical-finish.test.ts:232-279 @ c675e92`. | U4-B3: separately reviewed finish plaintext localization. It must preserve exit code, stderr/stdout placement, one truthful action, at most one command, and no `finish --json` claim. |
| Closure JSON companion: `src/cli/workflow-closure.ts:63-103 @ c675e92`; parser contract: `src/cli/workflow-args.ts:99-104 @ c675e92` | `closure status --json` and `closure next --json` emit structured JSON. Keys, action names, step IDs, blocker IDs, statuses, paths, and commands are machine-facing. `English-only intentional machine contract`, with any human-readable `reason` text requiring a separate decision. | P0 | Yes. Installed CLI artifact consumed by scripts/tests. | `tests/persona-harness-workflow-closure.test.ts:207-215,274-287 @ c675e92`; `tests/persona-harness-mechanical-finish.test.ts:197-215 @ c675e92`. | U4-B3-J: JSON compatibility audit first; do not translate keys/enums or alter the existing schema in U4-A. |
| Role Checklist Relay: `src/cli/workflow-relay-ui.ts:11-25 @ c675e92`; `src/cli/workflow-relay.ts:66-90,92-140,244-271 @ c675e92` | Relay usage, role prompts, authoring hints, and validation text are English-only. `--json` payloads and role names/artifact paths are machine-facing. `English-only human candidate` for preview prose; `English-only intentional machine contract` for JSON and role IDs. | P2 | Yes for advanced CLI preview; no root-help exposure. | `tests/persona-harness-workflow-relay.test.ts:79-80,189-214,300-301 @ c675e92`. | U4-B4: relay preview prose; retain role IDs, artifact filenames, JSON shape, and optional-host boundary. |
| Evidence and feedback: `src/cli/evidence-summary.ts:662-725 @ c675e92`; `src/cli/evidence-ab-run-options.ts:79-92 @ c675e92`; `src/cli/evidence-ab-run.ts:87-107 @ c675e92`; `src/cli/feedback.ts:15-85 @ c675e92` | Evidence human summaries and usage are English-only. The feedback template has Korean section headings but English technical fields and instructions, so coverage is partial rather than complete. JSON metrics/report keys and schema versions are machine contracts. `English-only human candidate` for prose; `English-only intentional machine contract` for JSON. | P2 | Yes for advanced CLI; evidence files are project-local output. | `tests/persona-harness-evidence-summary.test.ts:30-199 @ c675e92`; `tests/persona-harness-evidence-ab-run.test.ts:28-33 @ c675e92`; `tests/persona-harness-evidence-pminus-status.test.ts:106-177 @ c675e92`; add a focused feedback-output fixture because no dedicated feedback test was found. | U4-B4: evidence/feedback prose, with a separate no-schema-change JSON check and explicit no-claim language. |
| Errors and invalid arguments: `src/cli/index.ts:155-173 @ c675e92`; `src/cli/attach-command-contract.ts:21-40 @ c675e92`; `src/cli/go-command.ts:62-88,134-145 @ c675e92`; `src/cli/workflow-ticket-output.ts:14-81 @ c675e92` | Human error messages are English-only and are mixed with stable command names, paths, and error categories. `English-only human candidate`; if an error string is asserted in a fixture, it also becomes `blocked by CI or snapshot contract`. | P1 | Yes for public CLI; error text appears on stderr with nonzero status. | Attach/go tests above; workflow ticket fixtures in `tests/persona-harness-workflow-ticket.test.ts:331-390,602-631 @ c675e92` and source-output assertions in `tests/persona-harness-workflow-output.test.ts:29-64 @ c675e92`. | U4-B2/B3: localize prose while retaining exit status, stderr, usage, command names, and actionable next-command semantics. |
| JSON-vs-human split across evidence/relay/role-boundary/ralph-loop: `src/cli/evidence-summary.ts:686-725 @ c675e92`; `src/cli/workflow-relay.ts:261-271 @ c675e92`; `src/cli/workflow-role-boundary.ts:169-175 @ c675e92`; `src/cli/workflow-ralph-loop.ts:60-67 @ c675e92` | Each surface has a human formatter and an explicit JSON branch. JSON keys, schema versions, enum values, and machine paths are intentional English contracts; human formatting is a candidate only where no snapshot/consumer contract blocks it. `English-only intentional machine contract` for JSON; `blocked by CI or snapshot contract` for coupled human output. | P0 for shared contracts; P2 for advanced surfaces | Yes. CLI output and project evidence both cross package/automation boundaries. | Evidence JSON assertions above; relay JSON parse at `tests/persona-harness-workflow-relay.test.ts:79-80 @ c675e92`; role/ralph JSON tests in their corresponding workflow test files. | U4-B3-J first, then U4-B4 human formatters. No key/enum/schema translation in U4-A. |
| Runtime-injected prompt blocks and detector lexicon: `tests/phase0-runtime-injection-language.test.ts:23-76 @ c675e92`; `src/runtime/entry-intent-detector.ts:39-76 @ c675e92`; runtime warning format: `src/runtime/error-boundary.ts:14-26 @ c675e92` | The existing test explicitly requires injected workflow blocks to remain English. Detector Korean terms are input recognition, not output. Runtime warnings are structured diagnostics rather than a CLI localization surface. `out of scope`. | P3 / separate decision | No U4-A package surface change. | Existing language-preservation test above is the guard. Any future runtime prompt localization needs its own hook/prompt contract and cannot be bundled into CLI output U4-B. | No U4-B action from this audit. |

## Coverage Summary

- Already localized: interactive intake's Korean prompts, choices, retry
  message, and project-note prompt. This is partial workflow coverage, not a
  general locale system.
- English-only human candidates: root help/language, doctor, attach/init/go,
  workflow status/check, relay prose, evidence/feedback, and error prose.
- Intentional machine contracts: command/flag names, paths, status words,
  JSON keys, schema versions, enum values, role IDs, blocker IDs, and artifact
  filenames.
- Contract-blocked: finish plaintext, closure follow-up rendering, and any
  human formatter coupled to exact snapshot/consumer expectations.
- Out of scope: runtime-injected prompt blocks, detector input lexicon, and
  internal structured runtime warnings.

No current code path was found that takes the profile `user-language` answer
and selects a translated CLI formatter. The profile question and language
listing therefore must not be documented as proof of end-to-end Korean CLI
coverage.

## Recommended Acceptance Units

1. U4-B1: root help, `ph language`, and interactive-intake parity. Keep
   command names, flags, profile IDs, and choice values stable.
2. U4-B2: doctor/reachability/platform plus attach/init/go human messages.
   Preserve exit codes, stderr placement, and one next action/command where
   currently required.
3. U4-B3: workflow status/check and finish plaintext. Use exact fixture updates
   and preserve finish authority, truthful next-action cardinality, and no
   `finish --json` surface.
4. U4-B3-J: closure JSON compatibility audit. Keep keys, schema, enum values,
   blocker IDs, and paths unchanged; decide separately whether any `reason`
   strings may be localized.
5. U4-B4: relay, evidence, and feedback human formatters. Keep advanced
   preview, report-only, and no-claim boundaries explicit.

Each future unit needs a locale-selection rule, positive/negative output
fixtures, exact stdout/stderr and exit assertions, and package smoke. U4-A
does not authorize bulk translation, default changes, schema changes, command
changes, version/release movement, runtime hooks, or product-quality,
efficacy, reliability, security, or token-saving claims.
