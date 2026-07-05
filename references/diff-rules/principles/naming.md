# Naming

이 문서는 프로젝트의 네이밍 기준을 정의한다.

이름은 단순한 문자열이 아니라 도메인 모델링의 결과로 본다.

---

## 핵심 방향

- 이름은 구현보다 의도를 표현해야 한다.
- 이름이 어색하면 설계를 먼저 의심한다.
- 도메인 용어를 우선한다.
- 재사용보다 명시성을 우선한다.

---

## 클래스 네이밍

- 역할과 책임이 드러나는 이름을 사용한다.
- Manager / Helper / Util 같은 모호한 이름을 피한다.
- 기술 용어보다 도메인 용어를 우선한다.

### 예시

좋은 예시:
- ReservationPolicy
- ReservationValidator
- ReservationCommand

지양하는 예시:
- ReservationManager
- ReservationHelper
- ReservationUtil

---

## 메서드 네이밍

- 한 메서드는 한 가지 행위만 표현한다.
- 메서드 이름에 and가 들어가면 분리 신호로 본다.
- 가능한 긍정형 이름을 사용한다.
- boolean 파라미터로 정책 차이를 숨기지 않는다.

### 예시

좋은 예시:
- validatePastDateTime()
- validateOwner()
- cancel()

지양하는 예시:
- process()
- handle()
- doSomething()

---

## DTO 네이밍

- DTO라는 표현보다 역할을 드러내는 이름을 우선한다.
- Request / Response / Command / Query를 목적에 맞게 사용한다.

### 예시

- ReservationCreateRequest
- ReservationCreateCommand
- ReservationResponse

---

## 컬렉션 네이밍

- 컬렉션은 복수형 이름을 사용한다.
- 컬렉션 자체의 역할이 있다면 일급 컬렉션으로 분리한다.

### 예시

- reservations
- reservationTimes
- ReservationTimes

---

## 언어 정책

- 식별자는 영어를 사용한다.
- 주석은 한국어를 사용한다.
- 테스트 DisplayName은 한국어를 사용한다.

---

## 네이밍 신호

아래 상황은 설계 재검토 신호로 본다.

- 이름이 너무 길어진다.
- 이름이 역할보다 구현을 설명한다.
- 같은 접두사/접미사가 반복된다.
- 자연스럽게 이름이 나오지 않는다.
- 도메인 용어 대신 기술 용어가 들어간다.