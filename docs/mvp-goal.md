# MVP Goal

## One Line

MVP는 Java/Spring Backend 작업에서 클린코드와 백엔드 기본 원칙을 결정적으로 주입하는 OpenCode 하네스다.

## MVP에서 하는 것

- Java/Spring 파일을 target file로 감지한다.
- 파일명을 기준으로 Controller, Service, Repository, Entity, DTO, Test 같은 file role을 판별한다.
- `.persona/rules`의 clean-code, backend/java, file-role, API-contract rule을 선택한다.
- 선택된 rule을 injection block으로 만들어 tool output 또는 다음 model input에 주입한다.
- Phase 0 실험을 `experiments/phase0-runs/{timestamp}/` 아래에 재현 가능하게 기록한다.
- 실험마다 goal, worklog, evidence, analysis, next action을 남긴다.

## MVP에서 하지 않는 것

- profile-aware rule routing
- frontend rule
- infra/deploy rule
- benchmark routing
- desktop app
- 복잡한 rule engine
- 대규모 자동 평가 대시보드
- Java/Spring 2단계 이후 요구사항

## 성공 기준

- `npm test`, `npm run typecheck`, `npm run build`가 통과한다.
- `npm run experiment:phase0:prepare`가 독립 실험 패키지를 생성한다.
- Java target file을 감지하면 file role이 결정된다.
- clean-code/backend/file-role/API-contract rule이 injection block에 들어간다.
- injection block이 tool output 또는 model input에 실제 반영된다.
- evidence에 target file, file role, selected rules, injection timing이 남는다.
- 실험 분석만 보고 다음 loop action을 도출할 수 있다.

## Phase 0 #1 Backend 종료 기준

Phase 0 #1단계 Spring backend MVP는 다음 조건을 모두 만족하면 종료한다.

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

## Persona Harness가 OMO와 다른 점

OMO는 OpenCode 워크플로우 안에서 범용 에이전트 경험을 확장하는 참고 대상이다.

Persona Harness는 범용 워크플로우를 목표로 하지 않는다. Java/Spring Backend 작업에서 clean-code/backend/file-role/API-contract 규칙을 결정적으로 주입하고, 그 결과를 loop 단위로 기록하고 분석하는 하네스다.

## Phase 0 핵심 가설

Java/Spring 파일을 읽거나 수정하는 순간, clean-code/backend/file-role/API-contract 규칙을 결정적으로 주입하면, 모델이 요구사항을 덜 누락하고 더 일관된 Spring 코드를 작성할 수 있다.
