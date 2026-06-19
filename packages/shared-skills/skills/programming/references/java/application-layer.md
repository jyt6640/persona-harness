# Application Layer — Service, Validator, Transactions

The Application layer runs one use-case scenario. The **Service orchestrates flow**; it does not decide. Judgment is delegated: self-state rules to the Domain/Policy, lookup-based rules to an Application **Validator**.

> Spring annotations (`@Service`, `@Transactional`, `@Component`, `@RequiredArgsConstructor`) below are **one instantiation**. The rules — orchestration-only, constructor injection, transaction boundary at the service, validation delegated — hold under any framework or none. See `technology-seams.md`.

## Service = orchestration only

A Service method reads like a recipe: fetch references → delegate validation → invoke domain behavior → persist. No business `if/else`.

```java
@Service
@Transactional(readOnly = true)            // read-only by default
@RequiredArgsConstructor                    // constructor injection, final fields
public class ReservationService {

    private final ReservationRepository reservationRepository;
    private final ReservationTimeRepository reservationTimeRepository;
    private final ThemeRepository themeRepository;
    private final ReservationValidator reservationValidator;

    @Transactional                          // write method opts into a read-write tx
    public Reservation saveReservation(ReservationCreateCommand command) {
        ReservationTime time = reservationTimeRepository.findById(command.timeId())
                .orElseThrow(() -> new BusinessException(ReservationErrorCode.RESERVATION_TIME_INVALID));
        Theme theme = themeRepository.findById(command.themeId())
                .orElseThrow(() -> new BusinessException(ReservationErrorCode.RESERVATION_THEME_INVALID));

        reservationValidator.validateAlreadyReservation(command);     // lookup validation → Validator
        Reservation reservation = Reservation.create(                 // business rule → Domain factory
                command.name(), command.date(), time, theme);

        return reservationRepository.save(reservation);
    }
}
```

What the Service does / does not:

| Does | Does not |
|---|---|
| fetch entities, handle "not found" application errors | judge business rules itself |
| call Validator / Domain / Policy in sequence | hide policy in nested `if`/`else` |
| own the transaction boundary | depend on HTTP Request/Response DTOs |
| map between Command and domain calls | reach into entity state via getters to decide |
| depend on repository/storage ports | own storage state or id sequence (`Map`, `List`, `AtomicLong`, `nextId`, `idCounter`) |

If you see a business condition decided inside a Service, move it: self-state → Domain, lookup → Validator, branching ruleset → Policy.

## Service does not own storage state

An Application Service does not own persistence state or generate ids. Even in a small in-memory app, `Map`, mutable `List`, `AtomicLong`, `nextId`, `idCounter`, or sequence fields belong behind a Repository/Store-style persistence component, not inside the Service. The Service asks that component to save, find, update, or delete; the component owns how ids are assigned and how records are stored.

```java
@Service
@RequiredArgsConstructor
public class ExpenseService {

    private final ExpenseRepository expenseRepository;

    public Expense create(ExpenseCreateCommand command) {
        Expense expense = Expense.create(command.title(), command.amount(), command.spentOn());
        return expenseRepository.save(expense);          // repository assigns/persists id
    }
}
```

Reject this shape:

```java
@Service
public class ExpenseService {

    private final Map<Long, Expense> expenses = new LinkedHashMap<>(); // storage state
    private final AtomicLong nextId = new AtomicLong(1);               // id sequence
}
```

## Small, single-intent methods

One Service method = one use case. Each step is a clear call, not a fused `validateAndSave`. Keep methods short enough that the flow reads top to bottom (see `method-and-naming.md`). When a method grows past one screen or starts mixing steps, that's an extraction signal — usually a Validator or Policy wants to come out.

## Application Validator — lookup-based validation

Validation that needs a repository lookup (duplicate, existence, reference integrity) lives in a `@Component` Validator in the Application layer. It validates only; it does not orchestrate.

