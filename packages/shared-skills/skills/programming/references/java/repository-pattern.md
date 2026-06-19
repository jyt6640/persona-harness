# Repository Pattern — Port in Domain, Adapter in Infrastructure

A Repository expresses the Domain's storage need (a **port**); Infrastructure implements it (an **adapter**). The Domain never knows the storage technology.

> The examples below use **Spring Data JPA + Hibernate** because it is the default adapter when the harness has not chosen a persistence seam. JdbcTemplate, MyBatis, Redis, or an in-memory map are equally valid adapters — *"Domain은 JPA / JDBC / Redis 등의 구현은 알지 않는다."* The invariant is what's fixed: **port interface in `domain`, implementation in `infrastructure`, and no storage technology leaking into the domain.** If the project chooses JPA, the JPA entity lives in infra and maps back through the domain's `restore` factory. See `technology-seams.md`.

## Interface in `domain`, implementation in `infrastructure`

```
order/
├── domain/
│   ├── Order.java                     ← pure POJO entity (private ctor + create/restore/of). NO @Entity.
│   └── OrderRepository.java           ← the PORT: what must be stored/found (domain language)
└── infrastructure/
    ├── OrderJpaEntity.java            ← @Entity (JPA's mutable shape) — lives HERE, not in domain
    ├── OrderJpaRepository.java        ← Spring Data: extends JpaRepository<OrderJpaEntity, Long>
    └── OrderRepositoryAdapter.java    ← implements OrderRepository; maps OrderJpaEntity ↔ Order
```

```java
// domain/OrderRepository.java — pure interface, domain language, no technology
public interface OrderRepository {
    Order save(Order order);
    Optional<Order> findById(Long id);
    Optional<Order> findByIdForUpdate(Long id);          // pessimistic lock for write paths
    List<Order> findByMemberName(String name);
    boolean existsByThemeId(Long themeId);
    boolean deleteById(Long id);
}
```

Dependency inversion: Application and Domain depend on this **port**; Infrastructure depends inward by implementing it. The Spring Data `JpaRepository` is an *infrastructure* detail the adapter uses — it is **not** the domain port.

```
Application
     │
     ▼
Domain: OrderRepository (port interface)
     ▲
     │ implements
Infrastructure: OrderRepositoryAdapter ──uses──▶ OrderJpaRepository (Spring Data)
```

## Method names use domain language

The method says *what business question* it answers, not *how SQL runs*.

| Good | Reject |
|---|---|
| `findByDateAndThemeId(...)` | `selectReservation(...)` |
| `existsByReservationTimeId(...)` | `executeQuery(...)` |
| `findByIdForUpdate(...)` | `selectForUpdate(...)` |

## What a Repository does — and doesn't

| Does | Does not |
|---|---|
| save / find / delete / persistence-tech handling | business policy judgment |
| `forUpdate` locking variants for write flows | complex validation logic |
| entity ↔ domain mapping | HTTP handling |

If a method is *deciding* a business rule, it's in the wrong place — move it to Domain/Policy/Validator.

## In-memory storage is still a persistence component

For prototypes or tests, an in-memory adapter may be enough. It still follows the same boundary: storage state and id generation live behind the Repository/Store-style component, never in the Application Service. A `Map`, mutable `List`, `AtomicLong`, `nextId`, `idCounter`, or sequence field is persistence state.

```java
@Repository
public class InMemoryExpenseRepository implements ExpenseRepository {

    private final Map<Long, Expense> expenses = new LinkedHashMap<>();
    private final AtomicLong nextId = new AtomicLong(1);

    @Override
    public synchronized Expense save(Expense expense) {
        Expense saved = expense.withId(nextId.getAndIncrement());
        expenses.put(saved.id(), saved);
        return saved;
    }
}
```

The Service depends on `ExpenseRepository`; it does not know whether the adapter is JPA, JDBC, MyBatis, Redis, a file, or an in-memory map.

