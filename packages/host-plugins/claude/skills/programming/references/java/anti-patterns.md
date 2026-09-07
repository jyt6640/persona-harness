# Anti-Patterns — Refuse On Sight

These are explicitly rejected. When asked to write one, push back and propose the domain-first alternative. Each maps to a "rejected" decision in the philosophy.

## Anemic domain model

A domain object that is just getters/setters, with all behavior in the Service.

```java
// REJECT
public class Order {
    private Long id; private OrderStatus status;
    public OrderStatus getStatus() { return status; }
    public void setStatus(OrderStatus s) { this.status = s; }
}
// ...and the Service decides everything:
if (order.getStatus() == OrderStatus.PAID) { order.setStatus(OrderStatus.CANCELED); }
```

Why rejected: state and the rules over that state get separated; the rules scatter and drift across Services. **Fix:** rich entity — `order.cancel()` owns the rule, validates itself, returns a new state. See `domain-model.md`.

## Service-layer business logic

Business judgment (`if/else` over domain state) living in the Service.

Why rejected: the Service is *flow*; mixing in *judgment* hides policy and couples orchestration to rules. **Fix:** self-state → Domain/Policy; lookup → Validator; the Service only calls. See `application-layer.md`.

## `common` / `util` / `helper` package

A grab-bag package (`common/`, `util/`, `helper/`) or a `XxxUtil` class.

Why rejected: it relocates responsibility instead of placing it; it becomes a magnet for unrelated code and hides where logic belongs. **Fix:** put behavior on the object that owns the data, or in a clearly named domain type. `global/` is only for genuine cross-cutting concerns, not a dump.

## Util-based validation

`ValidationUtils.validateX(...)` static helpers doing domain validation.

Why rejected: validation gets pulled out of the object that owns the state, re-creating the anemic split and a stringly-typed util surface. **Fix:** self-state validation lives in the Domain (private validate); lookup validation lives in an Application Validator; HTTP-shape validation lives in the Request DTO.

## Generic base class

`AbstractEntity`, `BaseService<T>`, `BaseController<T>` to "share" code via inheritance.

Why rejected: inheritance for reuse couples unrelated types and leaks a base's assumptions into every subclass; it fights the explicit-over-reuse principle. **Fix:** compose; duplicate the clear three lines until a real second caller *and* a natural abstraction both exist.

## Generic `Manager` class

`OrderManager`, `ReservationManager` — a catch-all that "manages" a domain.

Why rejected: `Manager` names nothing; it accretes every loosely-related operation and becomes a god object. **Fix:** name by responsibility — `OrderService` (flow), `OrderPolicy` (rules), `OrderValidator` (lookups). The checker flags `*Manager`.

## Generic response wrapper

A universal `ApiResponse<T>` / `CommonResponse<T>` wrapping every endpoint.

Why rejected: it couples all endpoints to one envelope shape, adds indirection, and tends to smuggle in cross-cutting behavior. **Fix:** return purpose-specific `Response` records; handle errors through the one `GlobalExceptionHandler` + `ErrorResponse` (see `error-handling.md`).

## Builder pattern overuse

A `Builder` on a 3-field immutable value, or builders everywhere by default.

Why rejected: ceremony that hides which fields are required and invites half-constructed objects; an entity's creation rules belong in a static factory, not a free-form builder. **Fix:** static factory (`create`/`restore`/`of`); a record's canonical constructor for value objects. Reserve a builder for genuinely many-optional-field cases, and justify it.

## The principle behind all of these: explicit over reuse

Reuse is not a goal; clarity is. Premature abstraction (a base class, a generic wrapper, a util) trades a little typing for a lot of coupling and a vaguer model.

Introduce an abstraction only when **both** hold:
1. a second *real* caller exists, and
2. a natural, domain-meaningful name exists for the abstraction.

Until then, prefer duplicated-but-clear. When you do abstract, name it after the concept it owns — never `Base`, `Manager`, `Helper`, `Util`, `Common`.

## Quick refusal table

| If asked for… | Offer instead |
|---|---|
| getters/setters entity + logic in service | rich entity with behavior |
| business `if/else` in a Service | Domain/Policy/Validator delegation |
| `XxxUtil` / `common` package | behavior on the owning object |
| `ValidationUtils` | Domain / Validator / Request DTO validation |
| `BaseEntity` / `BaseService<T>` | composition; duplicate until a real second caller |
| `XxxManager` | `Service` / `Policy` / `Validator` by responsibility |
| `ApiResponse<T>` wrapper | purpose-specific `Response` + `GlobalExceptionHandler` |
| builder on a small immutable | static factory / record canonical constructor |
