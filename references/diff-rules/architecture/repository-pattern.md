# Repository Pattern

이 문서는 Repository 계층의 설계 기준을 정의한다.

Repository는 도메인의 저장 요구사항을 표현하는 포트이며,
Infrastructure는 이를 구현하는 어댑터 역할을 한다.

---

## 핵심 방향

- Repository 인터페이스는 Domain Layer에 둔다.
- 구현체는 Infrastructure Layer에 둔다.
- Domain은 저장 기술을 알지 못한다.
- 저장 방식보다 도메인 의미를 우선한다.
- Repository는 비즈니스 규칙을 가지지 않는다.

---

## 역할 분리

### Domain Layer

Repository 인터페이스를 정의한다.

domain/
└── ReservationRepository.java

도메인은:

무엇이 저장되어야 하는지 표현한다.
어떻게 저장되는지는 알지 못한다.

---

## Infrastructure Layer

Repository 구현체를 작성한다.

infrastructure/
└── JdbcReservationRepository.java

Infrastructure는:

- SQL
- RowMapper
- DB 접근
- 외부 저장 기술

등을 담당한다.

---

## 의존 방향

Application
↓
Domain Repository Interface
↑
Infrastructure Implementation

Infrastructure는 Domain의 인터페이스를 구현한다.

---

## 메서드 네이밍
- Repository 메서드는 도메인 언어를 사용한다.
- SQL 관점보다 비즈니스 의미를 우선한다.

### 예시

좋은 예시:
- findByDateAndThemeId()
- existsByReservationTimeId()

지양하는 예시:
- selectReservation()
- executeQuery()

---

## Repository 책임

### Repository가 해야 하는 일
- 저장
- 조회
- 삭제
- 영속화 관련 기술 처리

### Repository가 하지 않는 일
- 비즈니스 정책 판단
- 복잡한 검증 로직
- HTTP 요청 처리

---

## 도메인과 영속화 분리
- Domain 객체는 저장 기술에 의존하지 않는다.
- 가능한 순수 Java 객체로 유지한다.
- 영속화 어노테이션 사용 여부는 기술 선택과 규모에 따라 결정한다.

---

## 테스트 전략

### Service / Validator Test
- Fake Repository를 사용한다.
- Spring Context 없이 테스트한다.

### Repository Test
- 실제 DB 기반으로 검증한다.
- SQL과 매핑 결과를 테스트한다.

---

## SQL 정책
- SQL은 Repository 구현체 내부에 위치한다.
- SQL은 상수로 분리해 관리한다.
- text block을 사용해 가독성을 유지한다.

### 예시

private static final String FIND_BY_ID = """
    SELECT *
    FROM reservation
    WHERE id = ?
    """;

---

## 판단 기준

아래 질문으로 Repository 책임 여부를 판단한다.

- 저장 기술과 관련 있는가?
- DB 조회가 필요한가?
- 영속화 구현 세부사항인가?

YES라면 Repository 책임이다.