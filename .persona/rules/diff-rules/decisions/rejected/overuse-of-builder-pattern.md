---
id: diff-rules.decisions.rejected.overuse-of-builder-pattern
source: clean-code
domain: common
topic: builder-overuse
roles:
  - implementer
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---
# Overuse Of Builder Pattern

## 상태

rejected

---

## 문제 상황

객체 생성을 대부분 Builder 패턴으로 통일할지 고민했다.

예시:

    Order.builder()
        .name(name)
        .price(price)
        .status(status)
        .build()

형태의 구조다.

---

## 검토한 방향

### Builder 중심 생성 구조

장점:
- 가독성 증가 가능
- 많은 파라미터 처리 용이
- 선택값 표현 가능

단점:
- 생성 의도 약화
- 잘못된 상태 생성 가능
- 불필요한 생성 복잡도 증가

---

## 선택한 방향

Builder는:
- 정말 필요한 경우에만 사용한다.

기본적으로는:
- 생성자
- 정적 팩토리 메서드
- 명시적 생성 메서드

를 우선 사용한다.

---

## 선택 이유

### 생성 의도 유지

Builder는:
- 어떤 생성 규칙이 중요한지
- 어떤 값이 필수인지
- 어떤 상태가 유효한지

숨기기 쉽다.

예시:

    Order.create(customer, items)

는:
- 생성 의도
- 도메인 의미

가 드러난다.

반면:

    Order.builder()

는 단순 데이터 조립처럼 보일 수 있다.

---

### 잘못된 상태 생성 가능

Builder는:
- 필수값 누락
- 잘못된 조합
- invalid state

를 만들 가능성이 있다.

그 결과:
- 객체 생성 규칙 약화
- validation 의존 증가

문제가 발생할 수 있다.

---

### 불필요한 복잡도 증가

단순 객체까지 Builder를 사용하면:

- 코드 길이 증가
- 생성 흐름 복잡화
- 의미 없는 boilerplate

가 발생하기 쉽다.

---

## Builder 허용 기준

아래 상황에서는 Builder 사용이 자연스럽다.

- 파라미터가 매우 많다.
- 선택 필드가 많다.
- 테스트 fixture 생성
- 외부 DTO 조립
- immutable 객체 조립

---

## 좋은 예시

    Order.create(customer, items)

    Money.of(amount)

---

## 허용 가능한 예시

    TestOrderBuilder
    ResponseBuilder

---

## 지양하는 예시

    User.builder()
        .id(id)
        .name(name)
        .status(status)
        .build()

단순 데이터 세팅만 반복되는 구조다.

---

## 트레이드오프

### 생성 메서드 증가 가능

명시적 생성 메서드 수가 늘어날 수 있다.

---

### 생성자 오버로드 증가 가능

상황에 따라 생성 메서드 종류가 많아질 수 있다.

---

## 현재 판단

현재 프로젝트는:

- 생성 의도 명확성
- 객체 유효 상태 보장
- 도메인 의미 유지

를 더 중요하게 판단한다.

따라서 Builder 패턴 남용은 지양한다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- 생성 파라미터 수가 계속 증가한다.
- 선택 필드 조합이 복잡해진다.
- 테스트 fixture 작성 비용이 커진다.
- 생성자 가독성이 급격히 떨어진다.
