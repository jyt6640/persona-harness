# Harness Default Audit

## Status

This is the P1 STEP 1 documentation-only audit of every field loaded through
`HarnessConfig`. It records current behavior at exact source snapshot
`d91a55395ed0afc46ac5305786dac40c9726595c`.

This record does not change a default, authorize a runtime feature, or make
`--strict` a remediation command. The future attach column is a design input
for a later separately accepted STEP; it is not implemented behavior.

## Classification Vocabulary

- **measured-negative**: keep off. Reopening requires a separate measurement
  and release decision.
- **gate integrity**: participates in closure, verification, TDD, or convention
  authority.
- **onboarding branch**: selects project/profile/rule setup behavior.
- **UX**: paths, budgets, telemetry, previews, or master switches that shape
  operation without independently deciding completion.
- **dead flag**: parsed configuration with no production reader.

## Full Matrix

`bootstrap` means ordinary `ph bootstrap backend` with no opt-in preview or
strict flag. A value shown as `default` is omitted by the shipped template and
therefore resolved by `DEFAULT_CONFIG`.

| flag | classification | default | bootstrap value | `--strict` value | future attach value | intent | evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `enabled` | UX | `true` | `true` | unchanged | `true` | Master runtime-hook switch. It does not bypass CLI closure authority. | `src/config/harness-config.ts:93-100,365-378`; `src/runtime/hooks.ts:235-245` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `rulesDir` | UX | `.persona/rules` | `.persona/rules` | unchanged | same as bootstrap | Rule-catalog and delivery root. | `src/config/harness-config.ts:93-97,365-369`; `src/rules/rule-loader.ts:141-182` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `evidenceDir` | UX | `.persona/evidence` | `.persona/evidence` | unchanged | same as bootstrap | Shared evidence root for runtime and diagnostic records. | `src/config/harness-config.ts:93-100,365-370`; `src/runtime/hooks.ts:106-130`; `src/runtime/token-telemetry.ts:103-109` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `conventions.<id>` | gate integrity | registry defaults | template overrides two IDs; remaining IDs use registry defaults | unchanged | same as bootstrap | Selects report/warn/block request level; effective block eligibility remains constrained by convention metadata. | `src/config/harness-config.ts:93-95,296-311,365-367`; `src/cli/architecture-conventions.ts:110-115` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `features.runtimeInjection` | measured-negative | `false` | `false` | `true` | **`false`** | Measured-negative model-facing runtime guidance. Future attach must not enable it. | `src/config/harness-config.ts:26-28,98-100,188-194`; `src/cli/bootstrap-strict.ts:42-76`; `src/runtime/hooks.ts:106-140` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `features.entrySteering` | UX opt-in | `false` | `false` | unchanged | **`false`** | Default-off OpenCode advisory for the first user message of the latest selected session; separate from measured-negative runtime injection and never an automatic workflow transition. | `src/config/harness-config.ts:26-29,94-102,190-198`; `src/runtime/entry-steering-status.ts:41-111`; `src/runtime/hooks.ts:357-371` @ `e3009b8c9183e1123c6a18efc8e7dfb9702f8b36` |
| `enforce.compaction.enabled` | UX | `false` | default `false` | unchanged | same as bootstrap | Opt-in token-compaction trigger. | `src/config/harness-config.ts:48-52,101-106,197-205`; `src/runtime/token-compaction.ts:214-224` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `enforce.compaction.cooldownMs` | UX | `600000` | default `600000` | unchanged | same as bootstrap | Minimum spacing between compaction attempts. | `src/config/harness-config.ts:48-52,101-106,197-205`; `src/runtime/token-compaction.ts:254-280` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `enforce.compaction.threshold` | UX | `0.78` | default `0.78` | unchanged | same as bootstrap | Measured context-ratio threshold for the opt-in compaction path. | `src/config/harness-config.ts:48-52,101-106,197-205`; `src/runtime/token-compaction.ts:247-252` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `enforce.executeVerification` | gate integrity | `false` | `false` | `true` | **`true` only** | Runs PH-owned verification directly when true. False remains evidence-only and makes TDD execution/closure advisory. | `src/config/harness-config.ts:30-36,101-120,173-185`; `src/cli/workflow-closure-verification.ts:24-52`; `src/cli/workflow-tdd.ts:41-50,84-97`; `src/cli/bootstrap-strict.ts:62-76` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `enforce.idleContinuation` | measured-negative | `false` | `false` | unchanged | **`false`** | Measured-negative idle continuation. Future attach must not enable it. | `src/config/harness-config.ts:30-36,101-120,173-185`; `src/runtime/hooks.ts:235-265` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `enforce.ralphLoop.enabled` | measured-negative | `false` | `false` | unchanged | **`false`** | Explicit/default-off blocker continuation loop. Future attach must not enable it. | `src/config/harness-config.ts:54-60,109-118,208-220`; `src/runtime/hooks.ts:235-257`; `src/runtime/ralph-loop.ts:127-146` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `enforce.ralphLoop.cooldownMs` | measured-negative | `30000` | `30000` | unchanged | same as bootstrap | Retry cooldown used only when ralph-loop is explicitly enabled. | `src/config/harness-config.ts:54-60,109-118,208-220`; `src/cli/workflow-ralph-loop.ts:75-99` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `enforce.ralphLoop.maxAttempts` | measured-negative | `3` | `3` | unchanged | same as bootstrap | Per-blocker retry cap for the disabled-by-default loop. | `src/config/harness-config.ts:54-60,109-118,208-220`; `src/cli/workflow-ralph-loop.ts:93-99` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `enforce.ralphLoop.maxSessionAttempts` | measured-negative | `9` | `9` | unchanged | same as bootstrap | Per-session retry cap, normalized to at least `maxAttempts`. | `src/config/harness-config.ts:54-60,109-118,208-220`; `src/cli/workflow-ralph-loop.ts:93-99` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `enforce.ralphLoop.toolOutputTrigger` | measured-negative | `false` | default `false` | unchanged | **`false`** | Selects the optional tool-output trigger instead of idle; inactive while ralph-loop remains off. | `src/config/harness-config.ts:54-60,109-118,208-220`; `src/runtime/hooks.ts:249-257`; `src/cli/workflow-ralph-loop.ts:84-91` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `enforce.systemConstitution` | measured-negative | `false` | `false` | `true` | **`false`** | Measured-negative system prompt prose. Future attach must not enable it. | `src/config/harness-config.ts:30-36,101-120,173-185`; `src/cli/bootstrap-strict.ts:62-76`; `src/runtime/system-constitution.ts:16-31` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `enforce.tdd` | gate integrity | `false` | default `false` | unchanged | same as bootstrap | Requests TDD closure evidence; without direct verification its result is advisory/unavailable. | `src/config/harness-config.ts:30-36,101-120,173-185`; `src/cli/workflow-tdd.ts:84-109` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `enforce.writeDeny` | dead flag | `false` | `false` | unchanged | same as bootstrap | Parsed experimental no-op. Retain for now; removal requires a separate compatibility decision. | `src/config/harness-config.ts:37-45,101-121,173-185,365-378` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `telemetry.tokenUsage` | UX | `true` | default `true` | unchanged | same as bootstrap | Records assistant token telemetry and model context limits for measurement/compaction. | `src/config/harness-config.ts:62-64,123-125,276-283`; `src/runtime/hooks.ts:235-245,389-399`; `src/runtime/token-telemetry.ts:195-225` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `multiAgent.enabled` | UX | `false` | `false` | unchanged | same as bootstrap | Opt-in Role Checklist Relay and session-registry mode; enabled only by the preview path. | `src/config/harness-config.ts:76-80,126-130,285-293`; `src/cli/bootstrap-multi-agent.ts:129-152`; `src/cli/workflow-relay.ts:116-132` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `multiAgent.roles` | UX | `test-writer, implementer, reviewer` | same | unchanged | same as bootstrap | Relay role order and artifact ownership order. | `src/config/harness-config.ts:66-80,247-258,285-293`; `src/cli/workflow-relay.ts:116-120`; `src/cli/workflow-role-boundary.ts:99-104` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `multiAgent.models` | UX | `{}` | `{}` | unchanged | same as bootstrap | Optional model hints consumed when generating OpenCode role agents; not a PH model-selection authority. | `src/config/harness-config.ts:76-80,261-293`; `src/cli/bootstrap-multi-agent.ts:114-121,129-167` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `maxRulesPerInjection` | UX | `12` | `12` | unchanged | same as bootstrap | Caps delivered/injected rule count. | `src/config/harness-config.ts:20-23,131-135,365-378`; `src/rules/rule-delivery.ts:120-143`; `src/runtime/injection.ts:83-91` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `evidenceMode` | dead flag | `metadata_only` | `metadata_only` | unchanged | same as bootstrap | Parsed and normalized but not read by production behavior. Retain until a separate compatibility decision. | `src/config/harness-config.ts:20-23,131-135,169-170,365-378` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `enabledDomains` | UX | `backend, programming, workflow` | same | unchanged | same as bootstrap | Limits runtime rule/skill/intent surfaces by domain. | `src/config/harness-config.ts:20-23,131-135,365-378`; `src/runtime/hooks.ts:165-196`; `src/runtime/intent-workflow.ts:129-139` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |
| `scenario` | onboarding branch | `step1` | `step1` | unchanged | inferred profile path; no default change | Selects scenario-aware rule contracts and delivery. | `src/config/harness-config.ts:20-23,131-135,165-170,365-378`; `src/rules/rule-loader.ts:141-165`; `src/rules/rule-delivery.ts:120-140` @ `d91a55395ed0afc46ac5305786dac40c9726595c` |

