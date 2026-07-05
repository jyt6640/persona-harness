# Repository Interface In Domain

## 상태

accepted

---

## 문제 상황

Repository 인터페이스를 어느 레이어에 둘지 결정이 필요했다.

선택지는 아래 두 가지였다.

### Application Layer에 둔다

    order/application/OrderRepository

### Domain Layer에 둔다

    order/domain/OrderRepository

---

## 선택한 방향

Repository 인터페이스는 Domain Layer에 둔다.

구현체는 Infrastructure Layer에 둔다.

---

## 현재 구조

    order/
    ├── domain/
    │   └── OrderRepository
    │
    └── infrastructure/
        └── JdbcOrderRepository

---

## 선택 이유

### Domain의 저장 요구사항 표현

Repository 인터페이스는 저장 기술이 아니라,
도메인이 필요로 하는 저장 요구사항을 표현한다.

즉 Domain은:

    findById()
    save()
    existsByName()

같은 행위를 통해
무엇을 저장하고 조회해야 하는지만 안다.

---

### Infrastructure 의존 제거

Domain은 저장 기술을 알지 않는다.

즉:
- JDBC
- JPA
- MyBatis
- Redis

같은 구현 기술은 Infrastructure 책임이다.

---

### 테스트 대체 용이성

Repository 인터페이스가 분리되어 있으면
Service / Validator 테스트에서 Fake 구현체로 대체하기 쉽다.

예시:

    FakeOrderRepository

---

## 트레이드오프

### 인터페이스 수 증가

Repository마다 인터페이스와 구현체가 분리된다.

---

### 작은 프로젝트에서는 과할 수 있음

단순 CRUD에서는 구현체 하나만 있어도 충분해 보일 수 있다.

---

## 현재 판단

현재 프로젝트는:

- Domain의 기술 독립성
- 테스트 용이성
- Infrastructure 교체 가능성

을 더 중요하게 판단한다.

따라서 Repository 인터페이스는 Domain Layer에 둔다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- 인터페이스가 의미 없이 증가한다.
- 구현체 교체 가능성이 전혀 없다.
- Repository 인터페이스가 단순 CRUD만 반복한다.
- 구조 복잡도가 테스트 이점을 초과한다.