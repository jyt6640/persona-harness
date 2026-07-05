# Util Based Validation

## 상태

rejected

---

## 문제 상황

검증 로직을 아래 방식처럼
공통 Util 클래스에 모을지 고민했다.

예시:

    ValidationUtil.validateDate()
    ValidationHelper.validateOwner()

또는:

    CommonValidator.validate(...)

형태로 검증을 처리하는 구조다.

---

## 검토한 방향

### Util 기반 검증

장점:
- 재사용 가능
- 빠르게 작성 가능
- 중복 제거 쉬움

단점:
- 책임 위치가 흐려짐
- 도메인 의미가 약해짐
- 검증 맥락이 사라짐

---

## 선택한 방향

검증은 책임을 가진 객체 근처에 둔다.

즉:

- 자기 상태 기반 검증
    → Domain / Policy

- 저장소 조회 기반 검증
    → Application Validator

로 분리한다.

---

## 선택 이유

### 책임 위치 명확화

검증은 단순 공통 로직이 아니라,
비즈니스 규칙의 일부로 본다.

따라서:
- 누가 검증 책임을 가지는가
- 어떤 맥락에서 검증하는가

가 중요하다.

---

### 도메인 의미 유지

아래 코드는 의미 차이가 크다.

좋은 예시:

    order.validateOwner()

지양하는 예시:

    ValidationUtil.validateOwner(order)

전자는:
- 객체 책임
- 도메인 행위

가 드러난다.

후자는:
- 단순 데이터 처리 함수처럼 보인다.

---

### util/helper 비대화 방지

Util 기반 구조는 시간이 지나며 아래 형태로 커지기 쉽다.

    ValidationUtil
    DateUtil
    OrderUtil
    CommonHelper

이 구조는:
- 책임 경계 약화
- 도메인 응집도 감소
- 거대한 공통 클래스 증가

문제를 만들 가능성이 높다.

---

## 트레이드오프

### 초기 작성 속도 감소 가능

작은 검증도 위치를 고민해야 한다.

---

### 객체 수 증가 가능

Policy / Validator 객체가 늘어날 수 있다.

---

## 현재 판단

현재 프로젝트는:

- 도메인 책임 강화
- 흐름과 판단 분리
- 객체 중심 설계 유지

를 더 중요하게 판단한다.

따라서 util 기반 검증 구조는 채택하지 않는다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- 같은 검증 로직이 과도하게 반복된다.
- Policy / Validator 수가 지나치게 증가한다.
- 검증 책임 위치가 오히려 더 혼란스러워진다.
- 공통 정책 관리 비용이 커진다.