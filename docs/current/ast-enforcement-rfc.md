# AST Enforcement RFC

## Problem Statement

An external cold review identified AST-based enforcement as the single highest-leverage
next capability for Persona Harness. The claim is plausible: Persona Harness currently
improves Java/Spring backend generation through workflow rails, prompt injection,
evidence, and report-only observation, but it cannot machine-verify whether generated
code actually follows the backend responsibility shape it asks for.

This RFC separates the possible value of AST analysis from the timing of enforcement.
The recommendation is not "build AST enforcement now." The recommendation is to define
a report-only path that can become a verified report, then only later become an
opt-in enforcement gate after false-positive and workflow-friction risks are measured.

## Current Limitation

Persona Harness v0.3.x is intentionally positioned as a Java/Spring backend workflow
rail and evidence system, not a generated-app quality certifier.

Current strengths:

- deterministic Java/Spring backend guidance injection;
- workflow rails for requirements, debug, review, refactor, git, and programming;
- evidence records for selected intent, rule metadata diagnostics, and rail drift;
- `ph workflow check`, `ph workflow finish implement`, and backend-shape report-only
  observations;
- a backend Clean Code rubric for repeated A/B reading.

Current limits:

- backend-shape checks are mostly text, file-shape, and human-review based;
- report-only WARNs can identify workflow drift but cannot prove architectural
  responsibility boundaries;
- `.persona/rules` guidance can improve agent behavior but cannot verify final Java AST
  shape;
- current scope decisions explicitly exclude AST/linter/enforcement gates and generated
  app product-quality certification.

The main gap is not "no parser dependency." The main gap is no verified, low-noise,
machine-readable backend-shape report that can show why a Controller, Service, Domain,
Repository, or DTO boundary is present, partial, missing, or unknown.

## Options Comparison

| Option | Fit For Persona Harness | Strengths | Weaknesses | Cold Recommendation |
| --- | --- | --- | --- | --- |
| `ast-grep` | Early report-only structural experiments | CLI-first, fast, Java is a built-in supported language, YAML rules are easy to review, good for simple syntax patterns such as field ownership and annotation/import checks. | Pattern matching is syntax-oriented, not project-semantic. It cannot reliably answer "does this Service depend on the domain repository port rather than infrastructure implementation?" without naming conventions and extra context. | Good v0.4 prototype for report-only structural findings, not the core v1 enforcement engine. |
| JavaParser sidecar | PH-owned Java backend analyzer | Java-native AST traversal, programmatic rules, optional JavaSymbolSolver for type and declaration resolution, easier to shape into PH-specific reports. | Adds a Java sidecar and dependency lifecycle. Symbol solving needs source paths, classpath/JAR knowledge, Gradle output, and careful unresolved-state reporting. | Best long-term candidate for verified backend-shape reports. Start only after the rule vocabulary is stable. |
| Eclipse JDT LS / LSP | Rich workspace-aware semantic analysis | Mature Java tooling, Gradle support, diagnostics, references, code actions, call/type hierarchy, and project/classpath awareness. | Operationally heavy for a CLI harness: server lifecycle, workspace data directory, Java 21 runtime, LSP client complexity, slower cold starts, and more moving parts than a report generator needs. | Useful later for semantic verification or editor-like workflows, not the first PH analyzer. |
| raw tree-sitter-java | Lightweight syntax parsing substrate | Tree-sitter is fast, incremental, robust with syntax errors, embeddable, and tree-sitter-java is the official Java grammar. | Concrete syntax tree only. No Java symbol/type resolution, no Gradle model, and Java binding options add their own runtime constraints. | Good substrate for fast syntax scans, but insufficient alone for Clean Code boundary verification. |

### Source Notes

- Tree-sitter describes itself as an incremental parsing library that builds concrete
  syntax trees and remains useful even with syntax errors:
  <https://tree-sitter.github.io/tree-sitter/>.
- `tree-sitter-java` is the official Java grammar:
  <https://github.com/tree-sitter/tree-sitter-java>.
- JavaParser provides an AST for Java source and documents analysis/transform/generate
  use cases:
  <https://javaparser.org/>.
- JavaParser's project docs say JavaSymbolSolver connects AST elements to declarations
  and type information:
  <https://github.com/javaparser/javaparser/blob/master/doc/readme.md>.
