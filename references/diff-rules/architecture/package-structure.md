# Package Structure

이 문서는 프로젝트의 패키지 구조 기준을 정의한다.

패키지는 단순한 파일 정리가 아니라,
도메인과 책임을 표현하는 구조로 본다.

---

## 핵심 방향

- 도메인 중심 패키지 구조를 사용한다.
- 레이어는 도메인 하위에서 책임 단위로 분리한다.
- 패키지는 책임과 역할을 표현해야 한다.
- 단순 파일 개수 때문에 패키지를 분리하지 않는다.
- 구조는 단순하게 유지하고 필요할 때만 세분화한다.

---

## 기본 구조

    project
    ├── order
    │   ├── presentation
    │   ├── application
    │   ├── domain
    │   └── infrastructure
    │
    ├── user
    │   ├── presentation
    │   ├── application
    │   ├── domain
    │   └── infrastructure
    │
    └── global

---

## 도메인 우선 구조

최상위 패키지는 기술이 아니라 도메인 기준으로 나눈다.

좋은 예시:

    order/
    user/
    payment/

지양하는 예시:

    controller/
    service/
    repository/

---

## 레이어 구조

각 도메인 내부에서 레이어를 분리한다.

### presentation

- Controller
- Request DTO
- Response DTO

### application

- Service
- Validator
- Command / Query DTO

### domain

- Domain Entity
- Policy
- Repository Interface

### infrastructure

- Repository Implementation
- SQL
- 외부 API 구현체

---

## global 패키지

도메인 횡단 관심사는 global 패키지에 둔다.

- 여러 도메인에서 공통으로 사용하는 횡단 관심사를 둔다.
- 특정 도메인 책임이 있는 코드는 global에 두지 않는다.

### 예시

    global/
    ├── exception
    ├── validation
    ├── config
    └── response

---

## DTO 구조

DTO는 역할에 따라 분리한다.

- HTTP 스펙 변경과 비즈니스 요구사항 변경은 다른 이유로 변경된다.

## DTO 패키지 위치

DTO는 사용하는 레이어 내부의 dto 패키지에 둔다.

예시:

    member/
    ├── presentation/
    │   ├── MemberController.java
    │   └── dto/
    │       ├── MemberCreateRequest.java
    │       └── MemberResponse.java
    ├── application/
    │   ├── MemberService.java
    │   ├── MemberValidator.java
    │   └── dto/
    │       └── MemberCreateCommand.java
    ├── domain/
    └── infrastructure/

Presentation DTO와 Application DTO는 변경 이유가 다르므로 분리한다.

- Request / Response는 presentation/dto에 둔다.
- Command / Query는 application/dto에 둔다.
- Domain 객체를 DTO처럼 사용하지 않는다.

### Presentation DTO

HTTP 요청/응답 표현

예시:
- OrderCreateRequest
- OrderResponse

### Application DTO

비즈니스 흐름 전달 목적

예시:
- OrderCreateCommand
- OrderSearchQuery

---

## 패키지 분리 기준

아래 조건일 때만 하위 패키지를 추가한다.

- 역할이 명확히 다르다.
- 같은 종류의 클래스가 여러 개 존재한다.
- 책임이 독립적으로 설명 가능하다.

---

## 지양하는 구조

### 단순 정리용 패키지

지양:

    util/
    helper/
    common/

### 레이어 최상위 구조

지양:

    controller/
    service/
    repository/

### 의미 없는 depth 증가

지양:

    order/application/service/impl/internal/

---

## 테스트 패키지 구조

테스트도 프로덕션 구조를 그대로 따른다.

예시:

    src/test/java/
    └── project
        └── order
            ├── application
            ├── domain
            └── infrastructure

---

## Test Fake 패키지

테스트 Fake는 테스트 대상 클래스 내부가 아니라 test source의 fake 패키지에 둔다.

Repository Fake는 Repository 인터페이스가 위치한 도메인 패키지를 기준으로 배치한다.

예시:

    src/main/java/roomescape/member/domain/MemberRepository.java
    src/test/java/roomescape/member/domain/fake/FakeMemberRepository.java

    src/main/java/roomescape/reservation/domain/ReservationRepository.java
    src/test/java/roomescape/reservation/domain/fake/FakeReservationRepository.java

Fake가 여러 테스트에서 사용되지 않더라도 내부 class로 만들지 않는다.
테스트 보조 객체도 위치와 책임을 명확히 표현한다.

---

## 패키지 설계 신호

아래 상황은 패키지 구조 재검토 신호로 본다.

- 특정 패키지가 과도하게 비대해진다.
- util/helper 클래스가 계속 증가한다.
- 도메인보다 기술 기준 패키지가 먼저 보인다.
- 같은 역할의 클래스가 여러 위치에 흩어진다.
- depth가 깊어질수록 의미가 약해진다.

---

## 판단 기준

패키지 위치가 헷갈리면 아래 질문으로 판단한다.

- 이 패키지가 도메인 책임을 표현하는가?
- 역할이 명확히 구분되는가?
- 다른 개발자가 바로 이해 가능한가?
- 단순 파일 정리를 위한 분리인가?

마지막 질문이 YES라면 분리를 다시 검토한다.