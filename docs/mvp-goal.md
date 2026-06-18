# MVP Goal

## One Line

MVP는 Java/Spring Backend 작업에서 클린코드와 백엔드 기본 원칙을 결정적으로 주입하는 OpenCode 하네스다.

MVP의 목표는 완성도 높은 방탈출 예약 앱을 만드는 것이 아니다.

MVP의 목표는 다음 경로가 재현 가능하게 이어지는지 증명하는 것이다.

```text
targetFile -> injection block -> 실제 모델 입력 -> 모델 행동 변화 관찰
```

## MVP에서 하는 것

- Java/Spring 파일을 target file로 감지한다.
- 파일명을 기준으로 Controller, Service, Repository, Entity, DTO, Test 같은 file role을 판별한다.
- `.persona/rules`의 clean-code, backend/java, file-role, API-contract rule을 선택한다.
- 선택된 rule을 injection block으로 만들어 tool output 또는 다음 model input에 주입한다.
- Phase 0 실험을 `experiments/phase0-runs/{timestamp}/` 아래에 재현 가능하게 기록한다.
- 실험마다 goal, worklog, evidence, analysis, next action을 남긴다.
- 방탈출 예약 요구사항을 Java/Spring fixture 입력으로 사용해 난이도별 주입 효과를 관찰한다.

## MVP에서 하지 않는 것

- profile-aware rule routing
- frontend rule
- infra/deploy rule
- benchmark routing
- desktop app
- 복잡한 rule engine
- 대규모 자동 평가 대시보드
- Java/Spring 2단계 이후 요구사항의 product 구현 또는 품질 보증
- 방탈출 예약 앱의 product 완성도 검증
- Guard/AST/linter 기반 규칙 준수 강제

## 성공 기준

- `npm test`, `npm run typecheck`, `npm run build`가 통과한다.
- `npm run experiment:phase0:prepare`가 독립 실험 패키지를 생성한다.
- Java target file을 감지하면 file role이 결정된다.
- clean-code/backend/file-role/API-contract rule이 injection block에 들어간다.
- #2-3 이후 fixture에서는 API-contract rule이 해당 fixture 계약과 충돌하지 않아야 한다.
- #2-3 fixture에서는 Controller/Test/DTO live targetFile evidence에서 `backend/step2-3-api-contract.md`가 선택되고 `backend/step1-api-contract.md`가 섞이지 않아야 한다.
- injection block이 tool output 또는 model input에 실제 반영된다.
- evidence에 target file, file role, selected rules, injection timing이 남는다.
- 실험 분석만 보고 다음 loop action을 도출할 수 있다.

현재 상태: **Phase 0 MVP 종료**.

종료 결론: **#2-3 evidence 종료, Phase 0 MVP 종료**.

이 결론은 Phase 0의 좁은 MVP 정의에만 적용한다. Java/Spring Backend fixture에서 targetFile 감지, 역할 판별, scenario-aware API contract rule 선택, injection block 생성, model input/tool output 반영, model behavior 관찰이 반복 확인됐다는 뜻이다. 방탈출 예약 앱 product 품질 보증, Guard/AST/linter 검증, profile-aware/frontend/infra/desktop 확장 완료를 뜻하지 않는다.

## Phase 0 #1 Backend 종료 기준

Phase 0 #1단계 Spring backend fixture는 다음 조건을 모두 만족하면 종료한다.

이 종료는 예약 앱 product 완성을 뜻하지 않는다. #1 fixture에서 targetFile 감지, rule injection, evidence, 생성 코드 관찰 루프가 재현 가능해졌다는 뜻이다.

