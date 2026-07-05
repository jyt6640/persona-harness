# Service Orchestration Only

## 상태

accepted

---

## 문제 상황

Application Service가 어디까지 책임져야 하는지 결정이 필요했다.

특히 아래 역할을 Service에 둘지 고민했다.

- 비즈니스 정책 판단
- 검증 로직
- 상태 변경 규칙
- 흐름 조율

---

## 선택한 방향

Service는 유스케이스 흐름만 조율한다.

비즈니스 판단과 검증은
Domain / Policy / Validator에 위임한다.

---

## 현재 구조

### Service

- 유스케이스 흐름 조율
- 트랜잭션 경계 관리
- 객체 협력 orchestration

### Domain / Policy

- 상태 검증
- 비즈니스 규칙
- 상태 변경 판단

### Application Validator

- Repository 조회 기반 검증
- 중복 검증
- 참조 여부 검증

---

## 예시

좋은 예시:

    validator.validateDuplicate()
    order.validateOwner()
    order.cancel()

지양하는 예시:

    if (...) {
        if (...) {
            ...
        }
    }

---

## 선택 이유

### 흐름과 판단 분리

Service가 정책까지 수행하면
흐름과 판단이 섞이기 시작한다.

그 결과:
- 조건문 증가
- 책임 집중
- 테스트 어려움

이 발생하기 쉽다.

---

### Domain 책임 강화

비즈니스 규칙을 Domain이 직접 가지게 된다.

즉:
- 객체가 자기 상태를 스스로 관리한다.
- Getter 기반 외부 판단이 줄어든다.
- Tell, Don't Ask 방향과 자연스럽게 연결된다.

---

### 테스트 단순화

Service는 흐름만 검증하면 된다.

정책은:
- Domain Test
- Policy Test
- Validator Test

로 분리 가능하다.

---

## 트레이드오프

### 객체 수 증가 가능

Policy / Validator 객체가 늘어날 수 있다.

---

### 작은 프로젝트에서는 과할 수 있음

아주 단순한 CRUD 수준에서는
Service 내부 처리도 충분히 가능하다.

---

## 현재 판단

현재 프로젝트는:

- 비즈니스 규칙 증가 가능성
- 검증 로직 분리 필요성
- 테스트 구조 유지

를 고려했을 때,
흐름과 판단 분리가 더 자연스럽다고 판단한다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- Policy 객체가 과도하게 증가한다.
- Validator가 흐름까지 담당하기 시작한다.
- 객체 협력보다 호출 위임만 늘어난다.
- 단순 CRUD 수준인데 구조 복잡도가 과도하다.