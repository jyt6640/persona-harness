# Java Iron List Gate Matrix

## Scope And Reading Rules

This is a docs-only acceptance matrix for the 16 Java Iron List rules at source
snapshot `c097428d3327f599e47ce20069ce768e5d4f3b66`. It records the current
delivery text, fixture evidence, and Persona Harness enforcement state
separately. It does not add, enable, or evaluate a convention.

`rule ID` is the management key. A `file:line @ SHA` value is a source snapshot,
not a durable identifier.

| Gate state | Meaning in this matrix |
| --- | --- |
| `none` | No exact automated PH gate for the Iron List rule. Related prose, fixture, report-only convention, or partial convention does not change this state. |
| `fixture-only` | The Java shared-skill checker and its fixture verifier exercise a textual default-profile tripwire, but PH does not currently surface it as an architecture `warn` or finish `block`. |
| `warn` | An exact PH convention is configured/effective at `warn`. |
| `block` | An exact PH convention is configured/effective at `block` and can produce a closure blocker. |

No new convention ID is allocated here. `--` in the convention column means
there is no existing exact convention ID. Existing IDs are copied as-is from
the current registry or convention pack.

## Evidence Layers

1. **Delivery text**: the Iron List and its accompanying Java skill guidance.
2. **Fixture evidence**: the no-excuse checker and its pass/fail fixture
   verifier. The checker explicitly says it is pure-text/default-profile only.
3. **Enforced gate state**: the architecture convention engine loads configured
   conventions after the implementation report and applicable Java/Spring
   profile checks. Only a non-`report` convention finding becomes a warning;
   only `block` creates a closure blocker.

Existing convention test sources were also audited: the executable-application
`bootJar` block/warn behavior
(`tests/persona-harness-spring-bootjar-convention.test.ts:107-184`), observer
block/warn/report and service-state cases
(`tests/persona-harness-workflow-check.test.ts:556-718`), closure mapping for
registry blocker IDs (`tests/persona-harness-workflow-closure.test.ts:274-299`),
dynamic ast-grep observation (`tests/persona-harness-observe.test.ts:229-272`),
and report-level convention-pack loading
(`tests/persona-harness-convention-pack-diagnostics.test.ts:123-138`). These
tests prove only their named convention behavior, not an Iron List rule unless
the matrix says the scope is exact.

## Matrix

