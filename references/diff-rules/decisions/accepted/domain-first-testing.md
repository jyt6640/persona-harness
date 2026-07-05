# Domain First Testing

## 상태

accepted

---

## 문제 상황

기능 구현 시 어떤 레이어부터 테스트를 작성할지 결정이 필요했다.

선택지는 아래 두 가지였다.

### 외부 레이어 우선

    Controller
    → Service
    → Domain

### Domain 우선

    Domain
    → Service
    → Repository
    → Controller

---

## 선택한 방향

핵심 비즈니스 규칙은
Domain부터 테스트한다.

기능은 안쪽 레이어에서 바깥 방향으로 구현한다.

---

## 현재 흐름

기본 구현 순서:

    Domain Test
    → Domain
    → Service Test
    → Service
    → Repository Test
    → Repository
    → Controller Test
    → Controller

---

## 선택 이유

### 비즈니스 규칙 보호

프로젝트에서 가장 중요한 것은:
- 도메인 규칙
- 상태 변경 조건
- 정책 판단

이다.

따라서 핵심 규칙부터 먼저 검증한다.

---

### 설계 피드백 빠름

Domain 테스트를 먼저 작성하면:
- 객체 책임
- 메서드 이름
- 정책 위치

문제가 빠르게 드러난다.

즉 테스트가 설계 피드백 역할을 한다.

---

### 테스트 속도 유지

Domain 테스트는:
- Spring Context 없음
- DB 없음
- 외부 의존 없음

상태로 빠르게 실행 가능하다.

그 결과:
- 빠른 피드백
- 작은 수정 반복
- 리팩토링 안정성

을 유지하기 쉽다.

---

## Service 테스트 방향

Service 테스트는:
- 흐름 orchestration
- 객체 협력
- 트랜잭션 흐름

을 검증한다.

정책 자체는:
- Domain
- Policy
- Validator

테스트에서 검증한다.

---

## Controller 테스트 방향

Controller 테스트는:
- HTTP 요청/응답
- 상태 코드
- JSON 변환

등 외부 인터페이스를 검증한다.

비즈니스 규칙 자체를 검증하지 않는다.

---

## 트레이드오프

### 초기 구조 고민 증가 가능

도메인부터 설계해야 하므로,
초기 책임 고민이 더 필요할 수 있다.

---

### 단순 CRUD에서는 과할 수 있음

아주 단순한 기능에서는:
- Controller
- Repository

중심 테스트도 충분할 수 있다.

---

## 현재 판단

현재 프로젝트는:

- 도메인 중심 설계
- 빠른 피드백
- 리팩토링 안정성

을 더 중요하게 판단한다.

따라서 Domain 우선 테스트 흐름을 유지한다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- Domain이 지나치게 얇아진다.
- 테스트 대부분이 단순 CRUD 검증이다.
- Service 흐름 복잡도가 더 중요해진다.
- 도메인보다 외부 연동 비중이 커진다.