# Transaction Boundary In Service

## 상태

accepted

---

## 문제 상황

트랜잭션 경계를 어느 레이어에 둘지 결정이 필요했다.

선택지는 아래와 같았다.

### Controller에 둔다

    @Transactional
    class OrderController

### Service에 둔다

    @Transactional
    class OrderService

### Repository에 둔다

    @Transactional
    class OrderRepository

---

## 선택한 방향

트랜잭션 경계는 Application Service에 둔다.

Service는 하나의 유스케이스 흐름을 조율하므로,
트랜잭션 경계를 관리하기 가장 자연스럽다.

---

## 선택 이유

### 유스케이스 단위 일관성 보장

하나의 사용자 시나리오는 여러 작업을 포함할 수 있다.

예시:

    주문 생성
    재고 차감
    결제 기록 저장

이 작업들은 하나의 흐름으로 성공하거나 실패해야 한다.

---

### Controller 책임 분리

Controller는 HTTP 요청/응답을 처리하는 책임만 가진다.

트랜잭션은 HTTP 책임이 아니라
애플리케이션 흐름의 일관성 책임이다.

---

### Repository 책임 분리

Repository는 저장소 접근을 담당한다.

트랜잭션 경계를 Repository에 두면
여러 저장소 작업을 하나의 유스케이스로 묶기 어렵다.

---

## 현재 정책

Service 클래스 레벨에 기본 트랜잭션을 선언한다.

    @Transactional
    public class OrderService

조회 전용 메서드는 readOnly를 명시한다.

    @Transactional(readOnly = true)
    public OrderResponse getOrder()

---

## rollback 정책

기본적으로 RuntimeException 발생 시 rollback 된다.

프로젝트의 커스텀 예외도 RuntimeException 기반으로 작성한다.

예시:

    BusinessException
    EntityNotFoundException

---

## 트레이드오프

### Service 책임 증가 가능

Service가 흐름 조율과 트랜잭션 경계를 함께 가진다.

다만 정책 판단은 Domain / Policy / Validator에 위임하므로
Service 비대화를 방지한다.

---

### 단순 조회에도 트랜잭션 고려 필요

조회 메서드에는 readOnly 설정을 명시해야 한다.

---

## 현재 판단

현재 프로젝트는:

- 유스케이스 단위 일관성
- 레이어 책임 분리
- rollback 정책 일관성

을 더 중요하게 판단한다.

따라서 트랜잭션 경계는 Application Service에 둔다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- 하나의 Service 메서드가 너무 긴 트랜잭션을 가진다.
- 외부 API 호출이 트랜잭션 내부에 오래 머문다.
- 여러 Aggregate 간 일관성 처리 방식이 복잡해진다.
- 이벤트 기반 비동기 처리 필요성이 커진다.