- 같은 기본 실행 명령으로 보강 후 반복 run 1-2회가 완주한다.
- 반복 run들이 `GET /reservations`, `POST /reservations`, `DELETE /reservations/1`의 `200 OK` 계약을 유지한다.
- POST 요청 body는 `name`, `date`, `time`이고, 생성 응답은 `id`, `name`, `date`, `time`이다.
- 첫 생성 id는 `1`이다.
- 생성 전 목록 크기 `0`, 생성 후 목록 크기 `1`, 삭제 후 목록 크기 `0`을 테스트가 고정한다.
- Controller는 HTTP 요청/응답과 Service 호출만 담당한다.
- Service는 생성/조회/삭제 유스케이스 흐름만 담당하고 저장 상태나 id sequence를 소유하지 않는다.
- Repository interface와 `InMemoryRepository` 구현체가 분리된다.
- in-memory Repository 구현체가 Map/List 저장소, id 발급, reset을 담당하고 Spring bean으로 등록된다.
- DTO는 API 외부 입출력 계약만 표현한다.
- detector 결과만 보지 않고 생성 Java/Spring 코드를 직접 확인한다.

현재 상태: **종료**.

근거 run:

- `experiments/phase0-runs/2026-06-17T11-04-54-321Z`
- `experiments/phase0-runs/2026-06-17T11-06-35-453Z`

남은 리스크:

- detector는 문자열 기반이라 정상 코드 false positive가 발생할 수 있다.
- 종료 판단은 Phase 0 #1단계 Java/Spring backend에 한정된다.
- 2단계 이후 요구사항, profile-aware routing, frontend, infra, benchmark routing, desktop app은 아직 닫힌 범위가 아니다.

## Phase 0 #2-3 Backend Evidence 상태

현재 상태: **종료**.

Phase 0 #2-3은 앱 구현 단계가 아니다. 더 복잡한 Spring 파일, H2/JdbcTemplate, DB schema, time 연결 상황에서도 파일 역할별 규칙 주입이 유지되는지 보는 fixture 시나리오다.

사용자 제공 원문을 기준으로 fixture API 계약과 테스트 관찰 기준을 정리했고, 별도 #2-3 runner로 prepare와 implementation run을 실행했다.

#2-3 fixture에서 정본으로 고정한 관찰 기준:

- HTTP method와 path
- 성공 status code
- request body와 response body 필드
- #1 API와 함께 실행될 때의 상태 변화
- id sequence, 삭제, 조회 결과에 대한 기대값
- Controller/Service/Repository 역할 분리 기준
- 요구사항의 status/body/list size 또는 상태 변화를 고정하는 테스트 기준

세부 기준은 [docs/phase0-step2-scope.md](phase0-step2-scope.md)에 둔다.

핵심 evidence:

- `experiments/phase0-runs/2026-06-18T00-16-01-731Z`: scenario-aware contract selection 후 Controller live evidence에서 `backend/step2-3-api-contract.md` 선택, `backend/step1-api-contract.md` 0건.
- `experiments/phase0-runs/2026-06-18T00-34-47-590Z`: Controller/Test/Request DTO/Response DTO live targetFile evidence 확보. 해당 역할 모두 `backend/step2-3-api-contract.md`를 선택했고 `backend/step1-api-contract.md` 혼입은 0건이었다.
- `experiments/phase0-runs/2026-06-18T01-02-20-056Z`: 같은 기본 명령 반복 run. Controller/Test/Request DTO/Response DTO live targetFile evidence가 재현됐고 `backend/step2-3-api-contract.md` 15건, `backend/step1-api-contract.md` 0건이었다.

한계:

- #2-3 live Controller/Test/DTO evidence는 prompt에서 구현 후 `glob`/`read`를 명시적으로 유도해 확보했다.
- 따라서 모델이 자연스럽게 항상 모든 역할 파일을 읽는다는 보장은 아니다.
- MVP 기준으로는 targetFile -> injection block -> model input/tool output -> model behavior 관찰에 충분하지만, 품질 게이트, Guard/AST/linter 검증, 완성 앱 품질 보증은 아니다.

## Phase 0 MVP Decision

결론: **#2-3 evidence 종료, Phase 0 MVP 종료**.

