---
id: diff-rules.decisions.rejected.service-layer-business-logic
source: backend-policy
domain: backend
topic: service-business-logic
roles:
  - implementer
  - reviewer
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---
# Service Layer Business Logic

## 상태

rejected

---

## 문제 상황

비즈니스 규칙과 정책 판단을
Application Service 내부에서 처리할지 고민했다.

예시:

    if (...) {
        ...
    }

    if (...) {
        ...
    }

처럼 Service 내부에서:
- 상태 검증
- 정책 판단
- 상태 변경 조건

을 직접 처리하는 구조다.

---

## 검토한 방향

### Service 중심 구조

장점:
- 구현 시작이 빠름
- 흐름을 한 곳에서 보기 쉬움
- 작은 CRUD에서는 단순함

단점:
- 정책과 흐름이 섞임
- Service 비대화
- 객체 책임 약화

---

## 선택한 방향

Service는 유스케이스 흐름만 조율한다.

비즈니스 규칙과 검증은:
- Domain
- Policy
- Validator

로 분리한다.

---

## 선택 이유

### 흐름과 판단 분리

Service가 정책까지 수행하면:
- 조건문 증가
- 역할 혼합
- 책임 집중

이 발생하기 쉽다.

프로젝트는:
- 흐름 orchestration
- 정책 판단

을 분리하는 방향을 선택한다.

---

### 객체 책임 강화

비즈니스 규칙은
상태를 가진 객체 근처에 두는 것이 자연스럽다.

즉:
- 객체가 자기 상태를 스스로 검증한다.
- Getter 기반 외부 판단을 줄인다.
- Tell, Don't Ask 방향과 연결된다.

---

### 테스트 단순화

Service는 흐름만 검증하면 된다.

정책은:
- Domain Test
- Policy Test
- Validator Test

로 분리 가능하다.

---

## 예시

좋은 예시:

    order.validateCancelable()
    validator.validateDuplicate()
    order.cancel()

지양하는 예시:

    if (order.getStatus() == ...)
    if (repository.exists(...))

---

## 트레이드오프

### 객체 수 증가 가능

Policy / Validator 객체가 늘어날 수 있다.

---

### 작은 프로젝트에서는 과할 수 있음

단순 CRUD 수준에서는
Service 내부 처리도 충분히 가능하다.

---

## 현재 판단

현재 프로젝트는:

- 흐름과 판단 분리
- 객체 책임 강화
- 테스트 구조 유지

를 더 중요하게 판단한다.

따라서 Service 중심 비즈니스 로직 구조는 채택하지 않는다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- 객체 협력보다 위임만 증가한다.
- Policy 객체가 과도하게 증가한다.
- Domain 메서드가 의미 없는 래퍼처럼 변한다.
- 단순 CRUD 수준인데 구조 복잡도가 과도하다.
