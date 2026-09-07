# Method Design & Naming

A method expresses one intent. A name expresses domain intent, not implementation. These two together are where most everyday code quality is won or lost.

## Method design

### One intent per method

```
GOOD:  validateOwner()   cancel()   calculateTotalPrice()
REJECT: validateAndCancel()   process()   handle()
```

A name containing `and` is a split signal — the method is doing two things.

### Separate flow from judgment

The Service orchestrates; the decision is delegated. Don't bury policy in nested conditionals.

```java
// GOOD — delegate the judgment
reservationValidator.validateAlreadyReservation(command);
reservation.cancel(requester);

// REJECT — nested judgment inside the flow
if (...) {
    if (...) {
        ...
    }
}
```

### Early return / early throw over `else`

```java
// GOOD
if (isInvalid()) {
    throw new BusinessException(SomeErrorCode.X);
}
proceed();

// REJECT
if (isValid()) {
    proceed();
} else {
    ...
}
```

### No boolean policy parameters

A boolean argument hides a policy difference behind a call site. Split the method, or pass an intention-revealing type.

```
GOOD:   create(command)
REJECT: create(isAdmin, isEvent, isTest)
        validate(isAdmin)
```

### Few arguments; group by meaning

Keep arguments few. When they grow, bundle them into a meaningful type (a `Command`, a value object) rather than a long positional list.

### Polymorphism over `switch` on a type

A `switch`/`if-else` chain over a type discriminator is a request for polymorphism (or a Policy). Reach for that before adding a branch.

### `null` policy

- `null` only for a meaningful absence.
- A lookup miss is expressed with `Optional` or an exception — never a bare `null` return as the default strategy.

### Declare variables near use

```java
// GOOD
Order order = repository.findById(id).orElseThrow(...);

// REJECT
Order order;
// ... many lines ...
order = repository.findById(id);
```

### Extraction signals

Extract a method when: a name comes out naturally, a conditional grows complex, a flow repeats, a comment becomes necessary to explain a block, or the role changes mid-method. Do **not** extract merely to share three lines with one caller (see `anti-patterns.md` → explicit over reuse).

### Self-check

- One intent only?
- Name alone conveys the role?
- Flow and judgment unmixed?
- Is a boolean hiding a policy?

Any NO → reconsider.

## Naming

A name is the *result* of domain modeling. If a name is awkward, suspect the design first.

### Core direction

- Intent over implementation.
- Domain terms over technical terms.
- Explicitness over reuse.
- An awkward name = a design smell.

### Classes

Reveal role and responsibility. Avoid vague suffixes.

```
GOOD:   ReservationPolicy   ReservationValidator   ReservationCommand
REJECT: ReservationManager  ReservationHelper      ReservationUtil
```

`Manager` / `Helper` / `Util` are banned — they describe nothing about responsibility (the no-excuse checker flags them).

### Methods

- One behavior per name.
- `and` in a name → split signal.
- Prefer positive phrasing.
- No boolean policy parameter smuggled into the name.

```
GOOD:   validatePastDateTime()   validateOwner()   cancel()
REJECT: process()   handle()   doSomething()
```

### DTOs — name the role, not "DTO"

Use `Request` / `Response` / `Command` / `Query` by purpose.

```
ReservationCreateRequest     (presentation, HTTP in)
ReservationCreateCommand     (application, business intent)
ReservationResponse          (presentation, HTTP out)
```

### Collections

Plural names. If the collection itself carries rules, promote it to a first-class collection type.

```
reservations          (a plural variable)
reservationTimes
Reservations          (a first-class collection with its own behavior)
```

### Language policy

- Identifiers: **English** (domain terms).
- Comments: **Korean**.
- Test `@DisplayName`: **Korean**.

### Naming smells (re-examine the design)

- The name keeps getting longer.
- The name explains *how* instead of *what role*.
- The same prefix/suffix repeats across many classes.
- A natural name won't come.
- A technical term stands in for a missing domain term.
