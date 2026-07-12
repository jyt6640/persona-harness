# P2 Baseline Synchronization

Status: investigation baseline. This document adopts the full P2 E/U/T/R
backlog for scoped investigation only. It authorizes no automatic
implementation, activation, default promotion, schema migration, release, or
package version change.

## Exact Baseline

This baseline is the canonical source snapshot
`633b4bca4bc7b7292f37ac109c8028df1385a9ae`. The published `0.7.0-rc.2`
package came from `185885b7918459ef12bbea120a4261962cd57059`.

- `0.7.0-rc.2` is next-channel pilot/package evidence, not stable evidence.
- The live release facts are `latest=0.6.0` and `next=0.7.0-rc.2`.
- A future `0.7.0` stable release is a separate release gate, not an assumed
  P2 prerequisite or conclusion.
- The audit inventory is `src/cli`: 121 files, `workflow-*`: 34 files, and
  `go`/`attach` family: 17 files. These are scope facts, not refactor targets.

## Existing Surfaces And Boundaries

| Surface | Observation at `633b4bc` | P2 boundary |
| --- | --- | --- |
| Defaults | `entrySteering`, `runtimeInjection`, `executeVerification`, `idleContinuation`, `ralphLoop.enabled`, `systemConstitution`, and `writeDeny` default false. `src/config/harness-config.ts:94-136 @ 633b4bc` | No P2 item changes a default without a separate accepted default/release decision. |
| Doctor and attach | Doctor reads/reports current state; attach is the bounded project-local writer. `src/cli/doctor.ts:189-236,249-339 @ 633b4bc`; [`agents-managed-block-contract.md`](agents-managed-block-contract.md) | Doctor remains inspection-only. P2 does not authorize `doctor --fix`; existing weak-only repair remains an explicit attach concern. |
| Rail body cache | `workflow-rail-body-cache.1` suppresses unchanged full text across check/continue/implement, with `--full` escape. `src/cli/workflow-rail-cache.ts:7-35,94-122 @ 633b4bc` | T2 must measure residual overlap beyond this cache before proposing any surface. |
| Evidence telemetry | Existing metrics aggregate token and finish data; A/B and P-minus are decision support only. `src/cli/evidence-summary.ts:51-104`, `src/cli/evidence-ab-run.ts:17-107`, `src/cli/evidence-pminus-report.ts:67-79 @ 633b4bc` | Measurements cannot imply token saving, efficacy, quality, or reliability. |
| Ticket/relay surfaces | Task cards have `workflow-task-card.2` and generic prose scope, not a declared source-path contract. `src/cli/workflow-ticket-model.ts:28-40,149-194 @ 633b4bc` | E2 needs a contract first. Existing red/green evidence, relay artifacts, role-boundary report-only output, and role/stage rule delivery are not new enforcement authority. |
| Java warnings | Initial Java rules are warn-only with `blockAllowed: false`; configured block is demoted when blocking is disallowed. `.persona/conventions/java-{raw-type,optional-get,mutable-static}.yml:4-9`; `src/cli/architecture-conventions.ts:110-116 @ 633b4bc` | E4 is a per-rule evidence decision. Nothing is promoted automatically. |

P2 leaves `runtimeInjection=false`, existing commands, existing workflow/evidence
schemas, release state, and registry tags unchanged. It does not claim
generated-app certification, security, token saving, efficacy, app quality,
broad reliability, automatic repair, or role enforcement.

## Common Acceptance And Version Rule

Every unit needs a source/contract snapshot, a preregistered fixture or
measurement protocol, QA, and a package/mutation proof appropriate to its
surface.

| Change class | Required before merge | Version rule |
| --- | --- | --- |
| Docs or source-only investigation | Deterministic index/check and QA | No package version change by itself. |
| Report-only observation | Positive/negative fixtures or bounded real-use measurement and package proof | Separate prerelease/release decision; no default follows from observation. |
| Warn, block, default, or public CLI | Precision evidence, no-worse gate/package smoke, explicit product owner decision | Separate release candidate decision; never promoted by this document. |
| Config migration | Old/new/malformed fixtures, rollback/readability policy, and explicit compatibility contract | U6 is its own compatibility tranche and release decision. |

## E: Evidence And Gate Candidates

| ID | Scope and precision | Dependency and acceptance | Version rule |
| --- | --- | --- | --- |
| E1-A1 | Assertionless or empty `@Test` candidates, first measured as WARN-only. The detector must distinguish valid framework patterns before calling a result a warning. | Java test catalog; positive/negative fixtures; dated precision observation before any shipped warning. | Report-only first; a warning needs separate release approval. |
| E1-A2 | Disabled tests are a separate framework/annotation candidate, not an E1-A1 extension. | Runner/annotation catalog; add/remove/unchanged fixtures; dated precision observation. | No automatic warning or block. |
| E1-B | Deletion or assertion-count reduction remains lower-precision contextual diff observation. | E2 scope contract and human-reviewed fixture protocol. | Investigation/report-only only. |
| E2 | Ticket-scope diff guard requires a declared ticket scope contract before it can examine a diff. | Compatibility design for structured scope, old/new/malformed fixtures, normalized paths/renames. | Any schema or public contract is a separate compatibility/release unit. |
| E3-A | Filesystem residue is a separate measurement-first candidate with declared output roots and exemptions. | Deterministic path catalog; positive/negative fixtures; no-delete proof. | No cleanup automation; warning requires separate release approval. |
| E3-B | AST/comment residue is separate from E3-A because syntax/comment evidence has different precision. | Language catalog; positive/negative fixtures; dated precision observation. | Report-only until separately accepted. |
| E4 | A per-rule warning-to-block promotion review for the existing Java rules. | Matched false-positive evidence, fix-path review, fresh package/gate smoke, named rule owner. | Current three remain warn-only; every promotion is a separate release decision. |
| E5 | A role handoff gate after actual relay artifact sequencing is observed. | Missing/late/wrong-role fixtures and host-independent path. | Report-only first; no automatic host-subagent or enforcement claim. |