- Eclipse JDT LS is a Java language-server implementation based on LSP4J, Eclipse JDT,
  Maven support, and Gradle Buildship; its README lists diagnostics, references, code
  actions, call hierarchy, and Gradle support:
  <https://github.com/eclipse-jdtls/eclipse.jdt.ls>.
- ast-grep describes itself as fast structural search, lint, and rewriting at scale,
  and lists Java as a built-in language:
  <https://ast-grep.github.io/> and <https://ast-grep.github.io/reference/languages.html>.

## How AST Analysis Conflicts With Persona Harness

### Scope Conflict

Persona Harness currently promises workflow help, evidence, and Java/Spring Clean Code
guidance. Enforcement would sound like generated-app certification unless the product
language is strict. A failed AST gate could be read as "the app is bad" or "PH guarantees
quality when green." Both claims are outside the alpha contract.

### Workflow Conflict

The current product loop is:

```text
requirements/profile/plan -> workflow rail -> agent implementation -> reports/evidence -> review
```

An enforcement gate can short-circuit that loop if it becomes a build-like failure before
the agent has filled implementation and review reports. The user would see a parser error
or rule violation instead of a workflow continuation.

### Maintenance Conflict

Backend shape rules are product semantics, not generic lint rules. Once machine-readable,
they need fixtures, false-positive triage, versioned rule IDs, and upgrade behavior.
Without that, AST enforcement turns one clean-code advisory into a second product surface
that must be supported like a compiler.

## How AST Analysis Complements Persona Harness

AST analysis is valuable if it supports the existing evidence loop instead of replacing it.

Good fit:

- produce report-only backend-shape evidence with file, line, node kind, and confidence;
- turn the existing rubric checks into repeatable observations;
- separate `present`, `partial`, `missing`, and `unknown` with explicit reasons;
- let `ph review backend-shape` become a more credible "verified report";
- help HQ decide whether a generated run should continue, be revised, or be used as A/B
  evidence.

Bad fit:

- fail builds or workflow finish in alpha;
- claim generated app quality;
- replace manual API smoke, Gradle verification, or review report judgment;
- activate vendored `ast-grep` or parser dependencies without a scope decision.

## Report-only To Verified Report Path

The middle path is a three-layer report model:

1. **Advisory report:** current text/file-shape observations. Useful, but low authority.
2. **Verified report:** AST-backed observations with evidence anchors and `unknown` states.
   This is still report-only. It does not block implementation, tests, or release.
3. **Enforcement gate:** opt-in policy that can fail a command only after the verified
   report has proven low noise across repeated clean runs.

The verified report should not start by enforcing every Clean Code idea. It should begin
with the smallest high-signal checks:

- Controller has Spring web annotations and delegates to a Service-like collaborator.
- Controller does not directly own Repository/storage/id sequence fields.
- Service does not own obvious storage/id sequence fields.
- Domain classes do not import Spring web/persistence/infrastructure packages unless the
  project profile explicitly allows that style.
- Repository interface and implementation are distinct enough to classify.
- Request/response DTO boundaries can be detected without exposing domain objects directly.

Every finding should include:

- rule ID;
- target file;
- line/range if available;
- AST node kind or matched pattern;
- finding: `PASS`, `WARN`, `FAIL`, or `UNKNOWN`;
- confidence;
- reason;
- whether the observation is syntax-only or symbol-aware.

## Verified Report Schema Draft

Before any AST parser is added, Persona Harness needs a stable report shape that can be
filled by text, syntax, semantic, or manual evidence. The schema should prove that a
finding is explainable, not that a generated app is certified.

Draft finding shape:

```json
{
  "ruleId": "controller-delegates-to-service",
  "result": "PASS",
  "targetFile": "src/main/java/example/presentation/BookController.java",
  "evidence": [
    {
      "kind": "method-call",
      "location": {
        "line": 42,
        "column": 12
      },
      "detail": "Controller method delegates to BookService.registerBook(...)"
    }
  ],
  "limitations": [
    "syntax-only evidence cannot prove transaction boundary correctness"
  ],
  "confidence": "medium",
  "source": "syntax"
}
```

Required fields:

| Field | Allowed values | Meaning |
| --- | --- | --- |
| `ruleId` | stable kebab-case ID | The backend-shape rule being observed. The ID must remain stable across report versions. |
| `result` | `PASS`, `WARN`, `FAIL`, `UNKNOWN` | The observation result. `UNKNOWN` is a first-class result, not a failure to implement the analyzer. |
| `targetFile` | project-relative path | The main file the finding is about. Cross-file evidence can appear inside `evidence`. |
| `evidence` | list of structured evidence items | File/range, symbol guess, AST node, token, command log, or manual note that supports the result. |
| `limitations` | list of strings | Caveats that prevent overclaiming, especially for syntax-only and text-only findings. |
| `confidence` | `high`, `medium`, `low` | How much trust the analyzer places in the observation. |
| `source` | `text`, `syntax`, `semantic`, `manual` | The evidence source used to produce the finding. |

Result semantics:

- `PASS`: evidence is present and the rule appears satisfied within the stated limitations.
- `WARN`: evidence is mixed, weak, profile-dependent, or probably acceptable but worth review.
- `FAIL`: evidence strongly indicates the rule is violated.
- `UNKNOWN`: the report cannot determine the rule because files, classpath, symbols, logs, or
  domain context are missing.

Source semantics:

- `text`: filename, string, command-log, or token evidence only.
- `syntax`: AST/tree pattern evidence without type or declaration resolution.
- `semantic`: type/declaration/call/reference-aware evidence.
- `manual`: human reviewer observation, usually used as baseline or adjudication.

The first implementation-independent deliverable should be a markdown summary plus a JSON
shape like this. It can be hand-filled for existing smoke outputs before any parser spike.

## Stable Rule ID Vocabulary Draft

These IDs should be treated as candidate stable vocabulary before implementation. They
mirror the current backend Clean Code rubric while preserving report-only semantics.

| Rule ID | Question It Answers | Minimum Evidence | Likely Source Before AST | AST/Semantic Need |
| --- | --- | --- | --- | --- |
| `controller-delegates-to-service` | Does the HTTP boundary delegate use-case work to a Service-like collaborator? | Controller annotation plus method call or dependency evidence. | `manual` or `text` | `syntax` first, semantic later for type certainty. |
| `controller-no-repository-direct-dependency` | Does the Controller avoid direct Repository/storage dependency? | Controller fields/imports/calls do not target Repository-like or storage APIs. | `text` | `syntax` is enough for first pass; semantic improves false positives. |
| `service-no-storage-id-sequence` | Does the Service avoid owning storage maps/lists and id sequence state? | Service fields and method bodies lack obvious storage/id ownership patterns. | `text` | `syntax` is high value; semantic usually unnecessary initially. |
| `domain-no-infrastructure-dependency` | Does Domain avoid Spring web/persistence/infrastructure coupling unless profile allows it? | Domain imports/annotations/packages do not point to infrastructure/framework concerns. | `text` | `syntax` is enough for imports/annotations; semantic needed for hidden type aliases. |
| `repository-port-and-adapter-boundary` | Are repository ports and adapters separated clearly enough for the profile? | Interface/implementation/package boundary and Service dependency direction evidence. | `manual` | Cross-file and semantic evidence are eventually needed. |
| `dto-no-domain-entity-exposure` | Do API request/response boundaries avoid exposing domain entities directly? | Controller signatures use DTO/request/response types, with mapping evidence. | `manual` or `text` | `syntax` can detect signatures; semantic needed to prove domain/entity type. |
| `gradle-wrapper-real-verification` | Was real Gradle wrapper verification available and used? | `gradlew` presence/executable signal plus command log using wrapper. | `text` | No AST needed. |
| `fake-shim-absent` | Are obvious fake/no-op shims absent from core backend paths? | No TODO/not-implemented/hardcoded demo fallback in product-like paths. | `text` | No AST needed for first pass; syntax can narrow hotspots later. |

Vocabulary rules:

- Rule IDs are not parser names and must not encode implementation technology.
- Rule IDs should outlive the first analyzer. A text/manual report and a JavaParser report
  should both be able to use the same ID.
- Rule IDs must support `UNKNOWN`; unclear architecture should not be forced into `FAIL`.
- Rule IDs must stay backend-shape oriented. They should not become general Java lint rules.
- New IDs need HQ scope approval because every ID becomes a future support surface.