```java
@Component
@RequiredArgsConstructor
public class ReservationValidator {

    private final ReservationRepository reservationRepository;

    public void validateAlreadyReservation(ReservationCreateCommand command) {
        boolean exists = reservationRepository
                .findByDateAndTimeIdAndThemeId(command.date(), command.timeId(), command.themeId())
                .isPresent();
        if (exists) {
            throw new BusinessException(ReservationErrorCode.RESERVATION_ALREADY_EXISTS);
        }
    }
}
```

Division of validation responsibility:

| Check | Where |
|---|---|
| HTTP null/blank/format/length | Request DTO (`@NotBlank`, …) |
| Self-state business rule | Domain (private validate) / Policy |
| Needs a repository lookup | **Application Validator** |
| (orchestrating the calls) | Service — never decides itself |

The Validator's tests use a Fake repository, no Spring context (see `testing.md`).

## Transaction boundary

The transaction boundary is the Service.

- Class-level `@Transactional(readOnly = true)` — every method is read-only unless it says otherwise.
- Write methods are annotated `@Transactional` to open a read-write transaction.
- Read and write transactions are distinguished deliberately; validation responsibility and transaction responsibility are kept separate (the Validator doesn't manage transactions).
- For write paths that must lock a row, use the Repository's `findByIdForUpdate(...)` inside the write transaction.

## Request → Command separation

Presentation owns `Request`/`Response`; Application owns `Command`/`Query`. The Controller maps `Request.toCommand()` so the Service never touches an HTTP DTO, and HTTP-contract changes don't ripple into business flow.

```java
// presentation/dto/request/ReservationCreateRequest.java
public record ReservationCreateRequest(
        @NotBlank String name,
        @NotNull LocalDate date,
        @NotNull Long timeId,
        @NotNull Long themeId) {

    public ReservationCreateCommand toCommand() {        // HTTP shape → business intent
        return new ReservationCreateCommand(name, date, timeId, themeId);
    }
}

// application/dto/ReservationCreateCommand.java
public record ReservationCreateCommand(
        String name, LocalDate date, Long timeId, Long themeId) {}
```

The Controller stays thin:

```java
@PostMapping("/reservations")
public ResponseEntity<ReservationResponse> create(@Valid @RequestBody ReservationCreateRequest request) {
    Reservation reservation = reservationService.saveReservation(request.toCommand());
    return ResponseEntity.status(HttpStatus.CREATED).body(ReservationResponse.from(reservation));
}
```

`@Valid` runs the Request DTO's HTTP-shape validation before the Service is ever called. The Service receives a `Command` of already-shaped values and focuses on flow.

## Cross-domain collaboration — Reference / Adapter

When one domain needs read-only information from another, prefer a small **port** owned by the needing side over depending directly on the other domain's repository. This keeps the boundary explicit and the dependency inverted.

```
reservation/application/
├── ThemeReference.java          // port: what reservation needs to know about a theme
└── ThemeReferenceAdapter.java   // adapter: implemented against the theme domain
```

```java
public interface ThemeReference {                 // owned by the reservation side
    Theme findById(Long themeId);
}

@Component
@RequiredArgsConstructor
public class ThemeReferenceAdapter implements ThemeReference {
    private final ThemeRepository themeRepository;
    @Override
    public Theme findById(Long themeId) {
        return themeRepository.findById(themeId)
                .orElseThrow(() -> new BusinessException(ReservationErrorCode.RESERVATION_THEME_INVALID));
    }
}
```

Use this anti-corruption seam when cross-domain coupling starts to spread; for a small app, a direct repository call from the Service is acceptable, but the Reference/Adapter is the boundary you grow toward.

## Best-effort side effects

A secondary side effect that must not fail the main use case (e.g. promoting the next waiter after a cancellation) is wrapped and logged, not allowed to abort the transaction's primary intent:

```java
try {
    waitingService.promoteNextWaiting(date, time, theme);
} catch (BusinessException | DataAccessException e) {        // no-excuse-ok: catch — best-effort side effect
    log.warn("다음 대기자 승격에 실패했습니다. reservationId={}", id, e);
}
```

Keep this rare and explicit; it is the one place a Service tolerates a caught exception, and it logs with context rather than swallowing.
