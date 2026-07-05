# Layered Architecture

이 문서는 프로젝트의 레이어드 아키텍처 기준을 정의한다.

루트의 ARCHITECTURE.md를 기준으로 하며, 레이어별 세부 책임을 다룬다.

---

## 핵심 방향

- 각 레이어는 자기 책임만 가진다.
- 흐름과 비즈니스 판단을 분리한다.
- 의존성은 안쪽 방향으로만 흐른다.
- 레이어를 건너뛰는 호출을 금지한다.
- 기술 구현보다 도메인 규칙을 우선한다.

---

## Presentation Layer

Presentation Layer는 외부 요청과 응답을 담당한다.

### 책임

- HTTP 요청을 받는다.
- Request DTO를 Application Command/Query로 변환한다.
- Application Service를 호출한다.
- Domain 결과를 Response DTO로 변환한다.
- HTTP 상태 코드와 응답 형식을 결정한다.

### 금지

- 비즈니스 로직을 작성하지 않는다.
- Repository를 직접 호출하지 않는다.
- Domain 객체의 상태를 직접 변경하지 않는다.

---

## Application Layer

Application Layer는 유스케이스 흐름을 조율한다.

### 책임

- 하나의 사용자 시나리오를 실행한다.
- Domain, Policy, Validator, Repository를 조합한다.
- 트랜잭션 경계를 가진다.
- 저장소 조회 기반 검증을 Application Validator에 위임한다.

### 금지

- 비즈니스 판단을 직접 수행하지 않는다.
- 복잡한 조건문으로 정책을 숨기지 않는다.
- HTTP Request/Response DTO에 의존하지 않는다.

---

## Domain Layer

Domain Layer는 핵심 비즈니스 규칙을 담당한다.

### 책임

- 자기 상태를 가진다.
- 자기 상태를 스스로 검증한다.
- 도메인 행위를 메서드로 표현한다.
- 저장 기술과 무관한 순수 Java 객체로 유지한다.

### 금지

- Repository 구현체를 알지 않는다.
- HTTP, DB, Framework 어노테이션에 의존하지 않는다.
- 외부 시스템 호출을 수행하지 않는다.

---

## Infrastructure Layer

Infrastructure Layer는 기술 구현을 담당한다.

### 책임

- Repository 인터페이스를 구현한다.
- DB, 외부 API, 메시징 등 기술 세부사항을 다룬다.
- SQL, RowMapper, 외부 클라이언트 구현을 포함한다.

### 금지

- 비즈니스 규칙을 새로 만들지 않는다.
- Domain 규칙을 우회하지 않는다.

---

## 검증 위치

- 자기 필드만으로 판단 가능하면 Domain 또는 Policy에 둔다.
- 여러 도메인 객체나 저장소 조회가 필요하면 Application Validator에 둔다.
- Service는 검증을 직접 판단하지 않고 호출만 한다.

---

## 의존 방향

Presentation
↓
Application
↓
Domain

Infrastructure는 Domain/Application의 인터페이스를 구현한다.

---

### 판단 기준

레이어 위치가 헷갈리면 아래 질문으로 결정한다.

HTTP 요청/응답 형식과 관련 있는가? → Presentation
유스케이스 흐름을 조율하는가? → Application
비즈니스 규칙 또는 상태 변경인가? → Domain
DB, 외부 API, 메시징 등 기술 구현인가? → Infrastructure