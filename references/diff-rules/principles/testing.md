# Testing

이 문서는 프로젝트의 테스트 작성 기준을 정의한다.

테스트는 구현 자체보다 의도와 비즈니스 규칙을 검증하는 수단으로 본다.

---

## 핵심 방향

- 테스트는 구현보다 행위를 검증한다.
- 테스트 가능한 구조를 우선한다.
- 테스트 더블은 검증 목적에 따라 선택한다.
- 테스트는 빠르고 독립적으로 실행 가능해야 한다.
- 작은 단위부터 검증하고 필요한 범위만 통합한다.

---

## 테스트 분류

### Domain Test

- 도메인 객체의 상태와 행위를 검증한다.
- 외부 의존 없이 POJO 기반으로 테스트한다.

### Service / Validator Test

- 비즈니스 흐름과 검증 로직을 테스트한다.
- Repository는 Fake로 대체한다.
- Spring Context를 사용하지 않는다.

### Repository Test

- SQL과 저장소 구현을 검증한다.
- 실제 DB(H2 등)를 사용한다.
- 슬라이스 테스트로 실행한다.

### Controller Test

- HTTP 요청/응답을 검증한다.
- Service는 Mock으로 대체한다.
- MVC 레이어만 로드한다.

### Acceptance Test

- 사용자 시나리오 전체 흐름을 검증한다.
- 실제 애플리케이션을 실행한 상태로 테스트한다.

---

## Fake와 Mock

## Fake 위치

Fake는 테스트 클래스 내부 class로 두지 않는다.

Repository Fake는 해당 도메인의 test package 아래 fake 패키지에 둔다.

예시:

    src/test/java/roomescape/member/fake/FakeMemberRepository.java
    src/test/java/roomescape/reservation/fake/FakeReservationRepository.java
    src/test/java/roomescape/theme/fake/FakeThemeRepository.java
    src/test/java/roomescape/time/fake/FakeReservationTimeRepository.java

Service / Validator 테스트는 이 Fake를 주입해서 사용한다.

### Fake

- 흐름과 상태를 검증할 때 사용한다.
- 실제 동작을 단순하게 재현한다.
- 주로 Repository 대체에 사용한다.

### Mock

- 호출 여부와 위임을 검증할 때 사용한다.
- Controller → Service 호출 검증 등에 사용한다.

---

## 테스트 대상

- 행위가 있는 메서드를 우선 테스트한다.
- 단순 getter/setter는 테스트하지 않는다.
- 생성 시 검증 로직은 테스트 대상이다.

---

## Production Class 직접 테스트 원칙

모든 production class는 직접 테스트하는 것을 기본으로 한다.

직접 테스트 대상:

- Domain Entity / Aggregate
- Domain Policy
- Application Validator
- Application Service
- Repository 구현체
- Controller
- 예외 응답 변환기

직접 테스트 예외 가능 대상:

- 단순 Request / Response DTO
- 단순 Command / Query DTO
- 설정 클래스
- Spring Boot 부트스트랩 클래스
- ErrorCode 같은 단순 상수형 클래스

단, 제외하는 경우에도 이유가 명확해야 한다.

Service 테스트가 Domain, Policy, Validator 테스트를 대체해서는 안 된다.
Service 테스트는 흐름 조율을 검증하고, 각 책임의 판단은 해당 class 테스트에서 직접 검증한다.

---

## 테스트 구조

- given / when / then 구조를 유지한다.
- 테스트 이름만으로 의도를 이해 가능해야 한다.
- 성공과 실패 케이스를 모두 고려한다.

---

## 테스트 코드 형식

모든 테스트는 아래 형식을 기본으로 따른다.

```java
    @Test
    @DisplayName("회원을 생성한다")
    void create_success() {
        // given

        // when

        // then
    }
```

규칙:

- 모든 테스트는 `@Test`와 `@DisplayName`을 작성한다.
- `@DisplayName`은 한국어로 작성한다.
- 테스트 메서드명은 `method_success`, `method_fail_with_이유`, `method_success_when_조건` 형식을 따른다.
- 테스트 본문은 given / when / then 주석을 기본으로 사용한다.
- given이 필요 없으면 생략할 수 있다.
- when과 then이 합쳐지는 예외 검증은 `// when & then`으로 작성한다.

예시:
```java
    @Test
    @DisplayName("이메일이 공백이면 회원을 생성할 수 없다")
    void create_fail_with_blank_email() {
        // when & then
        assertThatThrownBy(() -> Member.create("", "password"))
                .isInstanceOf(BusinessException.class);
    }
```

---

## 테스트 네이밍

### 성공 케이스

메서드명_success

### 실패 케이스

메서드명_fail_with_이유

### 조건 기반 성공

메서드명_success_when_조건

---
### Spring Context 정책
- 가능한 작은 범위만 로드한다.
- Service 테스트에서는 Spring을 띄우지 않는다.
- 필요한 레이어만 슬라이스 테스트로 실행한다.
- @SpringBootTest는 전체 흐름 검증에만 사용한다.

### 테스트 패키지 구조

테스트 패키지는 main 패키지 구조와 일치시킨다.

예시:

    src/main/java/roomescape/member/domain/Member.java
    src/test/java/roomescape/member/domain/MemberTest.java

    src/main/java/roomescape/member/application/MemberValidator.java
    src/test/java/roomescape/member/application/MemberValidatorTest.java

테스트 위치가 main 구조와 다르면 책임 위치를 다시 검토한다.

### TDD 방향
- 테스트를 먼저 작성하는 흐름을 지향한다.
- 완벽한 Red-Green-Refactor 사이클 강박은 두지 않는다.
- 테스트도 코드와 함께 점진적으로 개선한다.