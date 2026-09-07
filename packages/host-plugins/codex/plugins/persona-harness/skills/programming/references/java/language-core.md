# Java Language Core

Load this for every Java source file. This file covers the basic grammar and execution topics repeatedly surfaced by Java fundamentals books and TOCs: program structure, variables/types, operators/control flow, references, classes, inheritance, interfaces, nested/anonymous types, modules, exceptions, java.base, IO/network/DB basics, and recent language features.

## Runtime Mental Model

1. A Java program is compiled to bytecode and executed by the JVM. Do not reason as if source code runs directly.
2. Primitive values and object references behave differently. Know when you are copying a value versus copying a reference.
3. `==` on object references is identity comparison. Logical comparison uses `equals`.
4. Objects live beyond the stack frame that created them. Mutation through one reference is visible through another reference to the same object.
5. Class loading, static initialization, and instance construction are separate phases. Do not hide real work in static initialization.

## Program Structure

| Construct | Rule |
|---|---|
| package | Names ownership and visibility. Package by business/domain concept, not by generic layer unless the project is explicitly a library. |
| class | Use when there is identity, lifecycle, mutable behavior, or hidden representation. |
| record | Use for transparent immutable data, not lifecycle entities. |
| enum | Use for a closed named set; add behavior to the enum when the behavior belongs to the variant. |
| sealed type | Use for a closed hierarchy where exhaustive handling matters. |
| interface | Use for a role/capability or port. Do not create an interface only because "everything needs an interface." |
| module | Treat as a strong boundary. Export only what callers should depend on. |

## Variables And Types

- Prefer the narrowest type that preserves meaning.
- Avoid primitive obsession: domain-significant `String`, `long`, `int`, and `BigDecimal` values usually deserve a value object.
- Use `var` only when the initializer makes the type obvious and the name carries meaning.
- Constants are `static final`, named by meaning, and immutable.
- Do not use mutable global state. If shared state is unavoidable, name the owner and concurrency policy.

## Operators And Control Flow

- Keep conditions readable. Extract a predicate when a condition needs explanation.
- Use early return/throw to reduce nesting.
- Use `switch` expressions for closed alternatives; use exhaustive handling for enums/sealed variants.
- Do not use boolean flags to select a business policy. Split methods or introduce a policy object.
- Loops are fine. A loop is often clearer than a stream when there is mutation, early exit, multiple outputs, or exception-heavy logic.

## References, Null, And Absence

- Null is a boundary concern. Reject or normalize it at construction/input boundaries.
- Return empty collections instead of null.
- Use `Optional<T>` for return values that may be absent. Do not use `Optional` as a field, parameter, or collection element by default.
- Do not call `get()` on `Optional` unless presence has already been proven in the same small scope.
- Never use null to mean multiple states. Use an enum, sealed type, or explicit result object.

## Class And Member Design

- Keep fields private.
- Make fields `final` unless mutation is the object's named purpose.
- No public setters by default. Mutating methods name the domain action, not the field.
- Constructors establish invariants. An object that exists should be valid.
- Keep public API smaller than implementation. Widen visibility only for a caller that should exist.
- Nested classes are for tightly coupled implementation details. If the nested type has domain meaning, make it a top-level type.

## Inheritance And Interfaces

- Prefer composition over inheritance.
- Use inheritance only when substitutability is true and stable.
- Do not inherit just to reuse code.
- An abstract class is acceptable when there is shared state or shared implementation that truly belongs to the hierarchy.
- An interface is a role. Name it by the capability it offers, not by the implementation it hides.

## Exceptions

- Throw typed exceptions for meaningful failures.
- Preserve the cause when translating exceptions across a boundary.
- Catch only what you can handle.
- Broad catch is allowed only at a boundary that logs/converts once.
- Do not use exceptions for ordinary local branch control.

## Resource Handling

- Use `try-with-resources` for closeable resources.
- Do not manually close in a separate control path when language support can close deterministically.
- IO, network, database, and process boundaries must expose timeout/error behavior.
- Encoding and locale are explicit when text crosses a process or network boundary.

## Recent Java Feature Use

- Use records for immutable data carriers with obvious components.
- Use sealed classes/interfaces for closed business variants.
- Use pattern matching where it makes type handling clearer and still exhaustive.
- Use text blocks for multi-line literals, but keep SQL/JSON ownership clear.
- Use modules only when module boundaries are a real project concern.

## Review Checklist

- Can a reader explain object identity, equality, and mutation in this code?
- Are null and absence represented deliberately?
- Are class, record, enum, interface, and sealed type choices intentional?
- Is control flow easy to trace?
- Are resources closed and boundary errors explicit?
- Did you avoid using a framework feature to compensate for weak Java modeling?