## If JPA Is Chosen: The Entity Lives In Infrastructure

The JPA entity carries everything the philosophy keeps *out* of the domain: `@Entity`, an `@Id`, a no-arg constructor, mutable fields. So when the project chooses JPA, the JPA entity lives in `infrastructure`, separate from the pure domain `Order`. It owns the mapping both ways.

```java
// infrastructure/OrderJpaEntity.java
@Entity
@Table(name = "orders")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)   // JPA requires it; nobody else calls it
public class OrderJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String memberName;
    private Long themeId;
    private LocalDateTime orderedAt;

    private OrderJpaEntity(Long id, String memberName, Long themeId, LocalDateTime orderedAt) {
        this.id = id; this.memberName = memberName; this.themeId = themeId; this.orderedAt = orderedAt;
    }

    public static OrderJpaEntity fromDomain(Order order) {
        return new OrderJpaEntity(order.getId(), order.getMemberName(), order.getThemeId(), order.getOrderedAt());
    }

    public Order toDomain() {
        return Order.restore(id, memberName, themeId, orderedAt);   // rebuild via the domain factory
    }
}
```

## If Spring Data Is Chosen: Repository + Adapter

The Spring Data interface speaks in JPA-entity terms; the adapter implements the **domain port** and maps at the boundary, so the domain `Order` never touches JPA.

```java
// infrastructure/OrderJpaRepository.java — Spring Data, an infra detail
interface OrderJpaRepository extends JpaRepository<OrderJpaEntity, Long> {
    List<OrderJpaEntity> findByMemberName(String memberName);
    boolean existsByThemeId(Long themeId);
}
```

```java
// infrastructure/OrderRepositoryAdapter.java — implements the domain port
@Repository
@RequiredArgsConstructor
public class OrderRepositoryAdapter implements OrderRepository {

    private final OrderJpaRepository jpaRepository;

    @Override
    public Order save(Order order) {
        OrderJpaEntity saved = jpaRepository.save(OrderJpaEntity.fromDomain(order));
        return saved.toDomain();                       // returns the domain object carrying its generated id
    }

    @Override
    public Optional<Order> findById(Long id) {
        return jpaRepository.findById(id).map(OrderJpaEntity::toDomain);
    }

    @Override
    public List<Order> findByMemberName(String name) {
        return jpaRepository.findByMemberName(name).stream().map(OrderJpaEntity::toDomain).toList();
    }

    @Override
    public boolean existsByThemeId(Long themeId) {
        return jpaRepository.existsByThemeId(themeId);
    }
}
```

Notes:
- The mapping boundary uses the domain's `restore` factory; the JPA entity never escapes the adapter into the domain or application layer.
- `findByIdForUpdate` maps to a `@Lock(LockModeType.PESSIMISTIC_WRITE)` query on the Spring Data interface for write paths that must lock the row.
- If Flyway is chosen, schema is owned by Flyway, not Hibernate: set `spring.jpa.hibernate.ddl-auto: validate` so the app verifies against the migrated schema and never auto-mutates it.
- Switching to JdbcTemplate/MyBatis changes only the infrastructure adapter shape; the domain `Order`, the port, the Service, and every application test stay identical. That is the whole point of the port.

## Testing

- **Service / Validator tests** use a **Fake** implementation of the **port** (map-backed), with no Spring context — no JPA, no DB. The Fake lives in `src/test/.../<domain>/fake/` — never an inner class.
- **Repository/adapter tests** run against a real database when the project cost/benefit supports it. Testcontainers is the default for production-like DB integration; do not treat H2-as-a-stand-in as proof when the production DB differs.

See `testing.md` for both.

## Self-check

- Is this about storage technology? → Repository (adapter) responsibility.
- Is the interface free of SQL/JDBC terms and phrased in domain language?
- Does the Domain remain ignorant of how persistence works?

Any NO → reconsider.
