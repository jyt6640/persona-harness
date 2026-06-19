# Architecture — Layered & Domain-First

Layers separate responsibility; dependencies flow inward only; the Domain knows no technology. Packages are organized by domain, with layers as sub-packages.

## The four layers

| Layer | Owns | Must NOT |
|---|---|---|
| **Presentation** | receive HTTP, map `Request → Command/Query`, call the Application service, map domain result → `Response`, decide status code | contain business logic, call a Repository directly, mutate domain state |
| **Application** | run one use-case scenario, compose Domain/Policy/Validator/Repository, hold the transaction boundary, delegate lookup validation to a Validator | make business decisions, hide policy in `if/else`, depend on HTTP Request/Response DTOs |
| **Domain** | hold and validate its own state, express behavior as methods, stay a pure POJO | know a Repository implementation; import HTTP/DB/framework annotations; call external systems |
| **Infrastructure** | implement the Domain's Repository interface, talk to DB / external APIs, hold SQL + row mapping | invent business rules, bypass domain rules |

## Dependency direction

```
Presentation
     │
     ▼
Application
     │
     ▼
  Domain  ◄────────────── Infrastructure
(Repository interface)   (implements the interface)
```

- Presentation depends on Application; Application depends on Domain.
- Infrastructure depends *inward* on Domain — it implements an interface the Domain declares (Dependency Inversion).
- **Nothing depends outward.** No layer-skipping (a Controller never touches a Repository).

Decision test — when a class's layer is unclear, ask in order:

1. About HTTP request/response shape? → **Presentation**
2. Orchestrating a use-case flow? → **Application**
3. A business rule or state change? → **Domain**
4. DB / external API / messaging detail? → **Infrastructure**

## Domain-first package structure

Top-level packages are **domains**, never layers.

```
project/
├── order/
│   ├── presentation/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
├── member/
│   ├── presentation/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
└── global/
```

Rejected — layer-first top level:

```
controller/        ← REJECT
service/           ← REJECT
repository/        ← REJECT
```

The first thing a reader sees should be *what the system is about* (orders, members), not *what framework roles exist*.

### What goes in each layer package

| Package | Contents |
|---|---|
| `presentation` | Controller; `dto/request/*Request`, `dto/response/*Response` |
| `application` | Service, Validator; `dto/*Command`, `dto/*Query` |
| `domain` | Entity / Aggregate, Policy, Value Object, **Repository interface** |
| `infrastructure` | Repository implementation, SQL, external clients |

### `global/` — cross-cutting only

```
global/
├── exception/      ErrorCode, base exceptions, GlobalExceptionHandler, ErrorResponse
├── validation/     shared validation helpers
├── config/         WebConfig, interceptors, scheduling
└── auth/           authentication primitives
```

`global/` is for concerns shared across domains. If something has a single domain's responsibility, it does **not** belong in `global/` — push it into that domain. No `util/`, `helper/`, `common/` dumping grounds (see `anti-patterns.md`).

## DTO placement — split by reason-to-change

Presentation DTOs and Application DTOs change for different reasons (HTTP contract vs business flow), so they live apart.

```
member/
├── presentation/
│   ├── MemberController.java
│   └── dto/
│       ├── request/MemberCreateRequest.java
│       └── response/MemberResponse.java
├── application/
│   ├── MemberService.java
│   ├── MemberValidator.java
│   └── dto/MemberCreateCommand.java
├── domain/
└── infrastructure/
```

- `Request` / `Response` → `presentation/dto`
- `Command` / `Query` → `application/dto`
- A domain object is **never** used as a DTO.

## When to add a sub-package

Add depth only when **all** hold: roles are clearly different, several classes of the same kind exist, and the responsibility is independently describable. Do not split by file count, and never `application/service/impl/internal/…` depth-for-depth's-sake.

## Test packages mirror main

```
src/main/java/project/order/domain/Order.java
src/test/java/project/order/domain/OrderTest.java

src/main/java/project/order/application/OrderValidator.java
src/test/java/project/order/application/OrderValidatorTest.java
```

If a test's location doesn't match the production structure, re-examine which layer the responsibility actually belongs to.

## Architecture self-check

- Are responsibilities naturally separated?
- Do dependencies flow inward?
- Are flow and judgment unmixed?
- Does the Domain stay ignorant of technology?

Any NO → reconsider the structure before continuing.
