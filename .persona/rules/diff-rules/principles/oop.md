---
id: diff-rules.principles.oop
source: clean-code
domain: common
topic: object-responsibility
roles:
  - implementer
  - reviewer
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---
# OOP

이 문서는 프로젝트의 객체지향 설계 기준을 정의한다.

객체는 단순 데이터 묶음이 아니라,
상태와 행위를 함께 가지는 책임 단위로 본다.

---

## 핵심 방향

- 객체는 자기 상태를 스스로 관리한다.
- 책임은 데이터를 가장 잘 아는 객체에 둔다.
- Getter보다 행위를 우선한다.
- 흐름과 판단을 분리한다.
- 가능한 불변성을 유지한다.

---

## 객체 책임

객체는 아래 책임을 가진다.

- 상태 관리
- 상태 변경
- 상태 검증
- 비즈니스 행위 표현

좋은 예시:

    order.cancel()
    order.validateOwner()

지양하는 예시:

    service에서 order 상태 직접 비교
    getter로 상태를 꺼내 외부에서 판단

---

## Tell, Don't Ask

가능하면 객체에게 상태를 묻기보다 행위를 요청한다.

좋은 예시:

    order.cancel()

지양하는 예시:

    if (order.getStatus() == ...)

---

## 책임 배치 기준

책임 위치가 헷갈리면 아래 기준으로 판단한다.

### 필요한 데이터가 객체 내부에 있는가?

YES:
- 객체 책임

NO:
- 외부 협력 또는 Validator 책임

---

## Getter 정책

Getter는 아래 상황에서만 허용한다.

- Response 변환
- 직렬화
- 외부 출력

비즈니스 판단을 위한 Getter 남용을 지양한다.

---

## 불변성

가능한 객체의 상태를 변경 불가능하게 유지한다.

### 기준

- 필드는 가능한 final로 선언한다.
- setter 사용을 지양한다.
- 상태 변경은 새로운 객체 반환 또는 명시적 행위 메서드로 표현한다.

좋은 예시:

    order.cancel()

지양하는 예시:

    order.setStatus(CANCELED)

---

## 생성 정책

객체 생성은 의도가 드러나야 한다.

좋은 예시:

    Order.create()
    Order.restore()

지양하는 예시:

    new Order(...)

---

## Policy 객체

정책이 복잡해지면 별도 Policy 객체로 분리한다.

### 분리 신호

- 정책이 여러 개로 증가한다.
- 조건 분기가 많아진다.
- 정책 조합이 발생한다.
- 이름이 자연스럽게 나오지 않는다.

예시:

    OrderPolicy
    DiscountPolicy

---

## 객체 협력

객체는 협력할 수 있지만,
다른 객체의 책임을 대신 수행하지 않는다.

좋은 예시:

    payment.validateAmount(order)

지양하는 예시:

    order가 payment 내부 상태 직접 수정

---

## equals / hashCode

엔티티의 동등성은 식별자 기반으로 판단한다.

### 기준

- 같은 id면 같은 객체로 본다.
- 값 전체 비교를 기본 전략으로 사용하지 않는다.
- id가 없는 객체는 아직 완전한 엔티티가 아니다.

---

## 지양하는 구조

### 데이터 중심 객체

지양:

    class Order {
        getter만 존재
    }

### 과도한 책임 집중

지양:
- 거대한 Service
- 모든 판단을 외부에서 수행
- Domain이 단순 DTO처럼 동작

### 의미 없는 객체 분리

지양:
- 역할 없는 Wrapper 객체
- 한 번만 사용하는 과도한 추상화

---

## 판단 기준

객체 설계가 헷갈리면 아래 질문으로 판단한다.

- 이 객체가 자기 상태를 가장 잘 아는가?
- 상태와 행위가 함께 존재하는가?
- 외부에서 불필요한 판단을 하고 있지 않은가?
- 객체가 단순 데이터 묶음처럼 동작하지 않는가?

하나라도 NO라면 구조를 다시 검토한다.
