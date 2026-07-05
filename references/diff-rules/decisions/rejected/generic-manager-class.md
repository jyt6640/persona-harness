# Generic Manager Class

## 상태

rejected

---

## 문제 상황

역할이 애매한 로직들을
아래와 같은 Manager / Helper / Util 클래스에 모을지 고민했다.

예시:

    OrderManager
    PaymentHelper
    CommonUtil

이 구조는:
- 여러 책임을 한 곳에 모으기 쉽고
- 빠르게 구현 가능하며
- 공통 로직 정리에 편해 보인다.

---

## 검토한 방향

### Generic Manager 구조

장점:
- 구현 속도 빠름
- 공통 로직 모으기 쉬움
- 진입 장벽 낮음

단점:
- 책임 경계 모호
- 역할 비대화
- 도메인 의미 약화

---

## 선택한 방향

역할이 드러나는 객체를 우선 사용한다.

즉:
- Policy
- Validator
- Calculator
- Repository
- Factory

처럼 책임이 명확한 이름을 사용한다.

---

## 선택 이유

### 이름이 설계를 숨김

Manager / Helper / Util 은
무엇을 하는 객체인지 드러나지 않는다.

예시:

    OrderManager

위 이름만으로는:
- 검증인지
- 저장인지
- 정책인지
- 흐름 조율인지

알기 어렵다.

---

### 책임 집중 발생 가능

Generic 객체는 시간이 지나며
여러 역할이 계속 추가되기 쉽다.

예시:

    OrderManager
    ├── validate()
    ├── save()
    ├── calculate()
    ├── send()
    └── ...

그 결과:
- 거대한 클래스
- 책임 혼합
- 변경 영향 증가

문제가 발생할 수 있다.

---

### 도메인 의미 약화

프로젝트는:
- 책임 기반 구조
- 도메인 중심 설계

를 지향한다.

따라서 객체 이름도:
- 역할
- 책임
- 도메인 의미

를 드러내야 한다.

---

## 좋은 예시

    OrderValidator
    DiscountPolicy
    PriceCalculator
    OrderFactory

---

## 지양하는 예시

    OrderManager
    OrderHelper
    OrderUtil
    CommonManager

---

## 트레이드오프

### 초기 객체 수 증가 가능

역할별 객체가 늘어날 수 있다.

---

### 작은 프로젝트에서는 과할 수 있음

단순 CRUD 수준에서는
하나의 객체로 처리하는 편이 단순할 수 있다.

---

## 현재 판단

현재 프로젝트는:

- 책임 명확성
- 도메인 의미 유지
- 구조 확장 가능성

을 더 중요하게 판단한다.

따라서 Generic Manager 구조는 채택하지 않는다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- 역할 분리가 과도하게 세분화된다.
- 객체 수가 지나치게 증가한다.
- 책임보다 이름 분리가 우선되기 시작한다.
- 작은 프로젝트에서 구조 비용이 더 커진다.