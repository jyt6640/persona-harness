# Java Parser Candidate and Fixture Contract

## Goal

Guard/AST/linter observation을 구현하기 전에 Java parser 후보와 fixture contract를 문서로 고정한다.

이번 loop는 설계 비교만 한다. parser dependency 설치, AST observer 구현, linter 실행, Guard hook, npm script 추가, build/test failure 연결은 하지 않는다.

## Context

이전 결정은 `docs/phase-next-guard-ast-linter-observation-design.md`에서 AST-first report-only observation 후보를 추천했다.

이번 문서는 그 다음 단계다. "AST"라는 단어를 넓게 쓰지 않고, 실제 후보가 AST인지 CST인지 구분한다.

## Sources Checked

- [JavaParser README](https://github.com/javaparser/javaparser/blob/master/readme.md)
- [tree-sitter-java README](https://github.com/tree-sitter/tree-sitter-java/blob/master/README.md)
- [jhipster/prettier-java java-parser package](https://github.com/jhipster/prettier-java/tree/main/packages/java-parser)
- Context7 docs for `/javaparser/javaparser` and `/tree-sitter/tree-sitter-java`

이 source들은 후보 특성 확인용이다. 이번 loop에서 dependency를 설치하거나 실행하지 않았다.

## Candidate Comparison

| Candidate | Shape | Runtime fit | Strength | Risk |
| --- | --- | --- | --- | --- |
| A. `java-parser` npm package | JavaScript parser producing CST, not AST | Best fit for current TypeScript/Node harness | No JVM sidecar; parses Java text and exposes visitor traversal; enough for import/type/member/method-call fixture contract | CST traversal can be verbose; not semantic; package focus is prettier Java tooling |
| B. `tree-sitter-java` | tree-sitter Java grammar producing concrete syntax tree | Good fit if Node binding setup is acceptable | Tolerant syntax-tree style; parse errors are observable; useful for partial/incremental parsing | Native/binding setup may be heavier; node type queries need grammar-specific work; not semantic |
| C. JavaParser JVM library | Java AST with optional symbol solver | Poor first fit for TypeScript/Node-only harness | Rich Java AST; Java 1.0-25 support; symbol solver exists for later semantic questions | Requires JVM/Maven/Gradle sidecar or subprocess; overkill for current report-only fixture; larger integration surface |

## Decision

First implementation candidate: **Candidate A, `java-parser` npm package**, as a structured parser observation candidate.

Important wording:

- Do not call Candidate A a true AST implementation.
- It is CST-based structured parsing.
- That is acceptable for the first report-only observation because the fixture contract only needs syntax-shape evidence: imports, fields, constructor parameters, and method call receivers.

Fallback candidate:

- **Candidate B, `tree-sitter-java`**, if partial-source tolerance or explicit parse-error reporting becomes more important than simple Node package fit.

Deferred candidate:

- **Candidate C, JavaParser JVM library**, only if later loops require symbol solving, Java language-level validation, or richer AST semantics.

## Why

Candidate A is the smallest next step because Persona Harness is currently a TypeScript package and Phase 1.2 already has TypeScript observer/report code.

Candidate B is attractive but introduces binding and query work before the project has proven that parser-backed observation gives better evidence than the string observer.

Candidate C is the strongest Java AST candidate, but it would introduce a Java-side runtime boundary before the observation contract actually needs semantic resolution.

## Fixture Contract

The first parser-backed observation fixture must stay narrow.

### Input

- One UTF-8 Java source file.
- File path ends with `Controller.java`.
- File content is from a Java/Spring backend fixture or a unit-test string fixture.
- No cross-file classpath, package scan, or project build is required.

### Controller Recognition

PASS/WARN observation may proceed only when:

- file name ends with `Controller.java`, and
- the parsed file has a class or interface declaration whose name ends with `Controller`.

If either condition is not true, finding is `UNKNOWN`.

### Evidence Nodes

The parser-backed observer may inspect only these syntax shapes:

- import declaration ending in `Repository`, or package wildcard import containing `.repository.`
- field/member declaration whose type name ends in `Repository`
- constructor parameter whose type name ends in `Repository`
- method invocation whose receiver is a repository variable collected from field/member or constructor parameter evidence

The first fixture contract does not require:

- symbol solving
- type inference
- local variable dataflow
- method return type tracing
- wildcard package resolution
- annotation semantics
- Lombok semantics
- Spring dependency graph analysis

## Finding Contract

### PASS

Return `PASS` when:

- target is a recognizable Controller file, and
- no Repository import evidence exists, and
- no Repository field evidence exists, and
- no Repository constructor parameter evidence exists, and
- no repository receiver method-call evidence exists.

Service-only dependency remains a PASS candidate.

### WARN

Return `WARN` when any of the allowed evidence nodes shows direct Repository dependency:

- Repository import
- Repository field/member
- Repository constructor parameter
- repository receiver method call

WARN remains report-only. It is not a build/test failure.

### UNKNOWN

Return `UNKNOWN` when:

- file is not a Controller target
- parser throws
- parse result has unrecoverable syntax errors
- Controller class cannot be identified
- multiple Controller classes make evidence ownership ambiguous
- method-call receiver cannot be tied to a collected repository variable
- source is partial enough that import/member/constructor/method nodes cannot be trusted

UNKNOWN is an observation limitation, not a quality failure.

## Report Contract

Report output remains ignored-only.

Candidate paths:

- `.persona/evidence/phase-next/java-parser-observation-report.md`
- `experiments/phase0-runs/{timestamp}/java-parser-observation-report.md`

Report sections:

```md
# Java Parser Observation Report

## Target

## Parser Candidate

## Finding

PASS / WARN / UNKNOWN

## Evidence

- import:
- field:
- constructor parameter:
- method call:

## Limitations

## Decision

rule/prompt improvement candidate: yes/no
quality gate: no
build/test failure: no
```

## Non-Goals

- No parser dependency install in this loop.
- No implementation.
- No linter execution.
- No Guard hook.
- No enforcement gate.
- No build/test failure connection.
- No product-quality guarantee.
- No profile-aware extension.
- No OMO workflow or skill adaptation.
- No expansion beyond Controller direct Repository dependency.

## Next Loop

Completed follow-up:

```text
Before implementation, run a no-install spike against package metadata only to confirm Candidate A packaging,
module format, and TypeScript import shape.
```

The metadata spike is recorded in `docs/phase-next-java-parser-metadata-spike.md`.

Completed follow-up:

```text
Run a minimal `java-parser` dependency/compile spike before implementing the smallest report-only parser prototype.
```

The compile/import spike confirmed that `java-parser` can be imported from the current TypeScript/Vitest setup,
but it also surfaced transitive `npm audit` findings through Chevrotain/Lodash.

Recommended next decision loop:

```text
Decide whether the `java-parser` audit surface is acceptable for an ignored report-only prototype,
or switch Candidate A before any parser-backed observer implementation.
```