## Manual Backfill Plan Before AST Spike

The first v0.4 evaluation step should be a no-parser manual backfill over existing generated
Java/Spring smoke artifacts. The goal is to test whether the verified report schema and
stable rule IDs are readable, useful, and low-noise before any AST implementation exists.

This backfill is still a research/evidence exercise. It must not become a hidden
enforcement gate.

### Artifact Selection Criteria

Select two to three existing generated Java/Spring smoke outputs that have enough material
to fill the schema without rerunning OpenCode.

Prefer artifacts that include:

- generated Java/Spring product source files;
- `.persona/workflow/implementation-report.md` or equivalent implementation notes;
- `.persona/workflow/review-report.md` or equivalent review notes;
- `ph workflow check`, `ph workflow finish implement`, or backend-shape report output;
- Gradle wrapper or `npx ph bearshell` verification evidence;
- at least one clean workflow run and, if available, one run with known WARN/noise so the
  schema exercises both positive and mixed results.

Avoid artifacts that:

- are only README/planning smoke with no generated Java product code;
- lack enough source or log evidence to assign even `UNKNOWN` responsibly;
- are frontend/infra/non-Java outputs;
- are release packaging checks rather than generated app shape observations.

Candidate artifact families from current docs:

- clean short-TUI workflow smokes referenced by `v0.3.1-workflow-diagnostics-surface.md`;
- clean tarball workflow smoke evidence under `docs/current/evidence-reviews/`;
- Java/Spring planned implementation smoke summaries referenced by
  `v0.3.0-project-intake-philosophy-workflow.md`.

### Manual Evidence Source By Rule ID

| Rule ID | Manual evidence source | Minimum backfill action |
| --- | --- | --- |
| `controller-delegates-to-service` | Controller source, implementation report, review report. | Inspect controller handler methods and record whether they call Service-layer APIs. |
| `controller-no-repository-direct-dependency` | Controller imports, fields, constructor parameters, method bodies. | Record any Repository-like direct dependency or direct storage access. |
| `service-no-storage-id-sequence` | Service fields and method bodies. | Record storage collections, maps, counters, `AtomicLong`, `nextId`, or sequence ownership if present. |
| `domain-no-infrastructure-dependency` | Domain package source, imports, annotations. | Record Spring web/data/infrastructure imports or annotations in domain classes. |
| `repository-port-and-adapter-boundary` | Repository interfaces, infrastructure adapters, Service dependency types, package paths. | Record whether the Service depends on a port/interface and whether storage implementation lives outside Controller/Service. |
| `dto-no-domain-entity-exposure` | Controller signatures, request/response types, DTO packages, mapping code. | Record whether API boundary exposes domain entities or dedicated DTO/request/response types. |
| `gradle-wrapper-real-verification` | `gradlew` files, workflow reports, command logs. | Record whether final verification used project Gradle wrapper or `npx ph bearshell` path. |
| `fake-shim-absent` | Product-like source files, review report, obvious TODO/not-implemented scans. | Record TODO, hardcoded fake shim, throw-not-implemented, or placeholder code in primary paths. |

### PASS/WARN/FAIL/UNKNOWN Judgment

Use these judgment rules consistently across all artifacts:

- `PASS`: the evidence directly supports the rule and no contradictory evidence appears.
- `WARN`: evidence is mixed, weak, naming-dependent, profile-dependent, or likely acceptable
  but still needs review.
- `FAIL`: evidence directly contradicts the rule in a product-like path.
- `UNKNOWN`: the artifact lacks the files, logs, reports, or context needed to judge.

Do not use `FAIL` when the problem is missing evidence. Missing evidence is usually
`UNKNOWN`; only use `FAIL` when the available evidence shows a violation.

Examples:

- Controller calls `reservationService.reserve(...)` and has no repository field:
  `controller-delegates-to-service = PASS`.
- Controller has a `ReservationRepository` field but only uses it for trivial lookup in a
  toy scaffold: `controller-no-repository-direct-dependency = FAIL` or `WARN` depending on
  whether the path is product-like and in scope.
- Service has `Map<Long, Reservation>` and `AtomicLong nextId`: `service-no-storage-id-sequence = FAIL`.
- No generated source files are available, only an implementation report claim:
  source should be `manual`, confidence `low`, and most shape rules should be `UNKNOWN`.

