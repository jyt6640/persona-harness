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

### v0.4: Verified Report Design And Thin Prototype

v0.4 should add design and a tiny report-only prototype, not enforcement.

Recommended prototype shape:

- use `ast-grep` for a first syntax-only spike if the goal is fast YAML rules and low
  integration cost;
- keep output outside build/test failure paths;
- map only two or three rules from the backend rubric;
- compare tool output against manual review on existing smoke artifacts;
- decide whether ast-grep noise is acceptable for syntax-only checks.

If ast-grep cannot express the needed Java/Spring boundary checks without fragile naming
assumptions, stop there and use the learning to specify a JavaParser sidecar.

### v0.5: JavaParser Sidecar RFC/Prototype

v0.5 is the earliest reasonable place for a PH-owned Java analyzer.

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
5. Only then choose the first parser experiment.

Recommended first parser experiment:

- use ast-grep only for a narrow syntax-only report spike in v0.4; or
- if HQ wants semantic boundary checks immediately, skip ast-grep and design a JavaParser
  sidecar for v0.5.

Recommended long-term path:

```text
v0.4: report schema + tiny report-only ast-grep spike
v0.5: JavaParser sidecar prototype for verified backend-shape reports
v1.0: opt-in enforcement policy after low-noise evidence
```

The product should say: "Persona Harness can produce verified backend-shape evidence."
It should not yet say: "Persona Harness enforces generated app quality."
