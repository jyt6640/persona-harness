# Error Handling — ErrorCode + Unchecked Hierarchy + One Handler

An exception expresses a broken business rule, not just a failure. It is thrown where the validation responsibility lives, carries a domain `ErrorCode`, and is converted to a response in exactly one place.

> `@RestControllerAdvice` and the Spring input-exception types below are **one instantiation** (a web app). The invariants hold under any delivery mechanism: **per-domain `ErrorCode` catalogue, one unchecked exception base, a single central handler that maps domain meaning → protocol, static user-safe messages.** Domain error catalogues stay protocol-neutral: store a stable string code and message, never `HttpStatus` or numeric HTTP status in domain packages. See `technology-seams.md`.

## Principles

- The **throw site equals the validation responsibility site** (Domain/Policy for self-state, Validator for lookups).
- Exceptions are not flow control.
- Messages are understandable to both user and developer, and never leak internals.
- Domain meaning over technical detail.

## ErrorCode — per domain, common interface

Each domain owns an `ErrorCode` enum carrying a stable code and a static message; they share one interface. The enum must not import Spring/HTTP types or store HTTP status numbers when it lives in a domain package.

```java
// global/exception/ErrorCode.java
public interface ErrorCode {
    String getCode();
    String getMessage();
}
```

```java
// global/exception/ReservationErrorCode.java
@Getter
@RequiredArgsConstructor
public enum ReservationErrorCode implements ErrorCode {

    RESERVATION_NOT_FOUND("RESERVATION_NOT_FOUND", "예약을 찾을 수 없습니다."),
    RESERVATION_ALREADY_EXISTS("RESERVATION_ALREADY_EXISTS", "이미 예약된 시간입니다. 다른 시간을 선택해 주세요."),
    RESERVATION_CREATE_IN_PAST("RESERVATION_CREATE_IN_PAST", "지난 일정으로 예약할 수 없습니다."),
    RESERVATION_OWNER_MISMATCH("RESERVATION_OWNER_MISMATCH", "수정할 수 있는 권한이 없습니다.");

    private final String code;
    private final String message;
}
```

- One `*ErrorCode` per domain (`ReservationErrorCode`, `ThemeErrorCode`), plus a `CommonErrorCode` for cross-cutting cases.
- Stable code + message live together, in the enum; protocol status mapping stays in the boundary handler.

## Custom exceptions — unchecked, classified by nature

All custom exceptions are `RuntimeException`-based and extend **one base**. They are categorized by the *kind* of error, not by domain (the domain is already in the `ErrorCode`).

```java
// global/exception/customException/RoomEscapeException.java  (rename to your project's base)
@Getter
public class RoomEscapeException extends RuntimeException {

    private final ErrorCode errorCode;

    public RoomEscapeException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public RoomEscapeException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
```

```java
public class BusinessException extends RoomEscapeException {        // business rule violation
    public BusinessException(ErrorCode errorCode) { super(errorCode); }
}

public class EntityNotFoundException extends RoomEscapeException {  // entity lookup failure
    public EntityNotFoundException(ErrorCode errorCode, Long id) {
        super(errorCode, errorCode.getMessage() + " id=" + id);
    }
}

public class BadRequestException extends RoomEscapeException {      // malformed request beyond bean-validation
    public BadRequestException(ErrorCode errorCode) { super(errorCode); }
}
```

Throwing reads as `throw new BusinessException(ReservationErrorCode.RESERVATION_OWNER_MISMATCH);` — never `throw new RuntimeException("...")` with a bare string.

## Who throws what

| Layer | Responsibility |
|---|---|
| **Domain / Policy** | self-state validation; throws `BusinessException(domainErrorCode)` |
| **Application Validator** | lookup validation (duplicate/exists); throws `BusinessException(...)` |
| **Application Service** | application-flow errors (entity not found); throws `EntityNotFoundException(...)`; does not validate business rules itself |
| **Presentation** | does **not** handle exceptions directly; the `GlobalExceptionHandler` converts them |

## One GlobalExceptionHandler

A single `@RestControllerAdvice` converts every exception into a consistent `ErrorResponse`. The base custom exception maps via its `ErrorCode`; Spring's input exceptions are translated into user-friendly messages.

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Map<String, HttpStatus> STATUS_BY_ERROR_CODE = Map.of(
            CommonErrorCode.INVALID_REQUEST_BODY.getCode(), HttpStatus.BAD_REQUEST,
            CommonErrorCode.INTERNAL_SERVER_ERROR.getCode(), HttpStatus.INTERNAL_SERVER_ERROR,
            "RESERVATION_NOT_FOUND", HttpStatus.NOT_FOUND,
            "RESERVATION_ALREADY_EXISTS", HttpStatus.BAD_REQUEST,
            "RESERVATION_CREATE_IN_PAST", HttpStatus.BAD_REQUEST,
            "RESERVATION_OWNER_MISMATCH", HttpStatus.FORBIDDEN
    );

    @ExceptionHandler(RoomEscapeException.class)
    public ResponseEntity<ErrorResponse> handleRoomEscape(RoomEscapeException e) {
        ErrorCode code = e.getErrorCode();
        return ResponseEntity.status(statusOf(code)).body(new ErrorResponse(e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)         // @Valid failures
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(DefaultMessageSourceResolvable::getDefaultMessage)
                .orElse(CommonErrorCode.INVALID_REQUEST_BODY.getMessage());
        return ResponseEntity.badRequest().body(new ErrorResponse(message));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)         // malformed body / bad type
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException e) {
        // convert Jackson InvalidFormatException into "<field> 형식이 올바르지 않습니다 ..." — never expose the raw cause
        return ResponseEntity.badRequest().body(new ErrorResponse(CommonErrorCode.INVALID_REQUEST_BODY.getMessage()));
    }

    @ExceptionHandler(Exception.class)                               // no-excuse-ok: catch — last-resort boundary
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        return ResponseEntity.status(statusOf(CommonErrorCode.INTERNAL_SERVER_ERROR))
                .body(new ErrorResponse(CommonErrorCode.INTERNAL_SERVER_ERROR.getMessage()));
    }

    private HttpStatus statusOf(ErrorCode code) {
        return STATUS_BY_ERROR_CODE.getOrDefault(code.getCode(), HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
```

Structure:

```
Presentation → (throws) → GlobalExceptionHandler → ErrorResponse
```

The handler is the single place that knows HTTP status mapping; domain code throws meaning, the handler maps meaning to protocol.

## Message policy

- Default to **static** messages stored on the `ErrorCode`.
- Compose dynamically only when needed (e.g. appending an id), and never expose internals.

```
GOOD:   "지난 일정은 예약할 수 없습니다."
REJECT: "NullPointerException at ReservationService line 42"
```

## Spring input exceptions → friendly messages

Convert framework exceptions before they reach the user:

| Spring exception | Convert to |
|---|---|
| `MethodArgumentNotValidException` | the first `@Valid` field message |
| `HttpMessageNotReadableException` (Jackson `InvalidFormatException`) | "`<field>` 값의 형식이 올바르지 않습니다. `<hint>` 형식으로 입력해 주세요." |
| `MethodArgumentTypeMismatchException` | "`<param>`는 `<type>` 형식이어야 합니다." |

Never surface a raw system message.

## Catch discipline

- No empty catch, no catch-and-swallow.
- `catch (Exception/Throwable)` only at a genuine boundary (the `GlobalExceptionHandler`, or a best-effort side effect that logs with context — see `application-layer.md`), marked `// no-excuse-ok: catch`.
- Never `e.printStackTrace()` — log through SLF4J (`@Slf4j`) with context.