### Confidence And Source Recording

Use confidence to describe evidence quality, not personal confidence in Persona Harness.

- `high`: source files plus report/log evidence agree.
- `medium`: source files are available but the rule depends on naming or partial context.
- `low`: only report text, summary text, or incomplete source excerpts are available.

Use source as follows:

- `manual`: human inspection of source/reports fills the finding.
- `text`: filename, string, token, or command-log evidence supports the finding.
- `syntax`: reserved for future parser/tree-pattern evidence; do not use in the manual
  backfill unless a non-AST structural tool is explicitly part of a later evaluation.
- `semantic`: reserved for future type/declaration-aware evidence; do not use in v0.4
  manual backfill.

Every manual finding should include at least one evidence item with file path or report path.
When evidence is absent, record a limitation instead of inventing a source.

### False-positive Review Process

After the first two to three artifacts are backfilled, run a cold review pass:

1. List all `FAIL` and `WARN` findings.
2. For each finding, ask whether a reasonable human reviewer would agree from the same
   evidence.
3. Mark disagreements as false positive candidates.
4. Classify the cause:
   - insufficient artifact evidence;
   - naming ambiguity;
   - profile/style variation;
   - rule wording too broad;
   - schema field too weak;
   - actual generated-code issue.
5. Update the rule limitation text before considering any parser spike.

The backfill should produce a short false-positive ledger:

```text
artifact | ruleId | result | reviewer verdict | cause | action
```

Parser work should not start while the same rule repeatedly creates unresolved false
positive candidates.

### Decision Criteria For v0.5 Parser Spike

Move from manual backfill to a v0.5 ast-grep or JavaParser spike only if all of these hold:

1. At least two artifacts were backfilled with the schema.
2. Each stable rule ID has at least one example finding or a documented reason for
   `UNKNOWN`.
3. The false-positive ledger has no unresolved high-impact false positives for the first
   candidate parser rules.
4. The next parser target is limited to two or three rule IDs.
5. The spike remains report-only and cannot affect build/test/workflow finish.

Prefer ast-grep when:

- the selected rules are syntax-only or token/annotation/import oriented;
- the goal is to measure simple structural noise quickly;
- no classpath/sourcepath setup should be required.

Prefer JavaParser sidecar design when:

- the selected rules need type/declaration/cross-file certainty;
- the manual backfill shows syntax-only checks would over-warn;
- the team is ready to define sourcepath/classpath and unresolved-symbol behavior.

Do not move to enforcement after the manual backfill. Enforcement remains a v1.0 opt-in
candidate only after verified reports prove low-noise across repeated clean runs.

## v0.5.0 Decision Gate

v0.5.0 should not include verified-report implementation or AST-related spike work just
because the schema exists. The gate is evidence-first: finish the v0.4 pilot, backfill real
artifacts, review false positives, then decide whether a tiny report-only parser spike is
worth the cost.

Current status:

- AST RFC exists.
- Verified report schema exists.
- Stable rule ID vocabulary exists.
- Manual backfill plan exists.
- v0.4 pilot plan exists, but the pilot has not produced complete backfilled artifacts yet.
- Recent continuation smoke evidence is useful but not sufficient: Java/Spring/Gradle
  generation and build/test can pass while workflow reports remain templates and finish
  gates block. Backend-shape WARNs around application/port/out repository ports or
  verification wording should be treated as candidate manual-backfill inputs, not as
  authorization for AST work.

### Proceed To Tiny Parser Spike Only If

All prerequisites must be true:

1. The v0.4 pilot has executed against the selected artifacts.
2. Two to three Java/Spring artifacts have been manually backfilled using the verified
   report schema.
3. Each backfilled artifact includes enough source/report/log evidence to justify its
   `PASS`, `WARN`, `FAIL`, or `UNKNOWN` findings.
4. A false-positive ledger exists and has been reviewed.
5. The candidate spike rule IDs are limited to two or three.
6. The selected rule IDs have low unresolved false-positive risk after manual review.
7. The proposed spike is explicitly report-only and cannot affect build, test, workflow
   finish, release, or generated project behavior.
8. Release and docs wording still avoids generated app quality certification claims.

