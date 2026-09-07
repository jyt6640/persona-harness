# Code Quality And Refactoring

Load this when naming, splitting, cleaning, or restructuring Java code. It distills clean-code, implementation-pattern, refactoring, and architecture-boundary themes into operational rules.

## Clean Code Baseline

Readable code is code whose intent can be understood without reconstructing the author's private reasoning.

Hard rules:

- names reveal intent;
- methods do one thing at one abstraction level;
- classes own one cohesive responsibility;
- comments explain why, not what unclear code does;
- errors are handled without obscuring the main flow;
- formatting is automated;
- dead code is deleted;
- duplication is removed when it represents one concept changing together.

## Naming

| Thing | Rule |
|---|---|
| class | noun or domain role: `Reservation`, `PaymentPolicy`, `MemberValidator` |
| method | verb phrase: `cancel`, `calculateFee`, `validateNotDuplicated` |
| boolean | predicate: `isExpired`, `hasEmail`, `canReserve` |
| collection | plural domain role: `orders`, `reservedSeats` |
| exception | failed rule or boundary failure |
| package | business/domain concept or explicit technical boundary |

Avoid vague names: `Manager`, `Helper`, `Util`, `Processor`, `Handler`, `Common`, `Base`, `Data`, `Info`, `process`, `handle`, `doWork`.

## Method Shape

- One method has one reason to read it.
- Keep one abstraction level per method.
- Prefer early return/throw over nested branches.
- Keep parameter lists short.
- Replace flag parameters with separate methods, enum/strategy, or command objects.
- A method name containing `and` is a split signal.
- Extract a method when a block needs a comment to explain what it does.

## Class Shape

- One class owns one concept.
- Public API is smaller than private implementation.
- Fields are private; mutable fields need a reason.
- Dependencies are explicit constructor parameters.
- Static methods are for pure, ownerless operations only.
- Do not create dump files or dump packages.

## Comments

Good comments:

- explain non-obvious tradeoffs;
- document protocol, concurrency, performance, or security constraints;
- link to issue/decision context;
- warn about surprising external behavior.

Bad comments:

- repeat the code;
- compensate for poor names;
- describe dead code;
- promise future cleanup without owner/issue;
- preserve commented-out code.

## Refactoring Definition

Refactoring changes internal structure while preserving observable behavior.

Refactoring loop:

1. Identify the behavior to preserve.
2. Ensure a test or characterization covers it.
3. Make one small structural change.
4. Run the relevant test.
5. Commit/stop at a coherent checkpoint.

Do not mix behavior change and structural change unless the user explicitly asked for both and the diff remains reviewable.

## Code Smells

| Smell | Typical fix |
|---|---|
| duplicated code | extract shared concept or keep duplication if concepts differ |
| long method | extract method, split phase, introduce query |
| large class | extract class, policy, value object, first-class collection |
| long parameter list | introduce parameter object/command/value object |
| feature envy | move method near the data |
| data class | move behavior into the data owner |
| primitive obsession | introduce value object or enum |
| switch on type/code | polymorphism, enum behavior, sealed variant |
| shotgun surgery | move responsibility or introduce boundary |
| speculative generality | inline/delete unused abstraction |
| message chain | hide navigation behind an intention method |
| global mutable state | introduce owner/lifecycle |

## Safe Refactoring Moves

- rename for intent;
- extract method;
- inline method when abstraction hides nothing;
- move method/field to the owner;
- introduce parameter object;
- replace temp with query;
- split phase;
- replace conditional with polymorphism;
- introduce assertion for internal invariant;
- separate query from modifier.

## Architecture Boundary

Architecture is not ceremony. Use boundaries when they reduce change cost.

Rules:

- policy should not depend on detail;
- framework/database/web/UI are details;
- data crossing a boundary is translated into the inner model;
- ports live where the stable policy needs the role;
- adapters depend inward;
- boundary tests should prove translation and dependency direction.

For tiny code, keep the boundary mental model without adding empty layers.

## 250 Pure LOC Rule

A Java source file over 250 non-blank, non-comment lines is a design smell.

Required behavior:

- if creating a new file, split before it crosses 250;
- if editing a >250 file, split the touched responsibility before adding behavior when feasible;
- exceptions are generated files or pure data tables with a short justification.

## Review Checklist

- Can names replace explanatory comments?
- Does every method do one job?
- Does each class have one reason to change?
- Are comments still true and useful?
- Is refactoring behavior-preserving and test-covered?
- Did you remove speculative abstraction?
- Are policy/detail dependencies pointed the right way?
