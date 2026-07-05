# Validator Package Location

## 상태

pending

---

## 문제 상황

Validator 객체를 어떤 위치에 둘지 결정이 필요하다.

현재 고민 중인 선택지는 아래와 같다.

### application 내부 배치

    order/application/OrderValidator

### domain 내부 배치

    order/domain/OrderValidator

### 별도 validation 패키지 분리

    order/validation/OrderValidator

---

## 현재 방향

현재는 저장소 조회 기반 검증만
Application Layer Validator로 분리한다.

예시:

    validateDuplicate()
    validateReferenced()

---

## 현재 구조

### Domain / Policy

- 자기 상태 기반 검증
- 비즈니스 규칙
- 상태 변경 조건

### Application Validator

- Repository 조회 기반 검증
- 중복 검증
- 존재 여부 검증
- 참조 여부 검증

---

## 선택 이유

### 저장소 의존성 분리

Repository 조회가 필요한 검증은
순수 Domain 책임으로 보기 어렵다고 판단한다.

즉:
- DB 조회
- 외부 상태 확인

이 필요한 검증은
Application Layer가 더 자연스럽다.

---

### 흐름과 검증 분리

Service는:
- 흐름 orchestration

만 담당하고,

Validator는:
- 검증 전담

구조를 유지한다.

---

## 고민 지점

아래 부분은 아직 명확히 결론 내리지 않았다.

### Validator와 Policy 경계

예시:

    DiscountPolicy
    DiscountValidator

어디까지:
- 정책
- 검증

으로 볼지 상황에 따라 달라질 수 있다.

---

### Validator 객체 증가 가능성

검증이 많아질수록:

    OrderValidator
    PaymentValidator
    UserValidator

가 계속 증가할 수 있다.

---

## 현재 판단

현재 프로젝트는:

- 흐름과 검증 분리
- 저장소 의존 분리
- Service 단순화

를 더 중요하게 판단한다.

따라서 Repository 조회 기반 검증은
Application Validator 구조를 유지한다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- Validator가 정책까지 담당하기 시작한다.
- Validator 수가 과도하게 증가한다.
- Domain보다 Validator 중심 구조가 된다.
- 단순 위임만 반복된다.
- Policy와 Validator 경계가 계속 흐려진다.