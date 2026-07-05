---
id: diff-rules.decisions.accepted.fake-over-mock-in-service-test
source: backend-policy
domain: backend
topic: test-double-choice
roles:
  - test-writer
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---
# Fake Over Mock In Service Test

## 상태

accepted

---

## 문제 상황

Service / Validator 테스트에서
Repository를 어떤 방식으로 대체할지 결정이 필요했다.

선택지는 아래 두 가지였다.

### Mock 기반 테스트

    given(repository.findById(...))
        .willReturn(...)

### Fake 기반 테스트

    FakeOrderRepository

를 직접 구현해 사용하는 방식이다.

---

## 선택한 방향

Service / Validator 테스트에서는
Fake Repository를 우선 사용한다.

Mock은:
- 호출 여부 검증
- 외부 협력 검증

이 필요한 경우에만 사용한다.

---

## 선택 이유

### 흐름 중심 테스트 가능

Fake는 실제 상태를 가지므로,
유스케이스 흐름을 자연스럽게 검증할 수 있다.

즉:
- 저장
- 조회
- 상태 변경

흐름을 실제처럼 테스트 가능하다.

---

### 구현 세부사항 의존 감소

Mock 기반 테스트는:

    verify(...)
    given(...)

호출 구조에 과하게 의존하기 쉽다.

그 결과:
- 리팩토링 취약
- 내부 구현 변경에 민감
- 테스트 의도 약화

문제가 발생할 수 있다.

---

### 테스트 가독성 증가

Fake 기반 테스트는
행위 중심으로 읽히는 경우가 많다.

좋은 예시:

    repository.save(order)

    service.cancel(...)

    assertThat(order.status()).isEqualTo(...)

---

## Mock 사용 기준

아래 상황에서는 Mock 사용이 자연스럽다.

- 외부 API 호출 검증
- 이벤트 발행 여부 검증
- Controller → Service 위임 검증
- 협력 객체 호출 여부 자체가 중요한 경우

---

## 트레이드오프

### Fake 구현 비용 증가

Fake 클래스를 직접 작성해야 한다.

---

### Repository 구조 변경 영향 가능

Repository 인터페이스 변경 시
Fake 구현도 함께 수정해야 한다.

---

## 현재 판단

현재 프로젝트는:

- 흐름 중심 테스트
- 리팩토링 안정성
- 테스트 의도 가독성

을 더 중요하게 판단한다.

따라서 Service / Validator 테스트에서는
Fake 기반 테스트를 우선 사용한다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- Fake 구현 비용이 과도하게 증가한다.
- Fake가 실제 Repository처럼 복잡해진다.
- 테스트 유지 비용이 커진다.
- 협력 검증보다 상태 검증이 어려워진다.
