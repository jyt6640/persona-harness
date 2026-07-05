---
id: diff-rules.decisions.accepted.exception-hierarchy
source: backend-policy
domain: backend
topic: exception-hierarchy
roles:
  - implementer
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---
# Exception Hierarchy

## 상태

accepted

---

## 문제 상황

예외를:
- Java 기본 예외 중심으로 사용할지
- 프로젝트 전용 예외 계층을 만들지

결정이 필요했다.

또한:
- checked exception
- unchecked exception

중 어떤 방향을 기본 전략으로 사용할지도 고민했다.

---

## 선택한 방향

프로젝트 전용 예외 계층을 사용한다.

모든 커스텀 예외는 RuntimeException 기반으로 작성한다.

---

## 현재 구조

    RoomEscapeException
    ├── BusinessException
    ├── EntityNotFoundException
    └── BadRequestException

각 예외는:
- ErrorCode
- 상태 코드
- 메시지

를 함께 가진다.

---

## 선택 이유

### 비즈니스 의미 표현

예외는 단순 오류가 아니라,
비즈니스 실패 상황을 표현한다.

예시:

    RESERVATION_NOT_FOUND
    ORDER_ALREADY_CANCELED

이런 의미는
기본 Java 예외만으로 표현하기 어렵다.

---

### rollback 정책 일관성 유지

Spring은 기본적으로:

    RuntimeException

발생 시 rollback 한다.

프로젝트는:
- 트랜잭션 일관성
- 예외 흐름 단순화

를 위해 unchecked exception 기반 전략을 사용한다.

---

### ErrorCode 중심 관리

예외마다:
- 상태 코드
- 메시지
- 에러 의미

를 분리 관리한다.

좋은 예시:

    OrderErrorCode.ORDER_NOT_FOUND

지양하는 예시:

    throw new RuntimeException("주문 없음")

---

## Checked Exception 미사용 이유

Checked Exception은:

- throws 전파 증가
- 흐름 복잡도 증가
- 비즈니스 코드 오염

문제를 만들 가능성이 있다고 판단했다.

특히 Spring Transaction 흐름과 결합 시
rollback 정책 관리 비용이 증가할 수 있다.

---

## 좋은 예시

    throw new BusinessException(
        OrderErrorCode.ORDER_ALREADY_CANCELED
    )

---

## 지양하는 예시

    throw new RuntimeException("에러")
    throw new Exception()

---

## 트레이드오프

### 예외 클래스 증가 가능

도메인별 ErrorCode와 예외 구조가 늘어날 수 있다.

---

### 작은 프로젝트에서는 과할 수 있음

단순 CRUD 수준에서는
기본 예외만으로도 충분할 수 있다.

---

## 현재 판단

현재 프로젝트는:

- 비즈니스 의미 명확성
- rollback 일관성
- 예외 흐름 가독성

을 더 중요하게 판단한다.

따라서 RuntimeException 기반의
프로젝트 전용 예외 계층을 유지한다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- 예외 종류가 과도하게 증가한다.
- ErrorCode 관리 비용이 커진다.
- 예외 계층보다 메시지 분기가 더 많아진다.
- 단순 전달용 예외만 반복된다.
