# TDD

이 문서는 프로젝트의 TDD 작업 기준을 정의한다.

TDD는 테스트를 먼저 작성하는 형식이 아니라,
생각한 흐름을 코드로 외부화하는 방법으로 본다.

---

## 핵심 방향

- 테스트는 구현 전에 의도를 먼저 표현한다.
- 완벽한 Red-Green-Refactor 강박은 두지 않는다.
- 테스트도 코드와 함께 점진적으로 개선한다.
- 테스트는 설계 피드백 도구로 사용한다.
- 빠르게 실패하고 작게 수정한다.

---

## 기본 흐름

1. 기대하는 행위를 테스트로 작성한다.
2. 실패하는 것을 확인한다.
3. 실패하는 테스트를 테스트 커밋으로 기록한다.
4. 최소 구현으로 테스트를 통과시킨다.
5. 통과한 구현을 구현 커밋으로 기록한다.
6. 중복과 어색함을 리팩토링한다.
7. 다음 작은 행위로 이동한다.

---

## 새 기능 구현 순서

1. 작업을 책임 단위로 분해한다.
2. 각 Domain public behavior 테스트를 먼저 작성한다.
3. 각 Application Validator public validation 테스트를 먼저 작성한다.
4. Service는 흐름 조율만 테스트한다.
5. Repository는 SQL과 매핑을 테스트한다.
6. Controller는 HTTP 계약과 DTO 변환을 테스트한다.
7. Acceptance Test는 전체 사용자 시나리오만 검증한다.

---

## 보강 작업 순서

코드 리뷰 보강, 테스트 보강, 리팩터링도 TDD 흐름과 커밋 단위를 유지한다.

### 테스트 보강

1. 누락된 production class 또는 public behavior를 찾는다.
2. 하나의 누락 행위에 대한 실패 테스트를 작성한다.
3. 실패를 확인한다.
4. 테스트 보강 커밋을 만든다.
5. 필요한 최소 구현 또는 수정으로 통과시킨다.
6. 구현 커밋을 만든다.

### 리팩터링

1. 기존 테스트가 통과하는지 확인한다.
2. 하나의 구조 개선 단위를 정한다.
3. 행위 변경 없이 구조만 변경한다.
4. 테스트를 다시 실행한다.
5. 리팩터링 커밋을 만든다.

리팩터링 중 새 행위가 필요해지면 리팩터링을 중단하고 테스트 커밋부터 다시 시작한다.

---

## 작성 단위

테스트 단위는 큰 기능명이 아니라 production class의 public behavior 단위로 잡는다.

예를 들어 "회원가입"은 하나의 테스트 단위가 아니다.
아래처럼 책임 단위로 쪼갠다.

- Member 생성 성공
- Member 이메일 형식 검증 실패
- Member 비밀번호 정책 검증 실패
- MemberValidator 중복 이메일 검증 실패
- MemberService 회원 저장 흐름 성공
- JdbcMemberRepository 저장 및 조회 성공
- MemberController 요청 DTO 변환 및 HTTP 응답 검증
- 회원가입 Acceptance 시나리오 검증

private method를 직접 테스트하지 않는다.
private method로 숨겨진 책임은 public behavior 테스트를 통해 드러나야 한다.

Acceptance Test는 시작점이 아니라 마지막 검증이다.
Domain, Validator, Service, Repository, Controller 테스트가 먼저 작성된 뒤 전체 사용자 시나리오만 Acceptance Test로 확인한다.

기능은 레이어 전체 단위가 아니라 작은 기능 슬라이스 단위로 작성한다.
각 슬라이스는 production class의 public behavior 단위로 더 나누고,
기본 흐름은 테스트 커밋 → 구현 커밋 순서로 진행한다.

좋은 흐름:

    Domain public behavior Test
    Domain
    Application Validator Test
    Application Validator
    Service orchestration Test
    Service
    Repository SQL/Mapping Test
    Repository
    Controller HTTP/DTO Test
    Controller
    Acceptance Scenario Test
    Acceptance

지양하는 흐름:

    Acceptance Test
    모든 Domain 작성
    모든 Service 작성
    모든 Controller 작성

    또는

    회원가입 Acceptance Test
    회원가입 전체 구현

---

## 테스트 우선순위

먼저 도메인 규칙을 테스트한다.

우선순위:

1. Domain Test
2. Service / Validator Test
3. Repository Test
4. Controller Test
5. Acceptance Test

---

## 리팩토링 기준

테스트가 통과한 뒤 아래 신호를 확인한다.

- 이름이 어색한가?
- 책임이 한 곳에 몰렸는가?
- 조건문이 정책을 숨기고 있는가?
- 중복이 반복되고 있는가?
- 테스트가 구현 세부사항에 과하게 의존하는가?

---

## 현실적 기준

항상 완벽한 TDD 사이클을 지키지는 않는다.

다만 아래 기준은 유지한다.

- 중요한 비즈니스 규칙은 테스트로 먼저 표현한다.
- 리팩토링 전후 테스트로 행위 보존을 확인한다.
- 테스트가 깨졌다면 이유를 확인하고 함께 수정한다.
- 테스트 작성이 어렵다면 설계를 먼저 의심한다.

---

## 지양하는 방식

- 테스트 없이 핵심 비즈니스 로직 작성
- 구현 세부사항에 과하게 의존하는 테스트
- 테스트 통과만을 위한 의미 없는 구현
- 깨진 테스트를 방치한 채 다음 기능 진행

---

## 판단 기준

TDD 적용 여부가 헷갈리면 아래 질문으로 판단한다.

- 이 기능의 기대 행위를 명확히 설명할 수 있는가?
- 실패 케이스가 중요한가?
- 리팩토링 시 회귀 위험이 있는가?
- 테스트가 설계를 더 명확하게 만들 수 있는가?

YES라면 테스트를 먼저 작성한다.
