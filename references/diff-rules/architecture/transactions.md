# Transactions

이 문서는 프로젝트의 트랜잭션 처리 기준을 정의한다.

트랜잭션은 단순 DB 기능이 아니라,
애플리케이션 흐름의 일관성을 보장하는 경계로 본다.

---

## 핵심 방향

- 트랜잭션 경계는 Application Service에 둔다.
- 하나의 유스케이스는 하나의 트랜잭션으로 처리한다.
- 읽기와 쓰기 트랜잭션을 명확히 구분한다.
- 비즈니스 규칙과 트랜잭션 책임을 혼합하지 않는다.

---

## 트랜잭션 위치

트랜잭션은 Application Layer의 Service에서 관리한다.

좋은 예시:

    OrderService
    PaymentService

지양하는 예시:

    Controller
    Repository
    Domain

---

## 읽기 / 쓰기 정책

### 쓰기 트랜잭션

기본적으로 Service는 쓰기 트랜잭션 기준으로 동작한다.

- 상태 변경
- 생성
- 수정
- 삭제

를 포함하는 유스케이스에서 사용한다.

### 읽기 트랜잭션

조회만 수행하는 메서드는 readOnly 트랜잭션을 사용한다.

예시:

    @Transactional(readOnly = true)

---

## 클래스 레벨 정책

기본적으로 Service 클래스 레벨에 트랜잭션을 선언한다.

예시:

    @Transactional
    public class OrderService

조회 메서드만 별도로 readOnly를 지정한다.

예시:

    @Transactional(readOnly = true)
    public OrderResponse getOrder()

---

## rollback 정책

기본적으로 RuntimeException 발생 시 rollback 된다.

프로젝트의 커스텀 예외는 RuntimeException 기반으로 작성한다.

예시:
- BusinessException
- EntityNotFoundException

---

## Service 책임

Service는:

- 유스케이스 흐름 조율
- 트랜잭션 경계 관리

를 담당한다.

Service는 아래 책임을 직접 가지지 않는다.

- 비즈니스 정책 판단
- 복잡한 검증 로직
- 저장 기술 구현

---

## 트랜잭션과 검증

검증 책임은 트랜잭션 책임과 분리한다.

### Domain / Policy

- 자기 상태 기반 검증

### Application Validator

- Repository 조회 기반 검증

### Service

- 검증 호출 및 흐름 조율

---

## 지양하는 구조

### Controller에서 트랜잭션 처리

지양:

    @Transactional
    public class OrderController

### Repository에서 비즈니스 흐름 처리

지양:

    repository.saveAndValidate()

### 하나의 메서드에서 과도한 작업 수행

지양:
- 여러 유스케이스 혼합
- 과도한 외부 API 호출
- 긴 트랜잭션 유지

---

## 판단 기준

트랜잭션 위치가 헷갈리면 아래 질문으로 판단한다.

- 하나의 사용자 시나리오를 조율하는가?
- 상태 변경의 일관성을 보장해야 하는가?
- 여러 작업을 하나의 흐름으로 묶는가?

YES라면 Application Service 책임이다.