The shipped template values referenced above are recorded in
`.persona/harness.jsonc:1-32 @ d91a55395ed0afc46ac5305786dac40c9726595c`.
Ordinary init copies that template and writes project-local OpenCode plugin
configuration at `src/cli/init.ts:128-138,166-206 @
d91a55395ed0afc46ac5305786dac40c9726595c`. Ordinary bootstrap calls the
strict mutator only when `--strict` is present at
`src/cli/bootstrap.ts:352-380 @
d91a55395ed0afc46ac5305786dac40c9726595c`.

## Dead Flags

Repository-wide production-source reader search found two parsed fields with
no behavior reader:

1. `enforce.writeDeny`
2. `evidenceMode`

Both remain in `HarnessConfig` and its parser. This STEP does not remove or
reinterpret them. `writeDeny` is explicitly documented in the type as a known
runtime no-op because the available host surfaces split proposed-content
visibility from deny authority (`src/config/harness-config.ts:37-45 @
d91a55395ed0afc46ac5305786dac40c9726595c`).

Audit method:

```bash
rg -n '\bconfig\.<field>\b' src --glob '*.ts'
rg -n '\b(writeDeny|evidenceMode)\b' src --glob '*.ts'
```

Parser-only occurrences were not counted as production readers. Tests and
historical docs were also not counted as runtime behavior.