## U: Usability And Compatibility Candidates

| ID | Scope | Dependency and acceptance | Version rule |
| --- | --- | --- | --- |
| U1 | Possible entry-steering default promotion. | Bounded real-session protocol, same-session/no-identity/cross-session fixtures, and product owner decision. | Default-off remains until a separate default/release decision. |
| U2 | After U6 boundaries are defined, document only safe doctor-to-attach guidance. | Doctor remains inspection-only; prove no doctor write and preserve explicit weak-only attach repair. No config migration is authorized here. | `doctor --fix` is incompatible with the current contract and is not a P2 unit. |
| U3 | Human status surface is a user-decision item independent of U5. | Audience, source-of-truth, stale/malformed data, privacy/output policy, and explicit product decision. | A public CLI requires a separate release decision. |
| U4 | Localized public-output audit. | Source message map, locale coverage/link assertions, and language review. | Text change only after normal release review; no behavior claim. |
| U5 | Local package/plugin/AGENTS alignment diagnostics, independent of U3. | Defined project-local identity sources, unavailable/ambiguous fixtures, and user decision. | No global-host claim or automatic remediation. |
| U6 | Standalone migration compatibility tranche: design, then pure migration, then explicit command/doctor work as separate units. | Old/new/malformed/unknown config corpus, readable-old-config and rollback policy, explicit owner. | No schema marker, migration, or default change in P2-0; each later unit has its own release decision. |
| U7 | A finish-feedback request is incompatible with current finish authority unless a separate wording/product decision authorizes it. | Finish PASS/BLOCK/no-input/non-interactive analysis and an explicit product decision. | No feedback prompt, status effect, closure mutation, or finish-authority change is authorized. |

## T: Measurement And Delivery Candidates

| ID | Scope | Dependency and acceptance | Version rule |
| --- | --- | --- | --- |
| T1-A | Aggregate token and finish observations first, with an explicit verified-completion definition. | R2-B dated baseline and matched scenarios; preserve limitations. | Measurement only; no token-saving claim. |
| T1-B | Only after T1-A, assess tokens per verified completion. | Stable aggregation semantics and paired observations. | No default or release effect by itself. |
| T2 | Measure residual/duplicate rail content after the existing body cache, not a replacement cache. | T1-A baseline; compare full/cache/changed-stage output; preserve `--full` and broad gates. | No output surface change until a separate candidate passes. |
| T3 | Stable prefix/order investigation is overlap-aware with T2 and existing role/stage delivery. | Prompt/rail inventory and wording regression protocol. | No cache/token claim or implicit output change. |
| T4 | Verbose-delivery cap is evidence-gated. | T2 residual results, required-line coverage, and no-worse gate/finish fixtures. | Separate release decision for any behavior change. |
| T5 | Duplicate-rule delivery measurement is overlap-aware with current role/stage delivery and T2/T3. | Deterministic duplicate report and required-rule coverage. | No gate weakening or release change without a separate unit. |
| T6 | Paired role-scoped A/B is evidence-gated and must not duplicate existing telemetry. | T1 baseline, T2-T5 candidate rationale, matched fixtures, declared kill criteria. | Decision support only; no efficacy/reliability/default claim. |

## R: Repository And Research Candidates

| ID | Scope | Dependency and acceptance | Version rule |
| --- | --- | --- | --- |
| R2-A | First define a consent-safe scenario manifest. | Support matrix and named release owner; no stable-version premise. | Source-only planning. |
| R2-B | Create a dated local-current baseline from the manifest; RC2 remains pilot/package evidence, not stable evidence. | R2-A; preregistered limitations and evidence review. | No release recommendation follows automatically. |
| R3 | Audit compatibility between repository corpus/reference material, current docs, and package inclusion. It is not a causal-history claim. | Exact inventory, package list, and direct-link policy. | Classification has no default/schema/release effect. |
| R1 | Last: a move-only `src/cli` decomposition investigation. | Completion of earlier contracts; import/call graph; help/package comparison; no-behavior fixtures. | No version change unless a released surface actually changes. |

## Required Ordering

The following is dependency ordering, not an automatic execution queue:

1. `R2-A` scenario manifest, then `R2-B` dated baseline, then `T1-A`
   token/finish aggregation.
2. Run the separate measurement-first candidates `E1-A1`, `E1-A2`, `E3-A`,
   and `E3-B`; do not combine their precision claims.
3. Treat `U5` and `U3` as independent user-decision units. Design `U6`, then
   its pure migration, then any explicit command/doctor unit. Consider `U2`
   only after those boundaries, while doctor remains inspection-only.
4. Require the ticket-scope contract before `E2`. Keep `U7` parked pending a
   wording/product decision that preserves finish authority.
5. Keep `U1`, `E4`, `T2`, `T4`, `T5`, `T6`, and `E5` evidence-gated.
6. Consider `R1` last and only as a move-only, behavior-preserving unit.