| Rule ID | Concise rule | Delivery source symbol/location | Current gate state | Existing convention ID | Pass/fail fixture or test | Promotion candidate | Precision caveat | Evidence snapshot `file:line @ SHA` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `I-01` | Pin Java, wrapper, CI, and local build together. | Iron List item 1; `SPRING_BOOTJAR_ENABLED_CONVENTION` is only a build-artifact subcase. | `none` | `spring.bootjar-enabled` (partial, not runtime/wrapper/CI alignment) | `tests/persona-harness-spring-bootjar-convention.test.ts` (related only) | no | A `bootJar` check cannot prove Java version, wrapper, CI, and local-toolchain agreement. | `packages/shared-skills/skills/programming/references/java/README.md:63 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `src/config/convention-registry.ts:70-83 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |
| `I-02` | Make IDs, money, email, quantities, and statuses semantic types. | Iron List item 2. | `none` | -- | No exact no-excuse fixture or convention test. | no | Requires domain meaning; neither a text pattern nor the current convention registry proves primitive-soup absence. | `packages/shared-skills/skills/programming/references/java/README.md:64 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `src/config/convention-registry.ts:85-100 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |
| `I-03` | Choose `record`, `class`, `enum`, or `sealed interface` by semantics. | Iron List item 3; `domain-record` is a narrow default-profile subrule. | `fixture-only` | -- | Fail: `fixtures/java/no-excuse/fail/domain-record/.../DomainRecordCase.java`; pass: `fixtures/java/no-excuse/pass/CleanDomain.java`; verifier: `verify-no-excuse-fixtures.sh`. | no | The checker only flags a `record` under a path containing `/domain/`, with a line opt-out for a value object; it cannot select the right form generally. | `packages/shared-skills/skills/programming/references/java/README.md:65,185 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `packages/shared-skills/skills/programming/scripts/java/check-no-excuse-rules.sh:112-117 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |
| `I-04` | Parse untrusted input once at a boundary into typed forms. | Iron List item 4; `validation.no-util-based-validation` delivery is adjacent only. | `none` | `validation.no-util-based-validation` (report-only, adjacent) | No exact no-excuse fixture or convention test. | no | The existing rule spots a `*Util.validate` call; it does not establish parsing boundary ownership or typed conversion. | `packages/shared-skills/skills/programming/references/java/README.md:66 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `.persona/conventions/validation-no-util-based-validation.yml:1-15 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |
| `I-05` | Put business decisions near their data and rule owner. | Iron List item 5; `method.no-composite-and-name` and utility-package rules are adjacent only. | `none` | `method.no-composite-and-name`; `architecture.no-common-util-package` (report-only, adjacent) | No exact no-excuse fixture or convention test. | no | Responsibility placement and getter-driven logic require semantic review; current patterns cover names/packages only. | `packages/shared-skills/skills/programming/references/java/README.md:67 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `.persona/conventions/method-no-composite-and-name.yml:1-15 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |
| `I-06` | Avoid public setters; use named behavior or immutable replacement. | Iron List item 6; no-excuse `setter` checker. | `fixture-only` | -- | Fail: `fixtures/java/no-excuse/fail/setter/.../SetterCase.java`; pass: `fixtures/java/no-excuse/pass/CleanDomain.java`; verifier: `verify-no-excuse-fixtures.sh`. | no | Only `void setX` in a path containing `/domain/` is flagged; generated/boundary types and legitimate mutation need an explicit policy. | `packages/shared-skills/skills/programming/references/java/README.md:68,184 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `packages/shared-skills/skills/programming/scripts/java/check-no-excuse-rules.sh:119-125 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |
| `I-07` | Make value and entity equality semantics explicit. | Iron List item 7. | `none` | -- | No exact no-excuse fixture or convention test. | no | Equality correctness depends on domain identity/value semantics and cannot be inferred from the current textual checker. | `packages/shared-skills/skills/programming/references/java/README.md:69 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `packages/shared-skills/skills/programming/scripts/java/check-no-excuse-rules.sh:1-5 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |
| `I-08` | Do not use raw types; localize/justify unchecked operations. | Iron List item 8; no-excuse `raw-type` checker. | `fixture-only` | -- | Fail: `fixtures/java/no-excuse/fail/raw-type/{RawMapCase,RawOptionalCase,RawTypeCase}.java`; pass: `fixtures/java/no-excuse/pass/CleanDomain.java`; verifier: `verify-no-excuse-fixtures.sh`. | yes, later `warn` review | Regex covers listed common generic declarations only; it does not prove unchecked-cast safety or every raw Java construct. | `packages/shared-skills/skills/programming/references/java/README.md:70,173 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `packages/shared-skills/skills/programming/scripts/java/check-no-excuse-rules.sh:83-87 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |
| `I-09` | Do not use unsafe `Optional.get()` without same-scope proof/opt-out. | Iron List item 9; no-excuse `optional-get` checker. | `fixture-only` | -- | Fail: `fixtures/java/no-excuse/fail/optional-get/{OptionalGetCase,OptionalLocalCase}.java`; pass: `fixtures/java/no-excuse/pass/CleanDomain.java`; verifier: `verify-no-excuse-fixtures.sh`. | yes, later `warn` review | It first extracts simple `Optional<...>` variable declarations, then text-matches `.get()`; control-flow proof is not analyzed. | `packages/shared-skills/skills/programming/references/java/README.md:71,174 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `packages/shared-skills/skills/programming/scripts/java/check-no-excuse-rules.sh:56,89-96 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |
| `I-10` | Use meaningful typed errors, not bare `RuntimeException`. | Iron List item 10; no-excuse `raw-runtime-throw` checker. | `fixture-only` | -- | Fail: `fixtures/java/no-excuse/fail/raw-runtime-throw/RawRuntimeThrowCase.java`; verifier: `verify-no-excuse-fixtures.sh`. | no | Only a literal `throw new RuntimeException("...")` is caught; it does not assess exception hierarchy, catalogues, or framework boundary translation. | `packages/shared-skills/skills/programming/references/java/README.md:72,186 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `packages/shared-skills/skills/programming/scripts/java/check-no-excuse-rules.sh:158-161 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |
| `I-11` | Catch narrowly; do not swallow failures. | Iron List item 11; no-excuse `broad-catch` and `empty-catch` checks. | `fixture-only` | -- | Fail: `fixtures/java/no-excuse/fail/{broad-catch/BroadCatchCase,empty-catch/EmptyCatchCase}.java`; verifier: `verify-no-excuse-fixtures.sh`. | no | Broad catches are allowed by a line opt-out for a boundary; empty-catch matching is single-line text only, so promotion needs precision review. | `packages/shared-skills/skills/programming/references/java/README.md:73,181-182 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `packages/shared-skills/skills/programming/scripts/java/check-no-excuse-rules.sh:144-156 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |
| `I-12` | Give shared mutable state an explicit owner/lifecycle. | Iron List item 12; no-excuse `mutable-static` checker. | `fixture-only` | -- | Fail: `fixtures/java/no-excuse/fail/mutable-static/MutableStaticCase.java`; pass: `fixtures/java/no-excuse/pass/CleanDomain.java`; verifier: `verify-no-excuse-fixtures.sh`. | yes, later `warn` review | The text check exempts `static final` and only sees declaration lines; it does not establish actual mutability through referenced objects. | `packages/shared-skills/skills/programming/references/java/README.md:74,175 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `packages/shared-skills/skills/programming/scripts/java/check-no-excuse-rules.sh:98-103 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |
| `I-13` | Keep Spring/JPA/HTTP/SQL imports outside domain/core. | Iron List item 13; no-excuse `domain-framework-import` checker. | `fixture-only` | `controller.persistence-import` (scope mismatch: Controller-only Jakarta persistence import) | Fail: `fixtures/java/no-excuse/fail/domain-framework-import/.../{DomainFrameworkImportCase,JpaImportCase}.java`; verifier: `verify-no-excuse-fixtures.sh`; related engine test: `tests/persona-harness-workflow-check.test.ts`. | no | The fixture checker relies on `/domain/` path text and an import prefix list. The existing `warn` protects Controllers, not domain/core, so it is not evidence of this Iron List gate. | `packages/shared-skills/skills/programming/references/java/README.md:75,177 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `.persona/conventions/controller-persistence-import.yml:1-13 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `packages/shared-skills/skills/programming/scripts/java/check-no-excuse-rules.sh:69-75 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |
| `I-14` | Prefer `presentation`, `application`, `domain`, and `infrastructure` packages. | Iron List item 14. | `none` | `controller.repository-dependency`; `service.state-ownership` (partial architecture rules, not package-name gate) | Existing observer tests cover their own rules; no exact package-name fixture/test. | no | The current block conventions check a controller-to-repository dependency and Service state ownership, not four package names or the forbidden role-package default. | `packages/shared-skills/skills/programming/references/java/README.md:76 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `src/config/convention-registry.ts:23-68 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |
| `I-15` | Follow the project-selected test naming convention. | Iron List item 15; no-excuse `test-name-convention` default profile. | `fixture-only` | -- | Fail: `fixtures/java/no-excuse/fail/test-name-convention/{AnotherBadTest,BadTest}.java`; pass: `fixtures/java/no-excuse/pass/CleanTest.java`; verifier: `verify-no-excuse-fixtures.sh`. | no | The delivery text allows an explicit company/personal convention; the checker hard-codes the default profile and only recognizes void method naming. | `packages/shared-skills/skills/programming/references/java/README.md:77,178 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `packages/shared-skills/skills/programming/scripts/java/check-no-excuse-rules.sh:163-175 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |
| `I-16` | Keep Java files below a 250 pure-LOC responsibility ceiling. | Iron List item 16; touched-file guidance. | `none` | -- | No LOC pass/fail fixture or convention test. | no | The reference asks human responsibility-based splitting; no current script counts pure LOC or distinguishes generated/legacy/required dense files. | `packages/shared-skills/skills/programming/references/java/README.md:78,193 @ c097428d3327f599e47ce20069ce768e5d4f3b66`; `packages/shared-skills/skills/programming/scripts/java/check-no-excuse-rules.sh:1-193 @ c097428d3327f599e47ce20069ce768e5d4f3b66` |

## Mismatches And Missing Coverage

- The 16 no-excuse checker IDs are not the 16 Iron List IDs. They overlap only
  for selected textual tripwires; a fixture does not establish a PH `warn` or
  `block`.
- `controller.persistence-import` is configured at `warn`, but its
  `Controller.java`/Jakarta-persistence scope differs from `I-13`'s domain/core
  boundary. It is intentionally not counted as an I-13 enforced gate.
- The report-only convention files are evaluated as summaries, but the engine
  leaves `hasWarnFinding` false for a `report` finding. They remain `none` in
  this four-state gate matrix.
- Existing blocks (`controller.repository-dependency`,
  `service.state-ownership`, and `spring.bootjar-enabled`) protect narrower
  architecture/build conditions. None is an exact block for an Iron List row.
- `I-02`, `I-04`, `I-05`, `I-07`, `I-14`, and `I-16` have no exact no-excuse
  pass/fail fixture. `I-01` has only the related `bootJar` convention test.

## Later Warn Review Queue

The low-risk review candidates are `I-08` (`raw-type`), `I-09`
(`optional-get`), and `I-12` (`mutable-static`), because each has an existing
named checker rule plus pass/fail fixtures. This is a queue for the later warn
promotion decision, not an approval to add or enable a convention. Candidate
IDs, precision thresholds, profile configuration, and closure behavior remain
unallocated and undecided.

## Boundaries

This matrix is a source/fixture/convention-state inventory only. It is not
evidence of rule effectiveness, code quality, product quality, user benefit,
reliability, evaluation performance, or future enforcement approval.
