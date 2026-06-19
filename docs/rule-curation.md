# Rule Curation

Date: 2026-06-17

## Source

`references/diff-rules`의 과거 철학 문서를 검토했다.

원문은 개인 분석 자료라 Git에 커밋하지 않는다. 이 문서는 Persona Harness의 기본 rule baseline으로 승격한 판단만 추적한다.

## 가져간 원칙

- 명확성이 짧음보다 우선이다.
- 한 메서드와 한 타입은 읽는 사람이 예측할 수 있는 중심 책임을 가져야 한다.
- 흐름을 진행하는 코드와 판단을 내리는 코드를 구분한다.
- 이름은 구현 방식이 아니라 도메인 의도와 유스케이스를 드러낸다.
- 추상화는 실제 반복 비용이나 책임 혼재가 보일 때 도입한다.
- `Util`, `Helper`, `Manager`, generic base class는 기본 선택으로 쓰지 않는다.
- 객체는 자신의 상태와 규칙을 스스로 지키고, 상태 변경은 의미 있는 행위로 표현한다.
- 테스트는 public behavior를 검증하고 구현 순서에 과하게 결합하지 않는다.
- Presentation, Application, Domain, Infrastructure의 책임을 구분한다.
- Domain은 Spring, HTTP, DB 세부사항을 알지 않는다.
- Service는 유스케이스 흐름과 트랜잭션 경계를 조율하고, 정책 판단은 이름 있는 책임으로 분리한다.
- Repository는 저장소 접근을 담당하고 비즈니스 판단을 query나 map 조작 안에 숨기지 않는다.
- Request/Response DTO는 외부 계약을 표현하고 Entity를 API 응답으로 직접 노출하지 않는다.
- 검증 책임은 규칙을 가장 잘 아는 계층에 둔다.

## 완화해서 가져간 원칙

- 도메인 중심 패키지 구조는 좋은 기본 방향이지만, 작은 1단계 실험에서는 과한 패키지 분리를 강제하지 않는다.
- Request DTO와 Command/Query 분리는 Service 입력이 HTTP 계약과 달라질 때 적용한다.
- Repository interface 위치는 프로젝트 규모와 의존 방향이 분명해질 때 결정한다.
- 정적 팩토리 메서드는 도메인 생성 의도가 복잡할 때 권장하고, 모든 생성에 강제하지 않는다.
- ErrorCode 체계는 API 규모와 일관된 오류 응답 요구가 충분할 때 도입한다.
- Fake 우선 테스트 전략은 기본 방향으로 두되, 상호작용 자체가 요구사항인 경우 Mock 사용을 허용한다.
- 개인/팀/프로젝트 철학은 기본 baseline과 분리한다. 철학 파일이 있을 때 선택적으로 얹고, 없을 때는 Clean Code와 backend 역할 책임을 기본값으로 둔다.
- DB, migration, persistence framework 선택은 사용자 요구사항과 프로젝트 규모에 따라 intake/plan에서 결정한다.
- 테스트 스타일은 product code baseline과 분리해 후속 테스트 정책으로 다룬다.

## 보류한 원칙

- 식별자 영어, 주석 한국어 같은 언어 정책은 팀 컨벤션 영역이라 baseline에서 제외했다.
- Fake 클래스의 정확한 패키지 위치는 프로젝트 구조 취향이 강해 제외했다.
- generic response wrapper 금지는 API 스타일 결정에 가깝기 때문에 절대 규칙으로 넣지 않았다.
- 모든 Entity equals/hashCode를 id 기준으로 강제하는 규칙은 영속성 모델과 생명주기에 따라 달라져 완화했다.
- 특정 예외 클래스 계층, 특정 ErrorCode enum 형식은 프로젝트별 구현 정책이라 제외했다.
- OMO 방식의 워크플로우 규칙은 참고 대상으로만 두고, Persona Harness의 Phase 0 baseline에는 넣지 않았다.
- H2/JdbcTemplate/schema.sql/Flyway/Liquibase 같은 persistence 세부 선택은 baseline rule이 아니라 사용자 선택 또는 프로젝트 요구사항으로 보류한다.
- RestAssured/MockMvc/DEFINED_PORT/DirtiesContext 같은 테스트 도구와 스타일은 후속 테스트 하네스 섹션으로 보류한다.
- roomescape, reservation, step1/step2-3 요구사항은 fixture와 예시 정답의 맥락으로만 유지하고 보편 baseline으로 승격하지 않는다.
- OMO `shared-skills`의 `programming` skill은 `packages/shared-skills`에 vendoring하되, 현재 Java/Spring backend baseline rule로 직접 이식하지 않는다.

## 반영 위치

- `.persona/rules/clean-code/*`
- `.persona/rules/backend/*`
- `src/phase0/injection.ts`

Phase 0은 아직 full rule-loader가 아니므로 런타임 주입은 curated catalog를 사용한다. 새 규칙을 추가할 때는 `.persona/rules` 정본과 `src/phase0/injection.ts`의 임시 카탈로그가 같은 방향을 유지하는지 확인한다.
