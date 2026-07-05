# Domain Boundary

이 문서는 도메인 간 책임과 경계 기준을 정의한다.

도메인은 자기 책임 안에서 상태와 규칙을 관리해야 하며,
다른 도메인의 내부 상태를 직접 조작하지 않는다.

---

## 핵심 방향

- 책임은 데이터를 가장 잘 아는 객체에 둔다.
- 흐름과 판단을 분리한다.
- 객체는 자기 상태를 스스로 검증한다.
- 도메인 간 책임 침범을 피한다.
- Getter보다 행위를 우선한다.

---

## 도메인 책임

도메인은 아래 책임을 가진다.

- 상태 관리
- 상태 변경
- 비즈니스 규칙 검증
- 도메인 행위 표현

### 예시

좋은 예시:
- reservation.validateOwner()
- reservation.cancel()

지양하는 예시:
- service에서 reservation 상태 직접 비교
- getter로 상태를 꺼내 외부에서 판단

---

## Domain 생성자 정책

Domain Entity / Aggregate의 생성자는 private로 막는다.

Domain 객체는 정적 팩터리 메서드로 생성한다.

예시:

    public class Reservation {
        private Reservation(...) {
            ...
        }

        public static Reservation create(...) {
            ...
        }

        public static Reservation restore(...) {
            ...
        }
    }

정적 팩터리 메서드 기준:

- `create`: 신규 도메인 생성
- `restore`: DB 조회 결과로 도메인 복원
- `of`: 값 객체 생성

생성자가 public이면 Domain 생성 규칙이 여러 레이어로 흩어질 수 있다.
따라서 Entity / Aggregate는 생성 경로를 명시적으로 제한한다.

---

## Domain 생성 방식

Domain Entity / Aggregate는 기본적으로 class를 사용한다.

class를 기본으로 하는 이유:

- 도메인 객체는 단순 데이터 묶음이 아니라 상태와 행위를 가진다.
- 생성 검증, 상태 변경, 정책 메서드가 늘어날 수 있다.
- record의 자동 accessor가 도메인 외부 판단을 유도할 수 있다.
- 도메인 객체의 생명주기와 책임을 명시적으로 표현하기 쉽다.

record를 사용할 수 있는 경우:

- Command
- Query
- Request / Response DTO
- 값 전달 목적의 단순 Value Object
- 불변 값 자체가 의미인 객체

지양:

    public record Reservation(...) {
    }

권장:

    public class Reservation {
        ...
    }

Domain Entity / Aggregate를 record로 만들고 싶다면, 값 객체인지 생명주기를 가진 도메인 객체인지 먼저 검토한다.

---

## 책임 배치 기준

책임 위치가 헷갈리면 아래 기준으로 판단한다.

### 자기 상태만으로 판단 가능한가?

YES:
- Domain 또는 Policy 책임

NO:
- Application Validator 책임

---

## 입력 검증 위치

HTTP 입력의 null / blank 검증은 Request DTO에서 수행한다.

Request DTO 책임:ㄹ

- null 검증
- blank 검증
- 필수값 검증
- 기본 형식 검증
- 길이 제한 등 HTTP 입력 계약 검증

Domain 책임:

- 도메인 의미 검증
- 상태 전이 규칙
- 예약 가능 여부
- 취소 가능 여부
- 소유자 검증
- 도메인 값 객체의 불변성 검증

Service 책임:

- 검증을 직접 수행하지 않는다.
- Domain / Policy / Validator 호출 흐름만 조율한다.

예시:

    public record MemberCreateRequest(
            @NotBlank String name,
            @NotBlank @Email String email,
            @NotBlank String password
    ) {
        public MemberCreateCommand toCommand() {
            return new MemberCreateCommand(name, email, password);
        }
    }

null / blank 같은 HTTP 입력 필수값 검증을 Domain 또는 Service에 누적하지 않는다.

---

## Domain Policy

정책이 단순할 때는 Domain 내부에 둔다.

정책이 아래 조건에 해당하면 Policy로 분리한다.

- 정책이 여러 개로 증가한다.
- 조건 분기가 많아진다.
- 정책 조합이 발생한다.
- 메서드 이름이 자연스럽게 나오지 않는다.

### 예시

- ReservationPolicy
- ReservationCancellationPolicy

---

## Application Validator

저장소 조회가 필요한 검증은 Application Validator에 둔다.

### 예시

- 중복 검증
- 참조 여부 검증
- 존재 여부 검증

### 특징

- Repository 조회 가능
- Application Layer 위치
- 흐름이 아니라 검증만 담당

---

## 도메인 간 협력

도메인은 협력할 수 있지만,
다른 도메인의 책임을 대신 수행하지 않는다.

### 좋은 예시

- Reservation이 Theme 정보를 사용
- Reservation이 자기 규칙을 직접 검증

### 지양하는 예시

- Theme가 Reservation 상태를 직접 변경
- Service가 여러 도메인 규칙을 직접 판단

---

## Tell, Don't Ask

가능하면 객체에게 상태를 묻기보다 행위를 요청한다.

### 좋은 예시

- reservation.validatePast()

### 지양하는 예시

- reservation.getDate()
- reservation.getTime()
- service에서 직접 비교

---

## Getter 정책

Getter는 아래 상황에서만 허용한다.

- Response 변환
- 직렬화
- 외부 출력

비즈니스 판단을 위한 Getter 남용을 지양한다.

---

## 판단 기준

아래 질문으로 책임 위치를 판단한다.

- 이 객체가 자기 상태를 가장 잘 아는가?
- 필요한 데이터가 이 객체 안에 있는가?
- 외부에서 판단하면 책임이 퍼지지 않는가?

YES라면 Domain 책임이다.