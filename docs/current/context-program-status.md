# Context Personalization Program Status

Status: current canonical program record.

Last reconciled: 2026-08-30
P0 integration release: `a82b85ddef7e9fd9518348bff16deb38f53b4676`
P0 integration package: [`persona-harness@0.8.37`](https://www.npmjs.com/package/persona-harness/v/0.8.37)
P0 integration lineage: [#442](https://github.com/jyt6640/persona-harness/issues/442) delivered through [#443](https://github.com/jyt6640/persona-harness/pull/443)
Prior program-status publication: [`persona-harness@0.8.38`](https://www.npmjs.com/package/persona-harness/v/0.8.38)
Program-status publication lineage: [#444](https://github.com/jyt6640/persona-harness/issues/444) reconciled through [#445](https://github.com/jyt6640/persona-harness/pull/445) and published by [#446](https://github.com/jyt6640/persona-harness/issues/446)
Current structural-observability release: [`persona-harness@0.8.39`](https://www.npmjs.com/package/persona-harness/v/0.8.39)
Structural-observability lineage: [#449](https://github.com/jyt6640/persona-harness/issues/449) delivered through [#450](https://github.com/jyt6640/persona-harness/pull/450) on `ec3680bcceccf582521952dc77bf3cc9fb7cd874`
Current lifecycle documentation merge: [#451](https://github.com/jyt6640/persona-harness/issues/451) delivered through [#452](https://github.com/jyt6640/persona-harness/pull/452) on `881be07b3e3baa443a66126ca94008499082b732`
P0 implementation release baseline: `9b80a45070be10659150095cf701a6f375bc6600`
P0 implementation package: [`persona-harness@0.8.33`](https://www.npmjs.com/package/persona-harness/v/0.8.33)
P0 implementation lineage: [#414](https://github.com/jyt6640/persona-harness/issues/414) delivered through [#437](https://github.com/jyt6640/persona-harness/pull/437)
Current comparison release: `19c397e4fed5b1cce7d024fbcc51350e9676105f`
Current comparison package: [`persona-harness@0.8.34`](https://www.npmjs.com/package/persona-harness/v/0.8.34)
Current comparison lineage: [#411](https://github.com/jyt6640/persona-harness/issues/411) delivered through [#439](https://github.com/jyt6640/persona-harness/pull/439)
Current Team Profile v2 release: `90a913168edac40eb29290e7ff47885bb94b30fd`
Current Team Profile v2 package: [`persona-harness@0.8.35`](https://www.npmjs.com/package/persona-harness/v/0.8.35)
Current Team Profile v2 lineage: [#421](https://github.com/jyt6640/persona-harness/issues/421) delivered through [#440](https://github.com/jyt6640/persona-harness/pull/440)
Current compatibility release: `9e8dcc3e72fab52dcb71c12c1a45cd3846929be8`
Current compatibility package: [`persona-harness@0.8.36`](https://www.npmjs.com/package/persona-harness/v/0.8.36)
Current compatibility lineage: [#412](https://github.com/jyt6640/persona-harness/issues/412) delivered through [#441](https://github.com/jyt6640/persona-harness/pull/441)
Historical pre-integration audit source: `f677a635040ad55d8b7d25abab280c5703a153ea`
Program issue: [#389](https://github.com/jyt6640/persona-harness/issues/389)
Remaining bounded work: the terminal, non-retryable hosted-observation record in [#410](https://github.com/jyt6640/persona-harness/issues/410) and the not-started independent-value protocol from [#429](https://github.com/jyt6640/persona-harness/issues/429), whose real preregistered participant route is [#317](https://github.com/jyt6640/persona-harness/issues/317). [#449](https://github.com/jyt6640/persona-harness/issues/449) is a delivered metadata-only structural observer boundary; it does not replay #410, begin a host action, or establish product value. The deterministic local P0 boundaries integrated by #443 are closed.

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
| M3 | delivered and released via #421/#440 | `persona-context-team-profile.2` is a separate semantic schema and explicit pure-resolver layer. It does not silently upgrade v1 files or enable Context, CLI delivery, or host activation. | Preserve v1/v2 separation and default-off behavior. |
| M4 | delivered via #413 | Pure Core resolves the seven precedence layers and produces a deterministic `persona-context-envelope.v1`. | Keep Core host-neutral. |
| M5 | implementation delivered; hosted residual | Core has no OpenCode or Java runtime import; the isolated OpenCode adapter is locally covered. | #410 may observe the real transform only after its own named Delivery Control predicate. |
| M6 | implementation delivered; hosted residual | Context resolution, rendering, and delivery are separated from legacy workflow/authority behavior. | Preserve the isolated adapter boundary during #410. |
| M7 | delivered and released via #412/#441 | The generic Context compatibility manifest and runner are version-neutral. | Preserve the manifest-driven runner. |
| M8 | delivered via #413 | `npm test` now selects focused source evidence and installed packages receive a separate smoke. | Keep full protected verification separate. |
| M9 | deterministic protocol delivered via #429/#443; external evidence absent | Local Context inspection and deterministic fixtures do not establish independent usefulness. #429 provides the strict preregistration and result-status contract, whose committed state records no observation and `INCONCLUSIVE`. | Preserve the empty denominator until an independently authorized observation exists. |
| M10 | delivered via #411/#439 and #436/#443 | #411 provides a versioned three-arm protocol, strict ten-fixture manifest, and deterministic evaluator for Context OFF, legacy broad compatibility, and targeted layered envelopes. #436 adds an explicit clean-current-checkout source without changing the fixed corpus. | Keep model, host, and operational measurements unavailable until a separately authorized observation; every local product verdict remains `INCONCLUSIVE`. |
| M11 | delivered and released via #412/#441 | The installed-package compatibility boundary uses a generic manifest and runner. | Keep version-specific acceptance scripts out of new Context changes. |
| M12 | verified-existing; #431/#443 delivered | CI critical-path optimization is already measured and active. #431 classifies an unavailable repository observer as `clean-package-observer-gh-required` rather than a source-test failure. | Preserve the critical path; treat the named observer prerequisite as `ENVIRONMENT_BLOCKED` and add only bounded Context checks to the correct lane. |
| M13 | delivered via #412/#441 and #430/#435/#443 | Stable `v0.8.36` provides the generic manifest/runner; the contributor map and its security/release/bootstrap-intake routes give a readable credential-free contributor route. | Preserve generic package/source-fallback checks and keep the route separate from hosted or release work. |
| M14 | delivered via #433/#443 | The README entrypoint makes Context activation, authority, host, evidence, and product-focus limits explicit, with usefulness still `INCONCLUSIVE`. | Preserve the public boundary without promoting local evidence to host delivery or product value. |

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

## Current Verdict

- **Technical P0 verdict: `TECHNICAL_GO`.** The deterministic Core, envelope,
  Team Profile, Context CLI, default-off compatibility boundary, OpenCode
  adapter composition, generic manifest runner, contributor route, package
  surface, protected checks, and post-merge checks were integrated by #443 and
  released as `persona-harness@0.8.37` from
  `a82b85ddef7e9fd9518348bff16deb38f53b4676`.
- **Product verdict: `INCONCLUSIVE`.** The release and local deterministic
  evidence do not establish Context delivery or independent user value. #410
  ran its one authorized real OpenCode session, but its privacy-preserving
  observation could not classify delivery; the #429 status intentionally has
  no independent-user observations. The real preregistered independent
  participant boundary remains #317.
- **Hosted-observation verdict: `hosted-unavailable`.** The #410 one-shot
  completed its safe read and same-session checks, then retained only a
  sanitized OpenCode export. OpenCode `v1.17.16` redacts every text part in
  `export --sanitize`, so the absence of a Context marker in that export does
  not prove that the transform did not inject one. The run is terminal and
  cannot be retried as a debugger.
- **Next allowed step:** no Context host action starts automatically. #449 is
  delivered as a metadata-only structural observer boundary in `v0.8.39`, but
  any future observation still needs its own explicit Delivery Control
  predicate and a semantically new consumer/session. It cannot reuse or replay
  #410.

## Current Delivery Order

1. **Merged P0 implementation:** #390 through #403 merged and closed through
   #413 on `a562331f9db321845b05da1e16edc4b83bf78ece`.
2. **P0 implementation release:** #414 is delivered as stable `v0.8.33`
   through #437; its immutable package/source binding remains historical
   release evidence.
3. **Deterministic comparison release:** #411 is delivered as stable
   `v0.8.34` through #439 on
   `19c397e4fed5b1cce7d024fbcc51350e9676105f`. It provides the fixture-only
   three-arm protocol below, does not initiate a host, model, workflow, or
   authority action, and cannot establish product value.
4. **Team Profile v2 release:** #421 is delivered as stable `v0.8.35` through
   #440 on `90a913168edac40eb29290e7ff47885bb94b30fd`. It preserves the
   explicit Context boundary and does not begin host observation.
5. **Compatibility release:** #412 is delivered as stable `v0.8.36` through
   #441 on `9e8dcc3e72fab52dcb71c12c1a45cd3846929be8`. It provides the
   generic installed-package compatibility manifest and runner.
6. **P0 integration release:** #442 delivered the deterministic local P0
   boundaries from #429, #430, #431, #433, #434, #435, and #436 through #443
   as stable `v0.8.37` on
   `a82b85ddef7e9fd9518348bff16deb38f53b4676`. The release does not create
   host-delivery or product-value evidence.
7. **Metadata-only structural-observability release:** #449 delivered through
   #450 as stable `v0.8.39` on
   `ec3680bcceccf582521952dc77bf3cc9fb7cd874`. It makes a separate synthetic
   Context input part observable in sanitized OpenCode exports, but it does
   not run a host observation or establish Context delivery or product value.
8. **Explicit lifecycle documentation:** #451 delivered through #452 on
   `881be07b3e3baa443a66126ca94008499082b732`. The guide documents inspection,
   fresh-safe enablement, manual merge for an existing configuration,
   disablement, Context-only removal, and VCS rollback without changing CLI or
   runtime behavior.
9. **Remaining independent evidence:** #410's named predicate ran once on a
   released `0.8.33` consumer and reached terminal `hosted-unavailable`.
   Because the retained OpenCode `v1.17.16` `export --sanitize` result redacts
   every text part, its marker count is not a delivery verdict; #410 cannot be
   retried. #429 owns the preregistered external-validation schema; its current
   empty status remains `INCONCLUSIVE` until real preregistered participants
   begin the separate #317 protocol.

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
| #411 | delivered through #439 and #443 | Stable `v0.8.34` binds the deterministic three-arm comparison source at `19c397e4fed5b1cce7d024fbcc51350e9676105f`. `persona-context-comparison-manifest.1` fixes ten P0 fixtures and compares `off`, `legacy-broad`, and `targeted-layered` through `persona-context-comparison-result.1`. The historical runner accepts explicit candidate commit and package-version metadata; #436, released through #443, adds a distinct explicit `--current-checkout` source that binds a clean root checkout before evaluation. Both forms produce 30 deterministic records and emit only rule ids/layers and digests; model/host/operational fields remain `null` and every local product verdict is `INCONCLUSIVE`. |
| #414 | delivered through #437 | Stable `v0.8.33` binds the P0 implementation package/source release lineage. It is immutable historical release evidence and does not authorize #410, a host session, or any Context product claim by itself. |
| #421 | delivered through #440 | Stable `v0.8.35` binds the Team Profile v2 source at `90a913168edac40eb29290e7ff47885bb94b30fd`. The separate JSONC loader and explicit pure-resolver layer reject unknown fields, unsafe shared text, duplicate ids, active topic conflicts, malformed JSONC, and symlinked files without reading personal state or activating a host. | Release and provenance evidence do not begin CLI delivery, adapter delivery, runtime activation, or external effectiveness observation. |
| #442 | delivered through #443 | Stable `v0.8.37` binds the integrated deterministic P0 boundary to `a82b85ddef7e9fd9518348bff16deb38f53b4676`. It includes the external-validation schema/status, contributor route, default-off claim boundary, current-checkout comparison route, and observer prerequisite classification. | The release does not substitute for #410's real host observation or turn the empty #429 protocol into product evidence. |

The heavy `test:installed-package-contract` and full protected repository suite
remain unchanged. The generic package smoke is version-neutral and does not
replace release acceptance.

## Historical Candidate Verification And Residuals

The historical candidate was exercised in an isolated worktree before any PR
or hosted action:

- `npm test`, `npm run typecheck`, `npm run build`, `npm run check:docs`,
  `npm run check:scope:strict`, `npm run check:release-workflows`, and
  `npm run check:injection-value` passed.
- `npm run test:package` proved the canonical tarball could be installed in a
  clean consumer and that its packaged `npm test` selected the installed smoke.
- `npm run test:repository:resource-sensitive` passed with 10 files and 80
  tests.
- `npm run test:repository:parallel` reached 2,619 passing tests and one skip,
  then stopped at two independent project-finish OIDC caller-pin failures.
  The candidate did not touch the related workflow, producer, or diagnostic
  boundary; the failures are tracked separately in #404 and are not reused as
  Context evidence.
- A real OpenCode `experimental.chat.messages.transform` observation remains
  a hosted-only residual. Local composition and type tests do not establish
  that a host session received Context.

## Historical 0.8.33 Audit And Current Residuals

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
| P0 implementation release lineage | #414 delivered stable `v0.8.33` through #437. Its immutable tag, GitHub Release, npm `latest`, canonical tar, and provenance bind to `9b80a45070be10659150095cf701a6f375bc6600`. | Historical P0 implementation release evidence does not prove live host delivery. |
| Deterministic comparison release lineage | #411 delivered stable `v0.8.34` through #439. Its immutable tag, GitHub Release, npm `latest`, canonical tar, and provenance bind to `19c397e4fed5b1cce7d024fbcc51350e9676105f`. | It records only deterministic technical results; host/model/operational values remain unavailable and product verdicts remain `INCONCLUSIVE`. |
| Current P0 integration release | #442 delivered stable `v0.8.37` through #443. Its immutable tag, GitHub Release, npm `latest`, canonical tar, and provenance bind to `a82b85ddef7e9fd9518348bff16deb38f53b4676`. | It closes the deterministic local P0 boundaries, not #410's real host observation or external product-value evidence. |
| Hosted Context delivery | #410's named predicate was satisfied for a registry-installed `0.8.33` consumer bound to `9b80a45070be10659150095cf701a6f375bc6600`; one real OpenCode `v1.17.16` session completed its safe sequence. The retained `export --sanitize` redacts all text parts, so its zero marker count cannot establish delivery absence. | The one-shot is terminal `hosted-unavailable` and non-retryable. No Context delivery or product-value claim is supported; any future observation needs a separately authorized, metadata-only host-observer contract. |
| Other follow-ups | #421 is delivered as stable `v0.8.35` through #440; #412 is delivered as stable `v0.8.36` through #441; the #429 protocol is released through #443 with zero observations. | None of these facts manufacture host or user-value evidence. |

Product-value verdict remains **INCONCLUSIVE**. Local composition, package,
release, and CI evidence do not establish host-session delivery or user benefit.

## #411 Comparison Protocol

The Context comparison runner is repository-side tooling, not an installed
user command. Its default command explicitly selects the clean current
checkout as the candidate source:

```bash
npm run benchmark:context
```

The runner reads only the local Git root, full `HEAD`, clean working-tree state,
and root `package.json` version for that mode. For reproducible supplied
metadata, invoke the runner directly with both `--candidate-commit` and
`--package-version`; mixing the two source forms, partial metadata, a dirty
checkout, or a package root outside the Git root fails before manifest
evaluation.

It produces one `persona-context-comparison-result.1` record for each of ten
fixtures and three arms. It emits only rule identifiers, layers, and digests;
host/model/operational measurements remain `null` and product verdicts remain
`INCONCLUSIVE`. The runner never invokes a model, host adapter, network,
workflow, authority, or evidence path. Its local Git read exists only to bind
the declared candidate to the checkout.

## Owner Dogfooding Follow-up

The private, bounded owner dogfooding store now records the observed fixed
codes without conversation text, paths, or credentials. The remediation
program is #405, with focused follow-ups for project-philosophy diagnostics
(#406), deep-interview control (#407), workflow bootstrap/history diagnosis
(#408), and shared-skill routing observability (#409). These issues do not
expand the released Context delivery scope or change its default-off boundary.

## Next Action

No deterministic local Context P0 candidate remains open after #443. Do not
reopen the completed #390–#403 integration, #414 release, or #442 integration
paths. #410's one real OpenCode observation is terminal and cannot be retried;
its sanitized-export result is insufficient to attribute Context delivery or
absence. The #429 protocol remains `INCONCLUSIVE` with zero observations; do
not infer host delivery or product value from local composition tests, catalog
registration, release provenance, an empty external-validation status, or
historical evidence.
