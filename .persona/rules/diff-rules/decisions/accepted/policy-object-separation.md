---
id: diff-rules.decisions.accepted.policy-object-separation
source: backend-policy
domain: backend
topic: policy-object-separation
roles:
  - implementer
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---
# Policy Object Separation

## 상태

accepted

---

## 문제 상황

비즈니스 정책을 Domain 내부 메서드만으로 유지할지,
별도 Policy 객체로 분리할지 결정이 필요했다.

예시:

    if (...) {
        ...
    }

    if (...) {
        ...
    }

같은 정책 로직이 Domain 내부에서 계속 증가하는 상황이다.

---

## 선택한 방향

정책이 복잡해지면 별도 Policy 객체로 분리한다.

단순 규칙은 Domain 내부에 유지한다.

즉:
- 항상 Policy 분리
    ❌
- 필요 시 Policy 분리
    ⭕

---

## 현재 구조

### Domain

- 상태 관리
- 단순 규칙
- 핵심 행위

### Policy

- 복잡한 정책 판단
- 정책 조합
- 조건 분기

---

## Policy 분리 기준

아래 상황이면 Policy 분리를 검토한다.

- 정책이 여러 개로 증가한다.
- 조건 분기가 많아진다.
- 정책 조합이 발생한다.
- 메서드 이름이 자연스럽게 나오지 않는다.
- Domain 내부 조건문이 과도하게 증가한다.

---

## 선택 이유

### Domain 비대화 방지

모든 정책을 Domain 내부에 유지하면:
- 조건문 증가
- 메서드 비대화
- 책임 혼합

이 발생하기 쉽다.

---

### 정책 응집도 증가

관련 정책을 하나의 객체로 모을 수 있다.

예시:

    OrderCancellationPolicy
    DiscountPolicy

---

### 테스트 단순화

정책을 독립적으로 테스트 가능하다.

즉:
- Policy Test
- Domain Test

를 분리 가능하다.

---

## 예시

좋은 예시:

    cancellationPolicy.validate(order)

지양하는 예시:

    if (...) {
        if (...) {
            ...
        }
    }

---

## 트레이드오프

### 객체 수 증가 가능

Policy 객체가 많아질 수 있다.

---

### 너무 이른 분리는 과할 수 있음

단순 규칙 수준인데
무조건 Policy로 분리하면 구조만 복잡해질 수 있다.

---

## 현재 판단

현재 프로젝트는:

- 흐름과 판단 분리
- 정책 응집도 유지
- 테스트 구조 단순화

를 더 중요하게 판단한다.

따라서 정책 복잡도 증가 시
Policy 객체를 분리하는 방향을 유지한다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- Policy 객체가 의미 없이 증가한다.
- 단순 위임만 반복된다.
- Domain보다 Policy가 더 많은 책임을 가진다.
- 정책보다 객체 협력이 더 자연스러운 상황이 많아진다.
