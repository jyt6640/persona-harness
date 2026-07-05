---
id: diff-rules.decisions.accepted.domain-validation-over-getter
source: backend-policy
domain: backend
topic: domain-validation
roles:
  - implementer
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---
# Domain Validation Over Getter

## 상태

accepted

---

## 문제 상황

비즈니스 검증을 아래 두 방식 중 어디서 수행할지 결정이 필요했다.

### Getter 기반 외부 검증

    if (order.getStatus() == ...)

### Domain 내부 검증

    order.validateCancelable()

---

## 선택한 방향

비즈니스 검증은 가능한 Domain 내부에서 수행한다.

즉:
- 객체가 자기 상태를 스스로 검증한다.
- 외부에서는 행위를 요청한다.
- Getter 기반 판단을 최소화한다.

---

## 선택 이유

### 객체 책임 강화

객체는 자기 상태를 가장 잘 알고 있다.

따라서:
- 상태 검증
- 상태 변경 조건
- 비즈니스 규칙

을 객체 내부에 두는 것이 자연스럽다.

---

### Tell, Don't Ask 유지

Getter 기반 구조는
외부 객체가 내부 상태를 꺼내 판단하게 만든다.

그 결과:
- 책임 분산
- 중복 조건문 증가
- 거대한 Service

문제가 발생하기 쉽다.

---

### 흐름과 판단 분리

Service는:
- 흐름 orchestration

만 담당하고,

Domain은:
- 정책 판단
- 상태 검증

을 담당한다.

---

## 예시

좋은 예시:

    order.validateOwner()
    order.validateCancelable()
    order.cancel()

지양하는 예시:

    if (order.getStatus() == ...)
    if (order.getOwnerId().equals(...))

---

## Getter 허용 범위

Getter는 아래 상황에서만 허용한다.

- Response 변환
- 직렬화
- 출력 목적
- 외부 시스템 전달

비즈니스 판단을 위한 Getter 사용은 지양한다.

---

## 트레이드오프

### Domain 메서드 증가 가능

검증 메서드 수가 증가할 수 있다.

---

### 단순 CRUD에서는 과할 수 있음

아주 단순한 구조에서는
Getter 기반 처리도 충분할 수 있다.

---

## 현재 판단

현재 프로젝트는:

- 객체 책임 강화
- 흐름과 판단 분리
- Tell, Don't Ask 유지

를 더 중요하게 판단한다.

따라서 Domain 내부 검증 방식을 유지한다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- Domain 메서드가 과도하게 증가한다.
- 단순 위임 메서드만 반복된다.
- 객체보다 Policy 책임이 더 자연스러워진다.
- 검증 로직 응집도가 오히려 낮아진다.
