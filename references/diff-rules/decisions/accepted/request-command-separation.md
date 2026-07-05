# Request Command Separation

## 상태

accepted

---

## 문제 상황

Application Service의 입력 객체를
HTTP Request DTO와 동일하게 사용할지 결정이 필요했다.

선택지는 아래 두 가지였다.

### Request DTO 직접 사용

    Controller
    → Service(Request DTO)

### Request / Command 분리

    Controller
    → Request DTO
    → Command 변환
    → Service(Command)

---

## 선택한 방향

Presentation DTO와 Application DTO를 분리한다.

### Presentation DTO

HTTP 요청/응답 표현

예시:

    OrderCreateRequest
    OrderResponse

### Application DTO

비즈니스 흐름 전달 목적

예시:

    OrderCreateCommand
    OrderSearchQuery

---

## 현재 구조

### Presentation Layer

- HTTP 요청/응답 처리
- JSON 매핑
- Validation Annotation
- Request → Command 변환

### Application Layer

- Command / Query 기반 유스케이스 실행
- HTTP 기술과 무관한 흐름 처리

---

## 선택 이유

### 변경 이유 분리

HTTP 스펙 변경과
비즈니스 요구사항 변경은 다른 이유로 변경된다.

Request DTO는:
- API 스펙 변화 영향

Command는:
- 유스케이스 변화 영향

을 받는다.

---

### Application Layer의 독립성 유지

Service는 HTTP를 몰라야 한다.

즉:
- REST API
- gRPC
- Batch
- Message Queue

등 다른 진입점에서도
동일한 Service 시그니처 사용 가능하다.

---

### 레이어 책임 명확화

Controller는 외부 요청을 변환하고,
Application은 비즈니스 흐름만 처리한다.

즉:
- HTTP 책임
- 유스케이스 책임

이 자연스럽게 분리된다.

---

## 트레이드오프

### 객체 수 증가

Request와 Command가 분리되면서
DTO 클래스 수가 증가할 수 있다.

---

### 단순 CRUD에서는 중복처럼 보일 수 있음

필드 구성이 거의 동일한 경우:

    OrderCreateRequest
    OrderCreateCommand

가 중복처럼 느껴질 수 있다.

---

## 현재 판단

현재 프로젝트는:

- 레이어 책임 명확화
- HTTP 의존성 분리
- 구조 확장 가능성

을 고려했을 때,
DTO 분리가 더 자연스럽다고 판단한다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- 모든 DTO가 완전히 동일하게 반복된다.
- 단순 CRUD 수준을 넘지 않는다.
- 변환 비용이 과도하게 증가한다.
- Application Layer가 지나치게 얇아진다.