## Path Differences And Defect

### `executeVerification`

- Default: `false`.
- Ordinary init/bootstrap: remains `false`.
- `--strict`: changes it to `true`.
- Future attach proposal: changes only this enforcement field to `true`; it
  must leave all measured-negative fields false.

When false, PH does not directly run project verification during closure.
Structured evidence can still establish pass/fail, while report text alone
cannot establish success (`src/cli/workflow-closure-verification.ts:24-52 @
d91a55395ed0afc46ac5305786dac40c9726595c`). The TDD command reports that no
red/green evidence was written, and TDD closure becomes advisory/unavailable
(`src/cli/workflow-tdd.ts:41-50,84-97 @
d91a55395ed0afc46ac5305786dac40c9726595c`).

### `--strict` Bundling Defect

`enableStrictClosureVerification` sets all of the following in one mutation:

- `enforce.executeVerification=true`
- `enforce.systemConstitution=true`
- `features.runtimeInjection=true`

Evidence: `src/cli/bootstrap-strict.ts:42-76 @
d91a55395ed0afc46ac5305786dac40c9726595c`.

This couples a gate-integrity control to two measured-negative controls. P1
must not recommend `--strict` as remediation. Unbundling is a separate future
tranche candidate; this audit does not change the implementation.

## STEP 2 Semantic Dictionary

The later doctor surface should use these meanings:

- `executeVerification=false`: `PH-run verification OFF — evidence-only mode,
  TDD rail advisory`.
- measured-negative fields false: intentional retained state, not a diagnosis
  of failed session reachability.
- `writeDeny` and `evidenceMode`: parsed compatibility fields with no current
  production behavior; do not present them as active enforcement.
- `--strict`: never suggest as a remediation command because it also enables
  measured-negative runtime injection and system constitution.

## Boundaries

- No config default changed.
- No bootstrap, strict, attach, doctor, runtime, hook, or schema behavior
  changed.
- No measured-negative feature was enabled or recommended.
- Dead flags were reported only; they were not removed.
