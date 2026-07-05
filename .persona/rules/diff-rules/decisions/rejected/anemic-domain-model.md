---
id: diff-rules.decisions.rejected.anemic-domain-model
source: backend-policy
domain: backend
topic: anemic-domain-model
roles:
  - implementer
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---
# Anemic Domain Model

## 상태

rejected

---

## 문제 상황

Domain 객체를:
- 단순 데이터 보관 객체
- getter/setter 중심 구조

로 유지할지 고민했다.

예시:

    class Order {
        private OrderStatus status;

        public OrderStatus getStatus() {
            return status;
        }
    }

그리고 모든 비즈니스 로직을
Service에서 처리하는 구조다.

---

## 검토한 방향

### Anemic Domain Model

장점:
- 구현 단순
- 빠른 CRUD 개발 가능
- Spring/JPA와 자연스럽게 연결됨

단점:
- 객체 책임 약화
- 거대한 Service 발생
- 정책 분산

---

## 선택한 방향

Domain 객체는:
- 상태
- 행위
- 비즈니스 규칙

을 함께 가진다.

즉 객체가 자기 상태를 스스로 관리한다.

---

## 선택 이유

### 객체 책임 강화

객체는 자기 상태를 가장 잘 알고 있다.

따라서:
- 상태 검증
- 상태 변경 규칙
- 정책 판단

을 객체 내부에 두는 것이 자연스럽다.

---

### Service 비대화 방지

Anemic 구조에서는
Service가 아래 책임을 모두 가지기 쉽다.

- 상태 검증
- 조건 판단
- 정책 처리
- 상태 변경

그 결과:
- 거대한 Service
- 복잡한 조건문
- 흐름과 판단 혼합

문제가 발생할 수 있다.

---

### Tell, Don't Ask 유지

프로젝트는:
- Getter 기반 외부 판단
보다
- 객체에게 행위를 요청하는 구조

를 더 자연스럽게 판단한다.

좋은 예시:

    order.cancel()

지양하는 예시:

    if (order.getStatus() == ...)

---

## 예시

좋은 예시:

    order.validateCancelable()
    order.cancel()

지양하는 예시:

    service.cancel(order)

    if (order.getStatus() == ...)

---

## 트레이드오프

### Domain 메서드 증가 가능

행위 메서드 수가 늘어날 수 있다.

---

### 단순 CRUD에서는 과할 수 있음

아주 단순한 프로젝트에서는:
- DTO 중심 구조
- Service 중심 구조

도 충분할 수 있다.

---

## 현재 판단

현재 프로젝트는:

- 객체 책임 강화
- 흐름과 판단 분리
- 도메인 중심 설계

를 더 중요하게 판단한다.

따라서 Anemic Domain Model 구조는 채택하지 않는다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- Domain 메서드가 단순 위임만 반복된다.
- 객체보다 Service 책임이 더 자연스럽다.
- 대부분 기능이 단순 CRUD 수준이다.
- 도메인 규칙보다 외부 연동 비중이 커진다.
