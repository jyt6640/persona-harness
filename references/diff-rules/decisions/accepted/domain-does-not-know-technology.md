# Domain Does Not Know Technology

## 상태

accepted

---

## 문제 상황

Domain Layer가 어디까지 기술 구현을 알아야 하는지 결정이 필요했다.

특히 아래 요소들을 Domain 내부에 둘지 고민했다.

- DB 접근 기술
- SQL
- HTTP 요청 정보
- 외부 API 클라이언트
- Framework 의존 코드

---

## 선택한 방향

Domain은 기술 구현을 알지 않는다.

즉 Domain은:
- 비즈니스 규칙
- 상태
- 행위

만 표현한다.

기술 구현은 Infrastructure에서 담당한다.

---

## 현재 구조

### Domain Layer

- Domain Entity
- Policy
- Repository Interface

### Infrastructure Layer

- Repository Implementation
- SQL
- 외부 API 연동
- 메시징 구현

---

## 선택 이유

### 비즈니스 규칙 보호

Domain이 기술 구현에 의존하기 시작하면,
핵심 규칙보다 기술 구조가 먼저 보이기 시작한다.

그 결과:
- 도메인 응집도 감소
- 테스트 복잡도 증가
- 기술 변경 영향 확대

가 발생하기 쉽다.

---

### 테스트 단순화

기술 의존이 없는 Domain은
순수 Java 객체 기반 테스트가 가능하다.

즉:
- 빠른 테스트
- 독립 실행
- Spring Context 제거

가 가능해진다.

---

### 저장 기술 교체 가능성 확보

Repository 인터페이스는 Domain에 두고,
구현체는 Infrastructure에 둔다.

즉 Domain은:

    save()
    findById()

같은 저장 요구사항만 알고,
JPA / JDBC / Redis 등의 구현은 알지 않는다.

---

## 예시

좋은 예시:

    interface OrderRepository

지양하는 예시:

    JdbcOrderRepository inside domain

---

## 트레이드오프

### 구조 복잡도 증가 가능

인터페이스와 구현체가 분리되면서
객체 수가 증가할 수 있다.

---

### 작은 프로젝트에서는 과할 수 있음

단순 CRUD 수준에서는
기술 의존 분리가 과하게 느껴질 수 있다.

---

## 현재 판단

현재 프로젝트는:

- 테스트 용이성
- 도메인 응집도 유지
- 구조 확장 가능성

을 더 중요하게 판단한다.

따라서 Domain은 기술 구현을 알지 않는 방향을 유지한다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- 인터페이스가 의미 없이 증가한다.
- 구현 교체 가능성이 사실상 존재하지 않는다.
- 구조 복잡도가 비즈니스 복잡도를 초과한다.
- 도메인보다 추상화 관리 비용이 커진다.