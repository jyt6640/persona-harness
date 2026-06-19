# Rule Policy

## Goal

`.persona/rules`는 Java/Spring Backend MVP에서 모델 입력에 결정적으로 주입할 기준 문서다.

이 문서는 어떤 철학을 rule로 승격하고 어떤 철학을 제외하는지 정의한다.

## 가져올 수 있는 원칙

- 작은 메서드
- 명확한 이름
- 의도를 드러내는 코드
- 성급하지 않은 중복 제거
- 테스트 가능한 구조
- Controller는 HTTP 요청/응답 변환에 집중
- Service는 유스케이스 흐름을 표현
- Repository는 영속성 세부사항을 숨김
- DTO는 API 계약을 명확히 표현
- Entity는 도메인 불변성과 상태 변경을 책임짐
- 테스트는 구현 세부사항보다 행위를 검증
- 예외와 검증은 경계에서 명확히 처리
- API 요청/응답 계약은 테스트와 DTO에 명시적으로 드러나야 함

## 기본 Baseline과 선택 철학

현재 기본값은 Clean Code와 Java/Spring Backend 역할 책임이다.

개인/팀/프로젝트 철학은 기본 rule에 항상 강제하는 대상이 아니라, 사용자가 선택하거나 프로젝트에 존재할 때 얹는 후속 철학 하네스 레이어다.

기본 철학이 없을 때는 하네스가 최소 질문으로 프로젝트 규모, 개인/팀 맥락, 백엔드 저장소 선택, 아키텍처 깊이를 파악하고, 그 답변을 바탕으로 계획을 제안한 뒤 구현으로 넘어가는 방향을 유지한다.

이 intake 질문들은 현재 rule 하드코딩 대상이 아니다.

## 강하게 가져갈 Backend Baseline 후보

- Java/Spring 프로젝트의 빌드 도구는 Gradle을 기본값으로 둔다.
- Maven 파일 생성은 현재 사용자 환경의 primary path가 아니므로 기본 생성에서 제외한다.
- Application Service는 `List`, `Map`, `AtomicLong`, `nextId`, `idCounter`, `sequence` 같은 저장소 상태나 id sequence를 직접 소유하지 않는다.
- Application Service는 비즈니스/use-case 흐름을 조율하고, 영속성 접근과 id 발급은 Repository 또는 명시적인 persistence boundary 뒤에 둔다.

## 제외할 원칙

- 개인 취향이 강한 네이밍 강제
- 특정 프로젝트에서만 맞는 레이어 구조
- 과도한 DDD 강제
- 과도한 추상화 강제
- 항상/절대 류의 극단적 규칙
- 프론트엔드 규칙
- 인프라 규칙
- AI 모델 라우팅 규칙
- profile-aware 규칙
- desktop app 규칙
- 아직 MVP에 필요 없는 운영 규칙
- H2, JdbcTemplate, JPA, MyBatis, schema.sql, Flyway, Liquibase 같은 특정 persistence 선택의 보편 강제
- roomescape, reservation, step1, step2-3 같은 fixture 전용 요구사항의 보편 규칙화
- RestAssured, MockMvc 같은 테스트 스타일의 현재 baseline 강제

## Rule 작성 기준

- 한 rule 파일은 하나의 책임만 다룬다.
- 문장은 짧고 실행 가능해야 한다.
- 모델에게 행동 기준을 주되 과도한 설계를 강제하지 않는다.
- API contract rule은 요구사항 필드명을 그대로 보존한다.
- Spring 역할별 rule은 Controller, Service, Repository, Entity, DTO, Test 책임선을 흐리지 않는다.
- fixture 요구사항에서 나온 구체 필드/endpoint/status를 일반 backend baseline으로 승격하지 않는다.
- 프로젝트 규모나 기술 선택에 따라 달라질 내용은 rule이 아니라 intake/plan 질문으로 분리한다.

## Rule 변경 기준

Rule을 바꿀 때는 다음을 같이 남긴다.

- 왜 바꿨는가
- 어떤 실험에서 문제가 보였는가
- 어떤 원칙을 가져왔는가
- 어떤 원칙을 제외했는가
- 다음 실험에서 무엇을 확인할 것인가

기준 문서는 Git에 남기고, 개별 실험의 판단 원문은 `experiments/phase0-runs/{timestamp}/rule-selection.md`에 남긴다.
