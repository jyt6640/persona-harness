# Object Collaboration

Load this when designing or editing classes that hold business behavior. It distills the repeated OOP content around role, responsibility, collaboration, messages, encapsulation, dependency, composition, polymorphism, and patterns.

## Start From Collaboration

Before choosing classes:

1. Name the user-visible behavior.
2. Describe the collaboration needed to produce it.
3. Identify the messages exchanged.
4. Assign responsibilities to objects.
5. Decide which responsibilities are stable roles.
6. Choose class/interface/record/enum/sealed shapes last.

Tables, screens, and request fields are not a design. They are inputs to design.

## Role, Responsibility, Collaboration

| Concept | Working rule |
|---|---|
| Collaboration | The runtime interaction that fulfills a behavior. It gives objects their context. |
| Responsibility | What an object knows or does for a collaboration. |
| Role | A replaceable set of responsibilities. Multiple objects may play the same role. |
| Message | The only thing one object should ask another object to handle. |

If a class has state but no responsibility, it is a data bag. If a service has all decisions, it is stealing responsibilities.

## Object Autonomy

An object should:

- own its invariants;
- expose behavior, not raw internal state;
- decide using the data it owns;
- ask collaborators through intention-revealing messages;
- hide representation changes from callers.

Avoid:

```java
if (reservation.getOwnerId().equals(userId) && reservation.getStatus() == WAITING) {
    reservation.setStatus(CANCELED);
}
```

Prefer:

```java
reservation.cancelBy(userId);
```

## Responsibility Assignment

Assign a responsibility to the object that has the information or can naturally coordinate the collaborators.

Use these questions:

- Who has the data needed to decide?
- Who should know this rule changed?
- Which object can answer without exposing internals?
- Which role would make this collaborator replaceable?
- Does assigning this responsibility increase cohesion or create feature envy?

## Encapsulation

Encapsulation is decision hiding, not getter/setter hiding.

Symptoms of weak encapsulation:

- callers fetch fields and make business decisions;
- setters expose invalid intermediate states;
- multiple callers repeat the same condition;
- a change in one class's representation forces changes in many callers;
- tests assert internal steps instead of observable behavior.

Fix by moving behavior to the owner, introducing a value object, or extracting a policy.

## Type, Class, And Abstraction

- A type is a set of behavior expectations.
- A class is one implementation mechanism.
- Do not confuse "has a class" with "has a useful abstraction."
- Abstract only after concrete responsibilities are clear.
- A role interface is useful when callers need substitutability.

## Cohesion And Coupling

High cohesion means a class changes for one family of reasons. Low coupling means a change does not ripple through unrelated collaborators.

Watch for:

- feature envy: a method uses another object more than its own object;
- divergent change: one class changes for unrelated reasons;
- shotgun surgery: one change requires tiny edits everywhere;
- middleman: a class only forwards without owning a responsibility;
- inappropriate intimacy: classes know each other's internals.

## Composition, Inheritance, Polymorphism

- Prefer composition for reuse.
- Use inheritance only for true substitutability.
- Use polymorphism to replace business switches when behavior varies by type/role.
- A sealed hierarchy is a good fit for closed variants.
- A strategy/policy object is a good fit for pluggable algorithms or rules.
- Do not introduce a pattern before the variation pressure exists.

## Pattern Use

Patterns are names for recurring forces, not mandatory architecture.

| Pressure | Candidate shape |
|---|---|
| interchangeable rule/algorithm | Strategy or Policy |
| variant-specific behavior | State, sealed variant, enum behavior |
| external API mismatch | Adapter |
| complex creation with named alternatives | Factory or Builder |
| event notification | Observer or domain event |
| cross-boundary dependency | Port/Adapter |

Reject pattern use when it creates indirection without reducing change cost.

## Dependency Direction

Dependencies should point toward stable policy and away from volatile detail.

- Domain policy should not depend on frameworks.
- Use cases/application services can orchestrate but should not steal domain decisions.
- Adapters know details and translate formats.
- Interfaces belong where the policy needs the role, not automatically next to implementations.

## Review Checklist

- Can you describe the collaboration without naming database tables?
- Does each object own a responsibility, not just data?
- Are decisions near the information they need?
- Are repeated caller-side conditions moved into the right object?
- Is inheritance justified by substitutability?
- Is a pattern solving a present force?
- Would a new variation require adding a class/policy instead of editing many `if` branches?