닫을 수 있는 이유:

- #1 fixture에서 기본 Spring Controller/Service/Repository/API contract 주입 경로가 확인됐다.
- #2-3 fixture에서 H2/JdbcTemplate/schema/time/Test/DTO가 섞인 더 복잡한 상황에서도 주입 경로가 반복 확인됐다.
- scenario-aware contract selection이 #1에서는 `backend/step1-api-contract.md`, #2-3에서는 `backend/step2-3-api-contract.md`를 선택했고, #2-3 반복 run에서 #1 contract 혼입은 0건이었다.
- evidence와 한계를 문서와 ignored experiment analysis에 기록했다.

닫으면 안 되는 정의:

- Phase 0 MVP를 앱 품질 보증으로 정의한다면 아직 부족하다.
- Phase 0 MVP를 Guard/AST/linter 기반 규칙 준수 강제로 정의한다면 아직 부족하다.
- Phase 0 MVP를 profile-aware, frontend, infra, OMO식 전체 확장까지 포함한다고 정의한다면 아직 부족하다.
- prompt read 유도 없이 모델이 자연스럽게 모든 역할 파일을 읽는 증거만 허용한다면 아직 부족하다.

## 실패 기준

- Java target file을 감지하지 못한다.
- file role이 틀리거나 누락된다.
- API contract rule이 Controller/DTO/Test 작업에서 빠진다.
- injection block이 모델 입력이나 tool output에 반영되지 않는다.
- evidence가 남지 않는다.
- 실험 기록 없이 코드를 수정한다.
- 실험 결과를 Git에 커밋한다.
- MVP 밖 기능을 구현한다.

## 1단계 웹 요청-응답 요구사항을 계속 재사용하는 이유

Phase 0의 목적은 다양한 요구사항 해결이 아니라 하네스 주입의 효과를 반복 검증하는 것이다.

동일한 `# 1단계: 웹 요청-응답` 요구사항을 반복해야 API 계약 누락, 역할 분리, 테스트 작성 안정성이 개선되는지 비교할 수 있다. 요구사항을 계속 바꾸면 모델 품질 변화와 하네스 개선 효과를 분리해서 판단하기 어렵다.

## Fixture 시나리오

방탈출 예약 #1/#2/#3 요구사항은 Persona Harness의 product가 아니다.

이 요구사항들은 복잡도가 다른 Java/Spring fixture 입력이다.

- #1 fixture: 단순 Controller/Service/Repository/API contract 주입 경로 확인
- #2-3 fixture: DB/JdbcTemplate/schema/time 연결이 들어와도 주입 경로와 역할별 정책이 유지되는지 확인
- 이후 fixture: 더 복잡한 Spring 상황에서 주입 경로가 흐려지는지 관찰

생성된 Spring 앱의 품질 평가는 후속 관찰로 의미가 있다. 하지만 MVP의 중심 목표는 품질 보증이 아니라 규칙 주입 경로의 결정성과 재현성이다.

Detector는 문자열 기반 보조 관찰 장치다. 품질 보증 게이트가 아니며, Phase 0에서는 Guard/AST/linter로 규칙 준수를 강제하지 않는다.

## Persona Harness가 OMO와 다른 점

OMO는 OpenCode 워크플로우 안에서 범용 에이전트 경험을 확장하는 참고 대상이다.

Persona Harness는 범용 워크플로우를 목표로 하지 않는다. Java/Spring Backend 작업에서 clean-code/backend/file-role/API-contract 규칙을 결정적으로 주입하고, 그 결과를 loop 단위로 기록하고 분석하는 하네스다.

## Phase 0 핵심 가설

Java/Spring 파일을 읽거나 수정하는 순간, clean-code/backend/file-role/API-contract 규칙을 결정적으로 주입하면, 모델이 요구사항을 덜 누락하고 더 일관된 Spring 코드를 작성할 수 있다.
