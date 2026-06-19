# Performance Discipline

Load this when code touches latency, throughput, memory, GC, IO, logging, DB access, synchronization, loops, collection size, or performance claims.

This guide synthesizes Java performance tuning topics commonly organized around measurement tools, `String`, collections, loops, `static`, class/reflection costs, synchronization, IO bottlenecks, logging, web/Spring issues, DB issues, server settings, GC, JMX, and application inspection.

## Prime Rule

Performance work starts with evidence.

Required loop:

1. State the symptom: latency, throughput, CPU, allocation, GC pause, lock contention, IO wait, DB time, startup, memory footprint.
2. Reproduce it.
3. Measure with the right tool.
4. Change one thing.
5. Measure again.
6. Keep the change only if it improves the target without unacceptable clarity or correctness cost.

No measurement, no tuning claim.

## Measurement Tools

| Need | Tool shape |
|---|---|
| microbenchmark | JMH, not ad-hoc `System.currentTimeMillis` loops |
| runtime profiling | profiler, JFR, async-profiler, IDE profiler |
| production symptom | APM, metrics, tracing, structured logs |
| JVM memory/GC | GC logs, JFR, JMX, heap dump |
| DB bottleneck | query plan, slow query log, connection pool metrics |
| concurrency | thread dump, lock profiling, pool metrics |

Simple timing is allowed only for rough local orientation, never as proof.

## Allocation And String

- Avoid repeated string concatenation in explicit loops; use `StringBuilder` when building incrementally.
- Do not use `StringBuffer` unless synchronization is required.
- Beware substring/splitting/regex allocation in hot paths.
- Reuse compiled `Pattern` for repeated regex.
- Avoid creating temporary collections just to immediately iterate them.
- Do not intern strings casually.

## Collections

- Pick the collection by access pattern.
- Pre-size `ArrayList`/`HashMap` when the size is known and large.
- Use `Set` for membership checks, not `List.contains` on unbounded lists.
- Use `EnumMap`/`EnumSet` for enum keys/sets.
- Avoid nested loops over large collections; index by key first.
- Do not copy collections defensively in tight loops unless boundary safety requires it.

## Loops, Streams, And Parallelism

- A clear loop is acceptable and often faster to reason about.
- Streams are for clarity, not automatic speed.
- Parallel streams require evidence and a safe workload: CPU-bound, large enough, no shared mutable state, no blocking IO.
- Avoid boxing in hot numeric loops.
- Watch accidental repeated computation inside loop conditions or stream operations.

## Static And Caching

- `static final` constants are fine.
- Static mutable caches need lifecycle, size bound, invalidation, concurrency policy, and tests.
- Do not cache before measuring.
- Do not hide service dependencies in static accessors.

## Reflection, Annotations, And Class Metadata

- Reflection is a boundary/tooling mechanism, not core business logic.
- Cache reflective lookup only when measured and safe.
- Prefer method handles or generated code only when reflection is proven hot.
- Annotation-heavy frameworks can affect startup and scanning; measure startup separately from request performance.

## Synchronization And Shared State

- Prefer immutability and ownership over locks.
- Keep synchronized sections small.
- Never perform blocking IO while holding a lock unless deliberately designed.
- Use concurrent collections and atomic types for the right problem, not as decoration.
- Thread safety must be documented on shared classes.

## IO, Network, And Database

- IO dominates CPU micro-optimizations in most backend paths.
- Set timeouts.
- Use buffering deliberately.
- Avoid reading whole large streams into memory.
- DB performance starts with query shape, indexes, fetch size, batching, and transaction boundaries.
- Watch N+1 access and unbounded result sets.

## Logging

- Do not build expensive log messages when the level is disabled.
- Use parameterized logging.
- Avoid logging inside hot loops unless sampled or guarded.
- Logs are observability data, not control flow.
- Never log secrets.

## GC And Memory

- GC tuning follows allocation evidence.
- Reduce object churn before tuning flags.
- Look for large temporary collections, repeated string processing, boxing, and caches.
- Heap dumps and allocation profiles beat guesses.
- Choose GC/logging flags per runtime and workload; do not copy old JVM folklore blindly.

## Review Checklist

- What exact symptom is being improved?
- What measurement proves the symptom?
- What changed?
- What measurement proves improvement?
- Did clarity or correctness get worse?
- Is there a test or benchmark protecting the important behavior?
