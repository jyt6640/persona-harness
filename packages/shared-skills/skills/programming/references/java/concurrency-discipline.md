# Concurrency Discipline

Load this when code touches threads, executors, locks, synchronization, futures, `CompletableFuture`, parallel streams, reactive APIs, scheduling, shared mutable state, or async boundaries.

## Prime Rule

Concurrency is a design boundary. Name the owner of work, state, cancellation, errors, and lifecycle before writing code.

## Shared State

- Prefer immutable data.
- Prefer thread confinement.
- If state is shared, document who owns it and how visibility is guaranteed.
- Do not expose mutable collections across threads.
- Use `volatile`, locks, atomics, and concurrent collections only for problems they actually solve.

## Locks And Synchronization

- Keep critical sections small.
- Do not call external services, blocking IO, user callbacks, or logging-heavy code while holding a lock.
- Always lock in a consistent order when multiple locks are required.
- Prefer higher-level concurrency utilities over manual wait/notify.
- A synchronized method is a class-wide design decision, not a quick patch.

## Executors And Thread Pools

- Do not use unbounded pools casually.
- Name thread pools by responsibility.
- Set queue/backpressure/rejection policy consciously.
- Shut down executors you own.
- Do not block common pools with long IO work.
- Measure pool saturation and queue growth.

## CompletableFuture

Use `CompletableFuture` when composing asynchronous stages improves the boundary.

Rules:

- choose the executor explicitly for non-trivial async work;
- handle exceptional completion deliberately;
- avoid chains that hide business logic;
- avoid blocking `join/get` in the middle of async composition;
- keep stage functions small and named when they are not obvious.

## Parallel Streams

Parallel streams are not a default performance tool.

Use only when:

- the source is large enough;
- work is CPU-bound;
- operations are stateless and non-blocking;
- the collector/reduction is safe;
- measurement shows benefit.

Otherwise use a loop, regular stream, or explicit executor.

## Reactive APIs

Reactive programming is justified by streaming, backpressure, many concurrent IO flows, or a reactive dependency chain. It is not justified by wanting code to look modern.

Rules:

- define backpressure behavior;
- keep blocking calls off reactive event loops;
- make cancellation and error paths visible;
- test timing with deterministic hooks, not sleeps;
- do not mix reactive and imperative code casually.

## Thread Safety Documentation

For shared classes, state one of:

- immutable;
- thread-confined;
- externally synchronized;
- internally synchronized;
- lock-free/atomic with documented invariants;
- not thread-safe.

## Testing Concurrent Code

- Avoid `Thread.sleep` as synchronization.
- Use latches, barriers, virtual time, test schedulers, or observable completion signals.
- Stress tests complement unit tests; they do not replace deterministic tests.
- Capture and assert async exceptions.

## Review Checklist

- Who owns the thread/executor/lifecycle?
- Who owns shared state?
- Is cancellation defined?
- Are exceptions observed?
- Is blocking isolated from event loops/common pools?
- Is the concurrency model testable without timing flakes?
- Was performance measured if concurrency was introduced for speed?
