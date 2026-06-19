# Java Idioms

Load this for every Java source file. It distills the repeated idiom topics from effective Java usage and modern Java material: object creation/destruction, methods common to all objects, classes/interfaces, generics, enums/annotations, lambdas/streams, methods, exceptions, concurrency, and serialization.

## Creation And Destruction

- Prefer a named static factory when creation mode matters: `of`, `from`, `parse`, `create`, `restore`.
- Prefer a constructor when the type has one obvious complete initialization path.
- Use a builder only when there are many optional parameters or readability would otherwise collapse.
- Do not let builders bypass invariants.
- Avoid finalizers/cleaners for normal resource management. Use explicit ownership and `try-with-resources`.
- Avoid hidden object creation in hot paths until measured; avoid premature pooling.

## Equality, Hashing, String Form, Ordering

- Override `hashCode` whenever overriding `equals`.
- Value objects compare by value.
- Entities compare by stable identity; unsaved/null-id entities should not collapse into equality.
- `toString` is for diagnostics, not a stable user-facing protocol.
- Implement `Comparable` only when the type has one natural ordering. Otherwise provide named comparators.
- Never put mutable equality fields into hash-based collections.

## Classes And Interfaces

- Minimize mutability.
- Favor composition and delegation over inheritance.
- Design inheritance explicitly or prohibit it.
- Keep fields private and APIs intention-revealing.
- Interfaces represent roles/capabilities. Avoid one-implementation interfaces unless they form a real boundary.
- Static utility classes are a last resort for stateless operations with no natural owner. Do not create `Util` as a dumping ground.

## Generics

- Do not use raw types.
- Prefer generic methods when the type relation belongs to one operation.
- Use bounded wildcards to express producer/consumer variance.
- Keep unchecked warnings localized and justified. Do not spread casts through callers.
- Prefer type-safe heterogeneous containers only when the use case is truly heterogeneous.
- If generics make the domain harder to read, introduce a named type.

## Enums And Annotations

- Use enums for a closed set of named values.
- Put variant-specific behavior on enum constants when it replaces scattered switches.
- Use `EnumSet` and `EnumMap` for enum-keyed collections.
- Use annotations for metadata consumed by tools/frameworks. Do not hide business rules in annotations that the core cannot see.
- Prefer type-safe enum/strategy shapes over integer/string constants.

## Lambdas

- Use lambdas for behavior parameterization when the behavior is small and local.
- Prefer method references only when they are clearer than the lambda.
- Keep captured variables effectively final and obvious.
- Do not put multi-branch business logic inside a lambda. Extract a named method or policy.
- Avoid lambdas that throw checked exceptions awkwardly; a loop or adapter may be clearer.

## Streams

Use streams for collection transformation, filtering, grouping, and aggregation when the pipeline reads left-to-right.

Avoid streams when:

- side effects are central;
- early exit logic dominates;
- debugging each step matters;
- checked exceptions dominate;
- multiple outputs are produced;
- parallelism is being guessed.

Rules:

- no side effects in `map`, `filter`, or `peek`;
- name complex predicates/functions;
- keep pipeline length reasonable;
- choose collectors deliberately;
- measure before using parallel streams.

## Optional

- Use `Optional` as a return type for possible absence.
- Do not use `Optional` fields by default.
- Do not accept `Optional` parameters by default.
- Do not return null from a method that returns `Optional`.
- Prefer `orElseGet` when fallback construction is expensive.

## Method Contracts

- Validate public boundary arguments.
- Keep parameters few. Group recurring parameter sets into value objects or commands.
- Return the most specific meaningful result, not raw maps or arrays.
- Document non-obvious preconditions, postconditions, thread-safety, and ownership.
- Do not make callers remember call ordering when the type system can encode it.

## Serialization

- Avoid Java native serialization for new code unless the project explicitly requires it.
- Prefer explicit formats and schemas at boundaries: JSON, Protobuf, Avro, SQL rows, etc.
- Do not expose domain internals just to satisfy serialization.
- Serialization shape is a boundary DTO, not necessarily the domain shape.

## Review Checklist

- Is construction named and invariant-preserving?
- Is equality/hash/ordering explicit and safe?
- Are generics helping type safety without erasing domain language?
- Did lambdas/streams improve clarity rather than hide control flow?
- Is absence modeled with `Optional` or an explicit result, not null folklore?
- Are serialization and framework shapes kept at boundaries?
