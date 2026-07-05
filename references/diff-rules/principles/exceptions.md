# Exceptions

이 문서는 프로젝트의 예외 처리 기준을 정의한다.

예외는 단순한 오류 전달이 아니라, 비즈니스 규칙과 흐름을 표현하는 수단으로 본다.

---

## 핵심 방향

- 예외를 던지는 위치는 검증 책임 위치와 일치해야 한다.
- 예외는 흐름 제어 수단으로 남용하지 않는다.
- 예외 메시지는 사용자와 개발자 모두 이해 가능해야 한다.
- 기술 예외보다 도메인 의미를 우선한다.

---

## 예외 책임

### Domain / Policy

- 자기 상태만으로 판단 가능한 검증을 수행한다.
- 비즈니스 규칙 위반 시 예외를 던진다.

### Application Validator

- Repository 조회가 필요한 검증을 수행한다.
- 존재 여부, 중복 여부 등의 검증을 담당한다.

### Application Service

- 흐름을 조율한다.
- 검증 책임을 직접 가지지 않는다.
- 엔티티 조회 실패 등 애플리케이션 흐름 예외를 처리한다.

### Presentation Layer

- 예외를 직접 처리하지 않는다.
- GlobalExceptionHandler를 통해 응답을 변환한다.

---

## ErrorCode 정책

- ErrorCode는 도메인별로 분리한다.
- 공통 ErrorCode 인터페이스로 묶는다.
- 상태 코드와 메시지를 함께 관리한다.

### 예시

- ReservationErrorCode
- ThemeErrorCode
- CommonErrorCode

---

## 커스텀 예외 정책

- 모든 커스텀 예외는 RuntimeException 기반으로 작성한다.
- 예외 클래스는 도메인이 아니라 예외 성격으로 분류한다.

### 예시

- BusinessException
- EntityNotFoundException
- BadRequestException

---

## 메시지 정책

- 기본적으로 정적 메시지를 사용한다.
- 동적 정보가 필요한 경우에만 메시지를 조합한다.
- 사용자에게 내부 구현 정보가 노출되지 않도록 한다.

### 예시

좋은 예시:
- "지난 일정은 예약할 수 없습니다."

지양하는 예시:
- "NullPointerException at ReservationService line 42"

---

## 입력 검증 예외

- Spring 기본 예외를 사용자 친화 메시지로 변환한다.
- 시스템 메시지를 그대로 노출하지 않는다.

### 대상 예시

- HttpMessageNotReadableException
- MethodArgumentTypeMismatchException

---

## 예외 처리 구조

Presentation
↓
GlobalExceptionHandler
↓
ErrorResponse

예외는 한 곳에서 일관되게 응답 형태로 변환한다.