If any prerequisite is missing, v0.5.0 should continue with report-only/manual backfill
work rather than AST/parser work.

### Which Spike Is Allowed

Only one tiny spike shape should be selected for v0.5.0:

- **ast-grep syntax-only spike:** allowed when the chosen rule IDs are import, annotation,
  field, token, or simple method-call shape checks and do not require Java type resolution.
- **JavaParser sidecar design spike:** allowed when the chosen rule IDs require type,
  declaration, or cross-file certainty and the sourcepath/classpath/unresolved-symbol plan is
  accepted before implementation.

JDT LS should remain out of v0.5.0 unless HQ explicitly decides that editor-grade workspace
semantics are worth the lifecycle and setup cost. That is a separate product decision.

### v0.5.0 Blockers

Any of these should block AST/verified-report implementation work in v0.5.0:

- v0.4 pilot did not execute.
- Fewer than two Java/Spring artifacts were manually backfilled.
- Backfill artifacts lack generated source, implementation/review reports, or verification
  logs.
- Workflow reports remain template in the primary candidate artifact.
- Finish gate remains blocked for reasons unrelated to backend-shape observation.
- False-positive ledger is missing.
- False-positive ledger has unresolved high-impact WARN/FAIL disagreements.
- More than three rule IDs are proposed for the first spike.
- The proposed spike can fail build/test/workflow finish.
- The proposed docs or release language implies generated app quality certification.
- Parser dependency, code prototype, release, publish, tag, or push is bundled into the same
  decision.

### v0.5.0 Allowed Output

If the gate passes, v0.5.0 may produce only one of these outputs:

- a report-only ast-grep spike plan or tiny implementation for two to three syntax-friendly
  rule IDs;
- a JavaParser sidecar design memo that defines sourcepath/classpath/unresolved-symbol
  behavior before implementation;
- a decision memo that keeps work manual/report-only because evidence is not mature enough.

The default should remain the third option until v0.4 artifacts and the false-positive ledger
show that automation would reduce ambiguity rather than amplify it.

## Recommended Phased Path

### P0 Now: Do Not Build AST Enforcement

Before any parser dependency, do this:

- keep alpha focused on workflow rail reliability, continuation, docs, and external smoke;
- freeze the backend-shape rule vocabulary as stable IDs derived from the current rubric;
- classify each desired check as syntax-only, naming-convention, cross-file, or semantic;
- define a report schema that supports `unknown` without pretending the tool knows more
  than it does;
- collect two or three representative generated Java/Spring runs where humans already
  know the expected backend-shape reading.

### v0.4: Verified Report Schema And Manual Backfill

v0.4 should stay implementation-free unless HQ explicitly opens a separate evaluation
work item. The default v0.4 deliverable is schema/design plus manual backfill, not an AST
prototype.

Recommended v0.4 shape:

- accept the verified report schema and stable rule IDs;
- hand-fill the schema against existing generated Java/Spring smoke outputs;
- mark every finding with `source: manual`, `text`, or both;
- record which rule IDs are too ambiguous for machine reading;
- decide whether a tiny analyzer spike is justified for v0.5.

### v0.5: Tiny Parser Spike Decision

v0.5 is the earliest reasonable point to decide whether to run a parser spike. It should
still be report-only.

Recommended prototype shape:

- use `ast-grep` for a first syntax-only spike if the goal is fast YAML rules and low
  integration cost;
- keep output outside build/test failure paths;
- map only two or three rules from the backend rubric;
- compare tool output against manual review on existing smoke artifacts;
- decide whether ast-grep noise is acceptable for syntax-only checks.

If ast-grep cannot express the needed Java/Spring boundary checks without fragile naming
assumptions, stop there and use the learning to specify a JavaParser sidecar.

### v0.5+ Or Later: JavaParser Sidecar RFC/Prototype

JavaParser should be considered only after the v0.4 schema/manual backfill and the v0.5
spike decision show that syntax-only checks are insufficient or too noisy.

Recommended shape:

- Java sidecar invoked by `ph review backend-shape --verified` or equivalent;
- JavaParser for AST traversal;
- JavaSymbolSolver only for selected semantic checks after source/classpath setup is
  reliable;
- explicit unresolved-state handling;
- JSON report plus markdown summary;
- fixtures covering Gradle Java/Spring examples, partial code, and unresolved dependencies.

