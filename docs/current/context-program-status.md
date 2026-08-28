# Context Personalization Program Status

Status: current canonical program record.

Last audited: 2026-08-28
Audited source: `f677a635040ad55d8b7d25abab280c5703a153ea`
Program issue: [#389](https://github.com/jyt6640/persona-harness/issues/389)
Current bounded issue: [#403](https://github.com/jyt6640/persona-harness/issues/403)

## Purpose

Persona Harness has two distinct responsibilities:

1. **Workflow Integrity** decides whether evidence is sufficient for a
   completion claim. Its existing commands, evidence, verification, and
   authority semantics remain authoritative and compatibility-sensitive.
2. **Context Personalization** selects a small, deterministic set of relevant
   conventions and renders a host-neutral Context Envelope. It is an
   experimental, local-first, explicit opt-in track and remains default-off.

The Context track may advise a coding host. It must not create workflow state,
grant completion authority, execute project commands, contact GitHub, or turn
local preferences into a product-efficacy claim.

## Pre-change Baseline

The audit used a clean worktree based on the exact source above. The original
developer worktree was not modified.

| Command | Result | What the result means |
| --- | --- | --- |
| `npm ci` | PASS | 209 packages installed. `npm audit` reported 2 moderate and 5 high findings; no automatic fix was applied. |
| `npm test` before `npm run build` | CODE_FAILURE | `dist/cli/index.js` did not exist. The default test contract depends on prebuilt output. |
| `npm run typecheck` | PASS | The current TypeScript source type-checks. |
| `npm run build` | PASS | Current source builds successfully. |
| `npm test` after build | PASS, insufficient contract | It only runs `node dist/cli/index.js --help`; it does not execute the repository test suite. |
| `npm run test:package` | PASS, insufficient contract | Despite its name, it is the same CLI-help smoke and does not materialize or install a package. |
| `npm run test:repository` | ENVIRONMENT_BLOCKED | Scope/docs/release checks and Vitest completed with 368 files, 2,623 passing tests, and 1 skipped test. The later authoritative-bundle package contract stopped because `PERSONA_HARNESS_OBSERVER_GH` was unavailable. This is not a source-test failure. |
| `npm pack --dry-run --json` | PASS | The first sandboxed attempt was environment-blocked by the package build lock. With normal worktree write access it produced 1,553 entries for version 0.8.32. |

These labels distinguish a code failure from an environment prerequisite. An
environment-blocked command must not be reported as a product failure or PASS.

## Existing Product Boundaries

### CLI and public identity

- The public help presents Persona Harness as one command family centered on
  workflow gates, authority, feedback, and philosophy.
- There is no `ph context` namespace and no public Context Envelope schema.
- The README correctly keeps broad runtime injection default-off because its
  measured paired OpenCode result did not show value.
- The roadmap lists team/project convention capture as later work and forbids
  token-saving or generated-app-quality claims without measurement.

### Profile and resolver

- `src/cli/personalization-profile-model.ts` and
  `src/cli/personalization-profile-store.ts` provide versioned, local profile
  records for personal, project, and task decisions.
- `src/runtime/effective-profile.ts` is pure and deterministic, but its current
  precedence is `invariant > task > project > personal > starter`.
- The resolver has bounded capsule counts and rejects ambiguity, yet it has no
  Team Profile, language/common layers, character budget, shadow explanation,
  or Context Envelope output.
- `.persona/project-profile.jsonc` is the current project philosophy source.
  It is distinct from the user-scoped personalization store.

### Rendering and host integration

- `src/runtime/runtime-context.ts` already provides canonical serialization
  and SHA-256 section/aggregate digests.
- Rendered section objects still contain host-facing body text; they are not a
  host-neutral Context Envelope contract.
- OpenCode is the only implemented runtime host. The portable shared-skill
  adapter is not a Context Envelope adapter.
- `src/runtime/store.ts` provides bounded per-session delivery and digest
  deduplication that a future adapter can reuse.

### Coupling and growth

- `src/runtime/hooks.ts` is 648 lines with 39 imports. It coordinates session
  lifecycle, evidence, workflow intent, interviews, telemetry, continuation,
  personalization, Java discovery, skill routing, updates, and injection.
- `src/cli/` contains 235 files and `src/runtime/` contains 58 files.
- `scripts/` contains 254 files, including 98 version-specific Consumer
  Authority acceptance schema modules; docs retain 61 related versioned JSON
  records. Historical evidence is valid, but new behavior must use manifests
  and generic runners rather than another version-named runner.

### CI

- Pull-request CI already separates fast feedback, parallel tests, and
  resource-sensitive tests, then aggregates them under `Verify repository`.
- Main-only package integration and canonical receipt building remain outside
  the PR critical path.
- The retained measurement records a PR Verify reduction from a 9m54 median to
  4m03 on the measured run. This is existing verified work, not a new claim of
  this program.

## P0 Problem Matrix

| Item | Classification | Audited state | Required P0 boundary |
| --- | --- | --- | --- |
| M1 | locally complete, integration pending | Broad legacy `runtimeInjection` is default-off; a narrow project philosophy feature exists separately. A distinct `context` parser now defaults to off and is controlled only by `context.enabled`. | Preserve the separate enablement boundary. |
| M2 | partially closed-local | Personal/project/task profile records, the exact v1 resolver, pure v2 precedence, read-only target-path inspection, and an explicit fresh-project Context enable path now live behind `src/context-core` and `ph context`. | Preserve the no-overwrite initialization boundary; inspection and enablement must not activate a host. |
| M3 | locally complete, integration pending | A read-only `.persona/team-profile.json` loader validates shared Team rules, rejects unsafe/no-follow inputs, and converts valid rules to Core `teamContracts`. | Preserve its file boundary while later exposing it through explicit Context CLI inspection only. |
| M4 | locally complete, integration pending | Pure Core now supports all seven precedence layers and builds a `persona-context-envelope.v1` with deterministic selected/shadowed/conflict metadata, budget, privacy filtering, and canonical digest. | Preserve the Core boundary while later adding only a thin adapter backed by a real host API. |
| M5 | locally complete, hosted observation pending | Context Core has no OpenCode or Java runtime import. An isolated OpenCode 1.x adapter now reads the local preview boundary after a safe observed target and delivers one bounded block on the next same-session user message. | Keep Core host-neutral; validate the experimental host transform only through #410's separate bounded Hosted observation. |
| M6 | locally complete, hosted observation pending | The effective-profile resolver and its parsing/types remain separated in `src/context-core`; the adapter has no legacy runtime/evidence/workflow/authority/process/network dependency. | Preserve the isolated adapter boundary while observing the actual host API. |
| M7 | verified-existing / open | Version-specific acceptance files have accumulated. | Use a manifest plus generic runner for new Context compatibility cases. |
| M8 | closed-local | The baseline help-only contract was replaced locally by focused source tests, explicit smoke/full commands, and a generic tarball/install package smoke. | Integrate only after the local candidate is reviewed; protected CI remains unchanged. |
| M9 | locally complete, hosted observation pending | `ph context status` and `ph context doctor` report the bundled OpenCode 1.x adapter plus its target-triggered eligibility without claiming a session loaded it. Preview/explain remain read-only. Bare init creates no state; `ph context init --enable` creates a minimal config only when no harness config exists. | Confirm the packaged plugin against a real host only through #410's named Hosted observation. |
| M10 | open | No Context OFF/broad/targeted benchmark. | #411 adds a reproducible benchmark that reports cost and task result separately. |
| M11 | verified-existing / open | Historical version checks are mostly one-off scripts. | #412 adds a Context compatibility manifest and generic test runner. |
| M12 | verified-existing | CI critical-path optimization is already measured and active. | Preserve it and add only bounded Context checks to the correct lane. |

## Invariants

- Workflow commands, evidence, verification, and completion authority keep
  their current semantics.
- Existing configuration remains valid; missing Context configuration means
  Context is off.
- Context resolution is pure: no shell, GitHub, network, evidence mutation, or
  workflow mutation.
- Team input is local and safe-by-default. Secrets and raw sensitive values are
  never rendered into an envelope or diagnostic.
- Ambiguous precedence, malformed input, unsafe paths, and budget overflow fail
  closed with bounded diagnostics.
- New public behavior receives RED-to-GREEN tests before implementation.
- No external value or adoption claim is made without independent users and
  repositories. Current product-value verdict: **INCONCLUSIVE**.

## Bounded Delivery Order

1. **#390 P0 baseline and status:** this audit and canonical record.
2. **Contributor test contract:** make default test names match what they
   actually prove while preserving full protected verification.
3. **Context Core:** versioned input, safe Team Profile, precedence, relevance,
   character budget, shadowing, warnings, and digest.
4. **Context CLI and OpenCode adapter:** explicit opt-in, read-only inspection,
   thin host rendering, deduplication, and session cleanup.
5. **Hosted, benchmark, and compatibility:** #410 observes the real OpenCode
   boundary once; #411 measures OFF/targeted behavior; #412 adds a generic
   compatibility manifest and runner.

Only one public command, schema, resolver, adapter, CI, script, or documentation
boundary is changed per child issue. A child issue closes only when its stated
observable and fail-closed cases are proven. Technical completion does not
promote the Context track to a product-value claim.

## Local Candidate Progress

| Issue | State | Evidence |
| --- | --- | --- |
| #390 | locally complete, integration pending | Canonical status, current docs navigation, inventory, docs taxonomy, acceptance index, release notes, and release truth checks pass. |
| #391 | locally complete, integration pending | `npm test` now owns a dual-surface contract: a source checkout runs the bounded fast suite, while an installed tarball runs a packaged CLI-help smoke through the same command. The generic runner is included in the tarball, and the package smoke proves the installed `npm test` contract rather than only calling help directly. Tests reject cycles, missing aliases/files, help-only source defaults, empty-test escape hatches, duplicate unit/integration files, and package-to-smoke collapse. The source suite, typecheck, scope/docs checks, isolated package smoke, and resource-sensitive repository contract pass locally. |
| #392 | locally complete, integration pending | Root help and README name both product tracks. The independent import-free Context dispatcher exposes five commands, creates no files, keeps Context disabled, reports no shell/network use, and blocks preview/explain with `context-core-unavailable`. Routing, compatibility, fast test, typecheck, build, docs, and isolated package smoke checks pass. |
| #393 | locally complete, integration pending | `src/context-core` now owns v1 rule types, strict input parsing, deterministic resolution, a frozen default budget, canonical SHA-256 digest, and envelope types. The legacy runtime module is a compatibility re-export. Import-boundary, resolver, profile store, runtime delivery, and public export checks pass (31 focused tests); fast tests, typecheck, build, docs, scope, diff, and isolated package smoke pass. |
| #394 | locally complete, integration pending | The Core adds `invariant > task > project > team > personal > language > common` precedence, topic/file-role/language/skill/scope relevance, deterministic shadow explanations, winning-layer conflict blocking, and no-silent-truncation overflow handling. The v1 adapter maps starter defaults to common and preserves the public v1 output. Five focused files (26 tests), fast tests, typecheck, build, docs, scope, diff, and isolated package smoke pass. |
| #395 | locally complete, integration pending | The Core constructs `persona-context-envelope.v1` from resolution-only input. It canonicalizes selected capsules, shadow/conflict metadata, budget use, and SHA-256 digest; it blocks malformed targets, untrusted/unsafe content, blocked resolution, and budget overflow without reflection or truncation. Envelope/Core focused tests, fast tests, typecheck, build, docs, scope, diff, and isolated package smoke pass. |
| #396 | locally complete, integration pending | A read-only `.persona/team-profile.json` loader uses the existing no-follow project-file reader, exact schema validation, bounded rules/selectors, and finite diagnostics. It rejects unknown fields, duplicate ids/active topics, secret/shell/exfiltration/authority-shaped rules, and symlink paths. Valid rules become Core `teamContracts`, proven with project > team > personal fixture precedence. Fast tests, typecheck, build, docs, scope, diff, and isolated package smoke pass. |
| #397 | locally complete, integration pending | `.persona/harness.jsonc` now has a separately typed `context` configuration with a frozen disabled `targeted` default and bounded capsule/character limits. Missing Context config stays off; explicit `context.enabled` is independent from legacy guidance switches; malformed, unknown, and out-of-range Context fields return a finite Context-only diagnostic and disabled effective Context config without rewriting files or disabling legacy harness behavior. `npm test` (8 files, 49 tests), typecheck, build, docs/scope/diff checks, and isolated `test:package` smoke pass locally. |
| #398 | locally complete, integration pending | `ph context status` now uses only the existing config and safe Team Profile readers. It renders bounded configuration/enablement/budget/Team Profile state and diagnostics, never profile/rule content. It does not write files, activate an adapter, execute workflow/authority/evidence behavior, or call network/shell/process commands. Focused status/config/team tests, the built CLI invocation, and isolated tarball `context status` smoke pass locally. |
| #399 | locally complete, integration pending | `ph context preview <target-file>` parses only a safe relative target path and optional explicit selectors, never opens the target, then combines product invariants, starter defaults, an optional Team Profile, and active personal rules through the pure Core. It emits either a deterministic `persona-context-envelope.v1` JSON envelope or bounded nonreflective diagnostics. The explicit default-off flag remains informational; preview does not activate any host. Focused CLI/Core/store tests, typecheck, and the isolated tarball smoke cover the public surface. |
| #400 | locally complete, integration pending | `ph context explain <target-file>` reuses the preview read boundary and renders the deterministic envelope's selected and shadowed identifiers, finite selection reasons, resolution state, budget, and digest without rendering rule content. It accepts the same safe explicit selectors, keeps Context default-off, and does not read the target, write configuration, activate a host, or create workflow state. Focused CLI/Core/store tests and the isolated tarball smoke cover the public surface. |
| #401 | locally complete, integration pending | Bare `ph context init` remains a no-write preview. Explicit `ph context init --enable` uses no-follow exclusive creation to write only a minimal `.persona/harness.jsonc` Context configuration in a fresh safe project. Existing regular config files, unsafe paths, and malformed arguments return finite errors without rewriting any configuration. It does not alter legacy feature flags, activate a host, or create completion state. Focused init/status/routing tests and the isolated tarball smoke cover the public surface. |
| #402 | locally complete, integration pending | `ph context doctor` now reuses the safe status readers instead of emitting fixed placeholder state. It reports bounded config/enablement/mode/budget/Team Profile diagnostics and explicitly distinguishes available local Core/CLI inspection from unavailable host delivery. It does not load personal rule content, write state, activate a host, or use network/shell/process/completion behavior. Focused doctor/status/routing tests and the isolated tarball smoke cover the public surface. |
| #403 | locally complete, integration pending | The isolated OpenCode adapter captures only safe observed targets, uses the local Context preview/envelope boundary, suppresses duplicate digests until session compaction/deletion, and mutates only the next matching user message. `context.enabled` is its sole feature switch; it does not inherit `runtimeInjection`. Adapter, actual plugin composition, status/doctor wording, type compatibility, and fail-closed target cases have focused RED-to-GREEN coverage. A real `experimental.chat.messages.transform` host observation remains separate. |

The heavy `test:installed-package-contract` and full protected repository suite
remain unchanged. The generic package smoke is version-neutral and does not
replace release acceptance.

## Candidate Verification And Residuals

The current candidate was exercised in an isolated worktree before any PR or
hosted action:

- `npm test`, `npm run typecheck`, `npm run build`, `npm run check:docs`,
  `npm run check:scope:strict`, `npm run check:release-workflows`, and
  `npm run check:injection-value` pass.
- `npm run test:package` proves the canonical tarball can be installed in a
  clean consumer and that its packaged `npm test` selects the installed smoke.
- `npm run test:repository:resource-sensitive` passes with 10 files and 80
  tests.
- `npm run test:repository:parallel` reaches 2,619 passing tests and one
  skip, then stops at two independent project-finish OIDC caller-pin failures.
  The candidate does not touch the related workflow, producer, or diagnostic
  boundary; the failures are tracked separately in #404 and are not reused as
  Context evidence.
- A real OpenCode `experimental.chat.messages.transform` observation remains
  a hosted-only residual. Local composition and type tests do not establish
  that a host session received Context.

## Owner Dogfooding Follow-up

The private, bounded owner dogfooding store now records the observed fixed
codes without conversation text, paths, or credentials. The remediation
program is #405, with focused follow-ups for project-philosophy diagnostics
(#406), deep-interview control (#407), workflow bootstrap/history diagnosis
(#408), and shared-skill routing observability (#409). These issues do not
expand this candidate or change its default-off Context boundary.

## Next Action

Open one protected integration PR for the frozen #390–#403 candidate after its
final local package and documentation checks. After a successful merge, #410
is the only route for a real OpenCode `experimental.chat.messages.transform`
observation; #411 and #412 remain separate follow-up work. Do not infer host
delivery from local composition tests or catalog registration.
