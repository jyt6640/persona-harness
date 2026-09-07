# Java Foundations Orchestrator

This is the routing file for Java fundamentals. It is intentionally small.

The foundation rules are split by topic, not by book. The source research came from public tables of contents, publisher pages, and study summaries for the user's Java/OOP/design/testing canon; the rules below are synthesized concepts, not copied book text.

## Load Policy

For any `.java` file, load this file first. Then load **one focused topic file** that matches the change. Do not load every foundation topic by default.

Baseline examples:

| Change | Load |
|---|---|
| ordinary Java syntax/type/resource change | `language-core.md` |
| construction/equality/generics/streams/Optional | `java-idioms.md` |
| object behavior, responsibility, encapsulation, patterns | `object-collaboration.md` |
| naming, smells, refactoring, method/class shape | `code-quality-refactoring.md` |
| tests | `test-design.md` |

Then load a specialized file when relevant:

| Work involves | Also load |
|---|---|
| performance, memory, GC, latency, throughput, profiling | `performance-discipline.md` |
| threads, locks, futures, async, reactive streams, shared state | `concurrency-discipline.md` |
| Spring, HTTP, DB, transactions, migrations, observability | `backend.md` |
| domain layer/entity/policy/repository/service architecture | the matching architecture reference from `README.md` |

## Foundation Invariants

1. Java code must reveal execution flow clearly: construction, state, mutation, error paths, and resource ownership are visible.
2. Classes exist because an object owns a responsibility in a collaboration, not because a table or request field exists.
3. Types carry meaning: value objects, typed IDs, records, enums, sealed variants, and generics replace primitive soup.
4. Implementation choices are deliberate: constructor/factory, equality, collection type, exception type, stream/loop, and mutability are all design decisions.
5. Refactoring preserves behavior and happens under tests.
6. Performance changes require measurement.
7. Tests protect behavior, resist harmless refactoring, run fast enough for their layer, and stay maintainable.

## Source Research Baseline

Use these only as provenance for the synthesis. Do not quote or reproduce book chapters.

- Java fundamentals/API topics: `자바의 신`, `이것이 자바다`
- Java idioms: `Effective Java`, `모던 자바 인 액션`
- Object design: `객체지향의 사실과 오해`, `오브젝트`, `객체지향과 디자인 패턴`
- Implementation/refactoring/architecture: `켄트 벡의 구현 패턴`, `클린 코드`, `리팩토링`, `클린 아키텍처`
- Performance: `개발자가 반드시 알아야 할 자바 성능 튜닝 이야기`
- Testing: `테스트 주도 개발`, `단위 테스트`, `xUnit Test Patterns`
