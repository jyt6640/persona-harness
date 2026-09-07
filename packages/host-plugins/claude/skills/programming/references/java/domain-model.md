# Domain Model — Rich, Self-Validating, Behavior-First

A domain object is a unit of **state + behavior**, not a data bag. It knows its own rules, changes itself through named behavior, and is created through explicit factories.

## Entity is a `class`, not a `record`

| Use a `class` | Use a `record` |
|---|---|
| Entity / Aggregate (has a lifecycle, identity, state transitions, growing validation) | Value Object whose immutable value *is* its meaning |
| | `Command` / `Query` |
| | `Request` / `Response` |
| | simple value-carrier DTO |

Why an entity is a class: it carries creation validation, state-change behavior, and policy methods that grow over time; a `record`'s auto-accessors invite outside code to pull state and decide externally (anemic). Reach for a record only after confirming the thing is a value object, not a lifecycle-bearing domain object.

```java
// REJECT — entity as record (auto-getters invite external judgment)
public record Order(Long id, String name, OrderStatus status) {}

// PREFER — rich class
public class Order { /* private fields, behavior, self-validation */ }
```

## Construction: private constructor + static factory

The constructor is `private`. Creation goes through intention-revealing static factories, so creation rules live in exactly one place instead of scattering across layers. **Pure Java — no framework, no Lombok required:**

```java
public class Reservation {

    private final Long id;
    private final String name;
    private final LocalDate date;
    private final ReservationTime time;
    private final Theme theme;
    private final LocalDateTime createdAt;

    private Reservation(Long id, String name, LocalDate date,
                        ReservationTime time, Theme theme, LocalDateTime createdAt) {
        this.id = id;
        this.name = name;
        this.date = date;
        this.time = time;
        this.theme = theme;
        this.createdAt = createdAt;
    }

    /** create: brand-new domain object, validates business rules. */
    public static Reservation create(String name, LocalDate date, ReservationTime time, Theme theme) {
        validateCreatableDateTime(date, time);
        return new Reservation(null, name, date, time, theme, LocalDateTime.now());
    }

    /** restore: rebuild from a stored row (no re-validation of business rules). */
    public static Reservation restore(Long id, String name, LocalDate date,
                                      ReservationTime time, Theme theme, LocalDateTime createdAt) {
        return new Reservation(id, name, date, time, theme, createdAt);
    }
}
```

> **Boilerplate is a harness choice.** If the project's harness adopts Lombok, the constructor + getters collapse to `@RequiredArgsConstructor(access = AccessLevel.PRIVATE)` + `@Getter` — but that's a convenience, not part of the philosophy. The Domain must stay framework-free either way (no persistence/HTTP annotations on the entity). See `technology-seams.md`.

Factory naming convention:

| Name | Meaning |
|---|---|
| `create` | new domain object; runs creation-time business validation |
| `restore` | rebuild from persistence; trusts stored data |
| `of` | construct a value object |

A public constructor lets creation rules leak into Services and Controllers — so entities restrict their creation path explicitly.

## Self-validation

The object validates what it can judge from **its own state**, in `private` methods, throwing a domain exception. (Lookup-based checks belong to a Validator — see `application-layer.md`.)

```java
private static void validateCreatableDateTime(LocalDate date, ReservationTime time) {
    LocalDateTime dateTime = LocalDateTime.of(date, time.getStartAt());
    if (dateTime.isBefore(LocalDateTime.now())) {
        throw new BusinessException(ReservationErrorCode.RESERVATION_CREATE_IN_PAST);
    }
}

private void validateOwner(String name) {
    if (!this.name.equals(name)) {
        throw new BusinessException(ReservationErrorCode.RESERVATION_OWNER_MISMATCH);
    }
}
```

HTTP-shape validation (null/blank/format) does **not** live here — it lives in the Request DTO. Don't accumulate `@NotBlank`-style checks in the domain.

## Behavior over getters — Tell, Don't Ask

Ask the object to *do*, don't pull its state and decide outside.

```java
// GOOD — the object owns the rule
public Reservation update(String name, LocalDate date, ReservationTime time) {
    validateOwner(name);
    validateModifiable();
    validateModifiableDateTime(date, time);
    return new Reservation(id, this.name, date, time, theme, this.createdAt);
}

public void cancel(String name) {
    validateOwner(name);
    validateModifiable();
}
```

```java
// REJECT — Service reaches in and decides
if (!reservation.getName().equals(requester)) { throw ...; }
if (reservation.getDate().isBefore(LocalDate.now())) { throw ...; }
```

### Getter policy

Getters are allowed **only** for: response conversion, serialization, external output. Not for business judgment. (Lombok `@Getter` is fine as a convenience, but using those getters to decide business rules *outside* the object is the smell, not the annotation.)

## Immutability

- Fields are `final`.
- No setters.
- A state change returns a **new instance** (`update(...)` above) or is expressed as a named behavior — never `setStatus(CANCELED)`.

```java
public Reservation appendId(Long id) {            // persistence assigns the id → new instance
    return new Reservation(id, name, date, time, theme, createdAt);
}
```

## Identity: `equals` / `hashCode` by id

An entity's identity is its id, not its field values. A null-id entity is not yet a complete entity.

```java
@Override
public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof Reservation that)) return false;
    if (this.id == null || that.id == null) return false;   // unsaved entities are never equal
    return this.id.equals(that.id);
}

@Override
public int hashCode() {
    return (id != null) ? id.hashCode() : System.identityHashCode(this);
}
```

Do not use full-value comparison as the default identity strategy for entities. (Value objects, by contrast, *are* compared by value — and a `record` gives that for free.)

## Value objects

A value whose identity is its content. Immutable, compared by value — a `record` or a small class with `of`. Validate in the canonical/compact constructor.

```java
public record Money(long amount) {
    public Money {
        if (amount < 0) throw new BusinessException(CommonErrorCode.NEGATIVE_AMOUNT);
    }
    public static Money of(long amount) { return new Money(amount); }
    public Money add(Money other) { return new Money(this.amount + other.amount); }
}
```

## First-class collections

When a collection has its own rules (uniqueness, ordering, capacity), wrap it in a named type instead of passing a raw `List` around.

```java
public class Reservations {
    private final List<Reservation> values;
    public Reservations(List<Reservation> values) { this.values = List.copyOf(values); }
    public boolean hasOverlapping(LocalDate date, ReservationTime time) { /* rule lives here */ }
}
```

## Policy objects — extract when rules branch

Keep a simple rule inside the entity. Extract a Policy when policies multiply, branches grow, policies combine, or a method name won't come out naturally.

```java
public class ReservationCancellationPolicy {
    public void validateCancelable(Reservation reservation, LocalDateTime now) { /* ... */ }
}
```

Name policies in domain language: `ReservationPolicy`, `DiscountPolicy`, `ReservationCancellationPolicy`. Prefer polymorphism over a `switch` when policy varies by a type.

## Collaboration without trespass

A domain may *use* another domain's info but must not reach into and mutate its state.

```java
// GOOD — payment judges its own amount, using order as input
payment.validateAmount(order);

// REJECT — order mutating payment internals
order.setPaymentStatus(...);
```

## Self-check

- Does this object know its own state best?
- Do state and behavior live together here?
- Is any external code making a decision that this object should own?
- Is it behaving like a plain data bag?

Any NO → reconsider the design.
