# Context Personalization Program Status

Status: current canonical program record.

Last reconciled: 2026-08-29
Current protected main: `9b80a45070be10659150095cf701a6f375bc6600`
Released package: [`persona-harness@0.8.33`](https://www.npmjs.com/package/persona-harness/v/0.8.33)
Release lineage: [#414](https://github.com/jyt6640/persona-harness/issues/414) delivered through [#437](https://github.com/jyt6640/persona-harness/pull/437)
Historical pre-integration audit source: `f677a635040ad55d8b7d25abab280c5703a153ea`
Program issue: [#389](https://github.com/jyt6640/persona-harness/issues/389)
Remaining bounded work: [#410](https://github.com/jyt6640/persona-harness/issues/410), [#411](https://github.com/jyt6640/persona-harness/issues/411), [#412](https://github.com/jyt6640/persona-harness/issues/412), and [#421](https://github.com/jyt6640/persona-harness/issues/421)

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

## Historical Pre-integration Baseline

This audit predates #413 and is retained to explain the original gaps and their
deterministic closure. It is not the current source or next-action authority.
The audit used a clean worktree; the original developer worktree was not
modified.

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

## Historical Pre-integration Boundaries

The following observations describe the source before #413. Current delivered
behavior and remaining work are recorded below.

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

## Historical P0 Problem Matrix

This matrix captures the pre-#413 candidate state. It is retained as historical
evidence rather than a description of current protected main.

| Item | Classification | Audited state | Required P0 boundary |
| --- | --- | --- | --- |
| M1 | delivered via #413 | Workflow Integrity and Context Personalization are named as distinct tracks in public help and README. | Preserve the separate product boundary. |
| M2 | delivered via #413 | `ph context` provides explicit, default-off local Context inspection and enablement. | Preserve no-overwrite initialization and non-activating inspection. |
| M3 | delivered via #413; v2 follow-up open | A safe Team Profile v1 is resolved as a separate, local Context layer. | Preserve the no-follow, bounded profile boundary; #421 separately owns a semantic v2 schema and explicit resolver bridge without silently upgrading v1 files. |
| M4 | delivered via #413 | Pure Core resolves the seven precedence layers and produces a deterministic `persona-context-envelope.v1`. | Keep Core host-neutral. |
| M5 | implementation delivered; hosted residual | Core has no OpenCode or Java runtime import; the isolated OpenCode adapter is locally covered. | #410 may observe the real transform only after #414 establishes release lineage. |
| M6 | implementation delivered; hosted residual | Context resolution, rendering, and delivery are separated from legacy workflow/authority behavior. | Preserve the isolated adapter boundary during #410. |
| M7 | open | Historical version checks remain a maintenance concern. | #412 owns the generic Context compatibility manifest and runner. |
| M8 | delivered via #413 | `npm test` now selects focused source evidence and installed packages receive a separate smoke. | Keep full protected verification separate. |
| M9 | implementation delivered; hosted residual | Context CLI and doctor report bounded local state without claiming host delivery. | #410 remains the sole real-host observation route after #414. |
| M10 | local implementation verified, integration pending | #411 adds a versioned three-arm protocol, strict ten-fixture manifest, and a deterministic evaluator for Context OFF, legacy broad compatibility, and targeted layered envelopes. | Keep model, host, and operational measurements unavailable until a separately authorized observation; every local product verdict remains `INCONCLUSIVE`. |
| M11 | open | Historical version-specific checks still need a version-neutral Context compatibility boundary. | #412 owns the manifest/runner work. |
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

## Historical Delivery Order

This was the delivery sequence before #413 and #414. The current gate order is
recorded in the current audit below.

1. **Merged P0 implementation:** #390 through #403 merged and closed through
   #413 on `a562331f9db321845b05da1e16edc4b83bf78ece`.
2. **Release lineage:** #414 must bind an immutable package version and source
   commit that contains the merged Context delivery boundary.
3. **Hosted observation:** only after #414, #410 may observe one real OpenCode
   `experimental.chat.messages.transform` session under its privacy boundary.
4. **Independent deterministic follow-ups:** #421 owns the semantic Team
   Profile v2 schema/bridge; #411 owns the three-arm comparison contract; #412
   owns generic installed-package compatibility coverage.

Only one public command, schema, resolver, adapter, CI, script, or documentation
boundary is changed per child issue. A child issue closes only when its stated
observable and fail-closed cases are proven. Technical completion does not
promote the Context track to a product-value claim.

## Historical Candidate Evidence

The table below captures the frozen pre-#413 candidate. All #390 through #403
are now observed closed after #413 merged; GitHub does not expose a direct
PR-closing reference from each individual issue to #413, so this document does
not assert direct closure causality.

| Issue | State | Evidence |
| --- | --- | --- |
| #390 | closed via #413 | Canonical status, current docs navigation, inventory, docs taxonomy, acceptance index, release notes, and release truth checks pass. |
| #391 | closed via #413 | `npm test` now owns a dual-surface contract: a source checkout runs the bounded fast suite, while an installed tarball runs a packaged CLI-help smoke through the same command. The generic runner is included in the tarball, and the package smoke proves the installed `npm test` contract rather than only calling help directly. Tests reject cycles, missing aliases/files, help-only source defaults, empty-test escape hatches, duplicate unit/integration files, and package-to-smoke collapse. The source suite, typecheck, scope/docs checks, isolated package smoke, and resource-sensitive repository contract pass locally. |
| #392 | closed via #413 | Root help and README name both product tracks. The independent import-free Context dispatcher exposes five commands, creates no files, keeps Context disabled, reports no shell/network use, and blocks preview/explain with `context-core-unavailable`. Routing, compatibility, fast test, typecheck, build, docs, and isolated package smoke checks pass. |
| #393 | closed via #413 | `src/context-core` now owns v1 rule types, strict input parsing, deterministic resolution, a frozen default budget, canonical SHA-256 digest, and envelope types. The legacy runtime module is a compatibility re-export. Import-boundary, resolver, profile store, runtime delivery, and public export checks pass (31 focused tests); fast tests, typecheck, build, docs, scope, diff, and isolated package smoke pass. |
| #394 | closed via #413 | The Core adds `invariant > task > project > team > personal > language > common` precedence, topic/file-role/language/skill/scope relevance, deterministic shadow explanations, winning-layer conflict blocking, and no-silent-truncation overflow handling. The v1 adapter maps starter defaults to common and preserves the public v1 output. Five focused files (26 tests), fast tests, typecheck, build, docs, scope, diff, and isolated package smoke pass. |
| #395 | closed via #413 | The Core constructs `persona-context-envelope.v1` from resolution-only input. It canonicalizes selected capsules, shadow/conflict metadata, budget use, and SHA-256 digest; it blocks malformed targets, untrusted/unsafe content, blocked resolution, and budget overflow without reflection or truncation. Envelope/Core focused tests, fast tests, typecheck, build, docs, scope, diff, and isolated package smoke pass. |
| #396 | closed via #413 | A read-only `.persona/team-profile.json` loader uses the existing no-follow project-file reader, exact schema validation, bounded rules/selectors, and finite diagnostics. It rejects unknown fields, duplicate ids/active topics, secret/shell/exfiltration/authority-shaped rules, and symlink paths. Valid rules become Core `teamContracts`, proven with project > team > personal fixture precedence. Fast tests, typecheck, build, docs, scope, diff, and isolated package smoke pass. |
| #397 | closed via #413 | `.persona/harness.jsonc` now has a separately typed `context` configuration with a frozen disabled `targeted` default and bounded capsule/character limits. Missing Context config stays off; explicit `context.enabled` is independent from legacy guidance switches; malformed, unknown, and out-of-range Context fields return a finite Context-only diagnostic and disabled effective Context config without rewriting files or disabling legacy harness behavior. `npm test` (8 files, 49 tests), typecheck, build, docs/scope/diff checks, and isolated `test:package` smoke pass locally. |
| #398 | closed via #413 | `ph context status` now uses only the existing config and safe Team Profile readers. It renders bounded configuration/enablement/budget/Team Profile state and diagnostics, never profile/rule content. It does not write files, activate an adapter, execute workflow/authority/evidence behavior, or call network/shell/process commands. Focused status/config/team tests, the built CLI invocation, and isolated tarball `context status` smoke pass locally. |
| #399 | closed via #413 | `ph context preview <target-file>` parses only a safe relative target path and optional explicit selectors, never opens the target, then combines product invariants, starter defaults, an optional Team Profile, and active personal rules through the pure Core. It emits either a deterministic `persona-context-envelope.v1` JSON envelope or bounded nonreflective diagnostics. The explicit default-off flag remains informational; preview does not activate any host. Focused CLI/Core/store tests, typecheck, and the isolated tarball smoke cover the public surface. |
| #400 | closed via #413 | `ph context explain <target-file>` reuses the preview read boundary and renders the deterministic envelope's selected and shadowed identifiers, finite selection reasons, resolution state, budget, and digest without rendering rule content. It accepts the same safe explicit selectors, keeps Context default-off, and does not read the target, write configuration, activate a host, or create workflow state. Focused CLI/Core/store tests and the isolated tarball smoke cover the public surface. |
| #401 | closed via #413 | Bare `ph context init` remains a no-write preview. Explicit `ph context init --enable` uses no-follow exclusive creation to write only a minimal `.persona/harness.jsonc` Context configuration in a fresh safe project. Existing regular config files, unsafe paths, and malformed arguments return finite errors without rewriting any configuration. It does not alter legacy feature flags, activate a host, or create completion state. Focused init/status/routing tests and the isolated tarball smoke cover the public surface. |
| #402 | closed via #413 | `ph context doctor` now reuses the safe status readers instead of emitting fixed placeholder state. It reports bounded config/enablement/mode/budget/Team Profile diagnostics and explicitly distinguishes available local Core/CLI inspection from unavailable host delivery. It does not load personal rule content, write state, activate a host, or use network/shell/process/completion behavior. Focused doctor/status/routing tests and the isolated tarball smoke cover the public surface. |
| #403 | closed via #413 | The isolated OpenCode adapter captures only safe observed targets, uses the local Context preview/envelope boundary, suppresses duplicate digests until session compaction/deletion, and mutates only the next matching user message. `context.enabled` is its sole feature switch; it does not inherit `runtimeInjection`. Adapter, actual plugin composition, status/doctor wording, type compatibility, and fail-closed target cases have focused RED-to-GREEN coverage. A real `experimental.chat.messages.transform` host observation remains separate. |
| #411 | local implementation verified, integration pending | `persona-context-comparison-manifest.1` fixes ten P0 fixtures and compares `off`, `legacy-broad`, and `targeted-layered` through `persona-context-comparison-result.1`. The version-neutral `npm run benchmark:context -- ...` runner requires an explicit full candidate commit and package version, then rejects a mismatch with the local Git/package identity before evaluating 30 deterministic records. It emits only rule ids/layers and digests; model/host/operational fields remain `null` and every local product verdict is `INCONCLUSIVE`. |
| #414 | blocked, release/source provenance prerequisite | Stable `v0.8.32` targets a commit before #403. #414 alone owns the next immutable protected-main package/source binding; it must preserve historical releases and does not authorize #410, a host session, or any Context product claim by itself. |

The heavy `test:installed-package-contract` and full protected repository suite
remain unchanged. The generic package smoke is version-neutral and does not
replace release acceptance.

## Historical Candidate Verification And Residuals

The historical candidate was exercised in an isolated worktree before any PR
or hosted action:

- `npm run test:package` materializes the current canonical tarball, installs
  it in a clean consumer, and proves the installed `npm test` and Context CLI
  smoke independently of source fallback.
- Stable `v0.8.32` is historical: its tag targets
  `37e265ecbc9f29d648a24f6b1b37da8151cc336f`, which predates #413. It cannot
  satisfy the source/package binding required for #410.
- #414 alone owns the next immutable package/source provenance binding. Until
  it closes, #410 cannot observe a real host session.
- #421, #411, and #412 are independent deterministic Team Profile,
  comparison, and compatibility work. None may manufacture a host or
  product-effectiveness result.
- Product-value verdict remains **INCONCLUSIVE**. Local composition and type
  tests do not establish that a host session received Context or that users
  benefit from it.

## #411 Comparison Protocol

The P0 comparison runner is repository-side tooling, not an installed user
command. It has no version-specific runner name and requires explicit candidate
metadata so it cannot infer a commit or package version from the checkout:

```bash
npm run benchmark:context -- \
  --candidate-commit <full-current-commit> \
  --package-version <exact-package-version>
```

It emits one `persona-context-comparison-result.1` record for each of the ten
fixtures and three arms. The evaluator can represent later host/model values in
the same schema, but this local command deliberately emits `null` for those
measurements and `INCONCLUSIVE` for product verdicts. There is intentionally
no `check:context-value` command: fixture-only evidence must not be named or
treated as a product-effectiveness check. The runner does not execute a host,
model, workflow, authority, or network request; it performs only a local Git
identity read to reject a mismatched declared candidate.

## Current 0.8.33 Audit And Residuals

The current audit used a clean detached worktree at
`9b80a45070be10659150095cf701a6f375bc6600`; the original developer worktree
was not modified.

| Command | Result | What the result means |
| --- | --- | --- |
| `npm ci` | PASS | 209 packages installed. `npm audit` reported 7 findings; no automatic fix was applied. |
| `npm test` | PASS | 8 unit files / 50 tests and 11 integration files / 64 tests passed. |
| `npm run typecheck` | PASS | Current TypeScript source type-checks. |
| `npm run build` | PASS | Current source builds successfully. |
| `npm run test:package` | PASS | The generic package smoke passed. |
| `npm pack --dry-run --json` | PASS | Current `0.8.33` package materialized with 1,631 entries. |
| `npm run test:repository` | PASS | With the regular local GitHub CLI supplied through `PERSONA_HARNESS_OBSERVER_GH`, the chained scope, docs, release-workflow, Vitest, and authoritative package-contract checks completed successfully. |

| Boundary | Current state | Residual |
| --- | --- | --- |
| P0 implementation | #413 merged at `a562331f9db321845b05da1e16edc4b83bf78ece`; #390 through #403 are observed closed after that merge. | No integration PR remains. |
| Release lineage | #414 delivered as stable `v0.8.33` through #437 on current protected main. The immutable tag, GitHub Release, npm `latest`, canonical tar, and provenance bind to `9b80a45070be10659150095cf701a6f375bc6600`. | It does not prove live host delivery. |
| Hosted Context delivery | The released package now satisfies #410's package/source prerequisite. | #410 still needs its own named Delivery Control start predicate and one bounded real OpenCode observation. |
| Deterministic follow-ups | #421 owns Team Profile v2; #411 owns the three-arm comparison protocol; #412 owns the generic Context compatibility runner. | Each remains independently open and may not manufacture host or user-value evidence. |

Product-value verdict remains **INCONCLUSIVE**. Local composition, package,
release, and CI evidence do not establish host-session delivery or user benefit.

## Owner Dogfooding Follow-up

The private, bounded owner dogfooding store now records the observed fixed
codes without conversation text, paths, or credentials. The remediation
program is #405, with focused follow-ups for project-philosophy diagnostics
(#406), deep-interview control (#407), workflow bootstrap/history diagnosis
(#408), and shared-skill routing observability (#409). These issues do not
expand the released Context delivery scope or change its default-off boundary.

## Next Action

Do not reopen the completed #390–#403 integration or #414 release paths.
Delivery Control must record #410's own named hosted start predicate before one
real OpenCode `experimental.chat.messages.transform` observation can begin.
#421, #411, and #412 remain independent follow-up boundaries. Do not infer
host delivery or product value from local composition tests, catalog
registration, release provenance, or historical evidence.
