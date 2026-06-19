# Testing — Direct, Layered, Fake-over-Mock

Tests verify **behavior and business rules**, not implementation. Every production class is directly tested. Tests are fast and independent: small units first, integrate only what needs integrating.

> JUnit 5 / AssertJ, Korean `@DisplayName`, and the method-name convention below are **this skill's default profile**. A company or personal harness may choose another explicit convention. The invariants hold: **domain tests are POJO, Service/Validator tests inject a Fake (no container), Fakes live in a clear test-support location, production behavior is directly tested where useful, and a Service test never replaces the Domain/Validator tests.** See `technology-seams.md`.

## The test taxonomy

| Test | Loads | Doubles | Verifies |
|---|---|---|---|
| **Domain** | nothing (POJO) | none | object state, behavior, creation-time validation |
| **Service / Validator** | **no Spring context** | **Fake** repository | flow orchestration + lookup validation |
| **Repository / adapter** | DB slice or container when cost/benefit supports it | none | adapter mapping + query correctness |
| **Controller** | web slice | mock/fake service boundary | HTTP request/response + status |
| **Acceptance** | full app (running) | none | one end-to-end user scenario |

The two key choices: Service/Validator tests avoid booting the full framework when a plain object graph proves the behavior, and a Service test **does not replace** the Domain/Policy/Validator tests it orchestrates — the Service test checks the *flow*; each judgment is verified in its own class's test.

## Fake vs Mock

| Use a **Fake** | Use a **Mock** |
|---|---|
| verifying flow and state | verifying a call/delegation happened |
| replacing a Repository (map-backed, behaves like the real thing) | Controller → Service delegation |
| Service / Validator tests | Controller tests |

A Fake is a real, simple implementation of the interface; a Mock asserts interaction. Prefer the Fake when you care about *what the system computed*; use the Mock only when you care that *a call was made*.

### Fakes live in a clear test-support location

A Fake is placed in the test source under a `fake` package next to the domain that owns the Repository interface by default. If the project harness chooses `testsupport`, `fixture`, or another convention, follow it consistently. Test helpers get an explicit location and responsibility too.

```
src/main/java/project/member/domain/MemberRepository.java
src/test/java/project/member/domain/fake/FakeMemberRepository.java

src/main/java/project/reservation/domain/ReservationRepository.java
src/test/java/project/reservation/domain/fake/FakeReservationRepository.java
```

```java
public class FakeMemberRepository implements MemberRepository {

    private final Map<Long, Member> store = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    @Override
    public Member save(Member member) {
        long id = sequence.incrementAndGet();
        Member saved = member.appendId(id);
        store.put(id, saved);
        return saved;
    }

    @Override
    public Optional<Member> findById(Long id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public boolean existsByEmail(String email) {
        return store.values().stream().anyMatch(m -> m.hasEmail(email));   // Tell-Don't-Ask, not getEmail()
    }
}
```

## What to test

- Test methods that have **behavior** first.
- Don't test trivial getters/setters.
- **Creation-time validation is a test target** (a `create` that rejects bad input).

### Direct-test policy

Every production class with meaningful behavior is directly tested by default:

- Domain Entity / Aggregate, Domain Policy, Application Validator, Application Service, Repository implementation, Controller, exception-response converter.

May be excluded **with a clear reason**: simple Request/Response or Command/Query DTOs, config classes, the Spring Boot bootstrap class, constant-only classes (like an `ErrorCode` enum).

## Test structure & naming

Every test has `@Test`, visible arrange/act/assert structure, and both success and failure cases where the behavior has both. The default profile uses Korean `@DisplayName`, given/when/then comments, and the method-name convention below; a stronger harness may replace the naming/display convention.

```java
@Test
@DisplayName("회원을 생성한다")
void create_ReturnsMember_WhenEmailIsValid() {
    // given
    String email = "a@b.com";

    // when
    Member member = Member.create(email, "password");

    // then
    assertThat(member.hasEmail(email)).isTrue();
}

@Test
@DisplayName("이메일이 공백이면 회원을 생성할 수 없다")
void create_ThrowsBusinessException_WhenEmailIsBlank() {
    // when & then
    assertThatThrownBy(() -> Member.create("", "password"))
            .isInstanceOf(BusinessException.class);
}
```

Default method-name convention:

| Case | Pattern |
|---|---|
| general | `methodName_ExpectedResult_TestState` |
| boolean result | `isAdult_False_AgeLessThan18` |
| exception | `withdrawMoney_ThrowsException_IfAccountIsInvalid` |
| domain failure | `admitStudent_FailToAdmit_IfMandatoryFieldsAreMissing` |
| successful return | `register_ReturnsMember_WhenCommandIsValid` |

Default-profile rules:
- `@DisplayName` is Korean and reads as the spec.
- `methodName` is the production method or public behavior under test.
- `ExpectedResult` is the observable result (`True`, `False`, `ReturnsMember`, `ThrowsBusinessException`, `FailToAdmit`).
- `TestState` names the condition/state (`AgeLessThan18`, `IfAccountIsInvalid`, `WhenEmailIsDuplicated`).
- This convention is coupled to the production method name; when refactoring method names, rename the test methods in the same change.
- `// given` may be omitted when there's nothing to set up.
- Exception checks that fuse the action and assertion use `// when & then`.

## Service test with a Fake

```java
class MemberServiceTest {

    private MemberService memberService;
    private FakeMemberRepository memberRepository;

    @BeforeEach
    void setUp() {
        memberRepository = new FakeMemberRepository();
        memberService = new MemberService(memberRepository, new MemberValidator(memberRepository));
    }

    @Test
    @DisplayName("이미 가입된 이메일이면 회원 가입에 실패한다")
    void register_ThrowsBusinessException_WhenEmailIsDuplicated() {
        // given
        memberService.register(new MemberCreateCommand("a@b.com", "pw"));

        // when & then
        assertThatThrownBy(() -> memberService.register(new MemberCreateCommand("a@b.com", "pw")))
                .isInstanceOf(BusinessException.class);
    }
}
```

Default: no `@SpringBootTest`, no `@MockBean` for Service tests when a plain object graph wired with a Fake proves the flow. Fast and honest.

## Spring context policy

- Load the **smallest** slice that proves the behavior.
- Service tests do **not** start Spring.
- Use slice tests for the layer under test when using Spring (`@JdbcTest`/`@DataJdbcTest` style for repositories, `@WebMvcTest` for controllers).
- `@SpringBootTest` is for full-flow acceptance tests only.

## Test packages mirror main

```
src/main/java/project/member/domain/Member.java
src/test/java/project/member/domain/MemberTest.java
```

If a test's location differs from production, re-examine where the responsibility belongs.

## TDD direction

- Write the test first when you can; express the expected public behavior.
- No dogmatic Red-Green-Refactor stopwatch — improve tests alongside the code.
- Use the test as a **design feedback tool**: a hard-to-test class is usually a design smell, not a testing problem.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| `@MockBean` everything in a Service test | inject a Fake repository, drop Spring |
| Fake as an inner class | move it to `…/<domain>/fake/` |
| `assertThat(x).isNotNull()` and stop | assert the actual value |
| one test, many unrelated assertions | split by behavior |
| Service test standing in for Domain/Validator tests | test each class directly |
| `Thread.sleep` to wait | coordinate explicitly / inject a clock |
| testing getters/setters | test behavior instead |