### v1.0: Opt-in Enforcement Only After Evidence

v1.0 can consider enforcement only if verified reports have proven useful and low-noise.

Possible enforcement levels:

- `report-only`: default and safest.
- `warn-on-finish`: workflow finish reports WARN but does not fail.
- `fail-on-policy`: opt-in project policy fails only selected rule IDs.

Enforcement should never be global by default for all generated projects. It must be
project policy, profile-aware, and reversible.

## Product Moat Assessment

AST enforcement can become a moat, but only if it is PH-specific and evidence-oriented.

Real moat:

- a Java/Spring backend responsibility analyzer aligned with PH's workflow and rubric;
- reports that explain why generated code violates Controller/Application/Domain/Repository
  boundaries;
- integration with requirements, implementation report, review report, and evidence ledger;
- repeatable A/B evidence showing PH catches or prevents failures generic agents miss.

Weak moat:

- bundling ast-grep as a linter without PH-specific semantics;
- failing builds on generic syntax patterns;
- marketing "AST enforcement" before false-positive rates are known;
- adding heavy setup that makes clean alpha testing harder.

Cold read: the moat is not the parser. The moat is the verified backend-shape evidence
loop. AST tooling is only the measurement instrument.

## Non-goals For Alpha

- No AST parser dependency.
- No JavaParser sidecar.
- No JDT LS sidecar.
- No ast-grep runtime activation.
- No build/test failure gate.
- No generated-app quality certification.
- No frontend, infra, or broad multi-language analyzer.
- No release/publish/tag/push work from this RFC.

## Risks

- **False authority:** AST output can look objective while still missing semantic context.
- **False positives:** Clean code boundaries often depend on project conventions, not only
  syntax.
- **False negatives:** A syntax-only tool can miss dependency direction and runtime wiring.
- **Setup friction:** JDT LS and JavaParser symbol solving both need source/classpath
  configuration to be trustworthy.
- **Scope creep:** Analyzer work can pull PH away from the current workflow rail P0.
- **Support burden:** Once enforcement exists, users will expect rule suppression,
  configuration, stable IDs, and migration guidance.
- **Moat illusion:** Generic AST checks are easy to copy; PH's advantage must come from
  workflow/evidence integration.

## Acceptance Criteria Before Implementation

Do not implement AST analyzer code until these are true:

1. The backend-shape rule vocabulary is versioned with stable IDs and expected evidence.
2. Each candidate rule is classified as syntax-only, cross-file, or semantic.
3. At least three existing generated runs have manual expected readings for those rule IDs.
4. A report schema is accepted that supports `UNKNOWN` and confidence, not just PASS/FAIL.
5. HQ decides whether v0.4 uses ast-grep for a spike or skips straight to JavaParser design.
6. The command surface is defined as report-only and cannot block build/test/workflow finish.
7. Documentation language explicitly says verified report is not product-quality
   certification.
8. A false-positive budget and triage plan exist before any enforcement mode is discussed.

## Why Not Now / What To Do First

Do not start with AST enforcement now because the current product risk is still workflow
discipline, continuation, report completion, and external-smoke reliability. Adding a parser
would create a second support surface before the report semantics are stable.

What to do first:

1. Finish the current alpha P0: reliable workflow start/finish, evidence summary, docs, and
   external smoke.
2. Freeze the backend-shape rubric into candidate machine-readable rule IDs.
3. Write the verified report schema.
4. Run a no-dependency manual backfill over existing smoke outputs using the new schema.
5. Only then choose whether v0.5 should run an ast-grep or JavaParser spike.

Recommended first parser experiment:

- use ast-grep only for a narrow syntax-only report spike after v0.4 schema/manual backfill;
  or
- if HQ wants semantic boundary checks, write a JavaParser sidecar RFC first and defer the
  prototype until the sourcepath/classpath plan is accepted.

Recommended long-term path:

```text
v0.4: report schema + manual backfill, no AST implementation
v0.5: tiny report-only ast-grep or JavaParser spike decision
v1.0: opt-in enforcement policy after low-noise evidence
```

The product should say: "Persona Harness can produce verified backend-shape evidence."
It should not yet say: "Persona Harness enforces generated app quality."
