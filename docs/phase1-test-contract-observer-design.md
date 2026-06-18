# Test Contract Anchor Observer Design

## Goal

생성 테스트가 요구사항 anchor를 텍스트상 포함하는지 report-only로 관찰한다.

이 설계의 목적은 Test contract drift를 직접 판정하는 것이 아니라, 요구사항 문서에서 중요하게 드러난 route, status, request body, response body, row/list count anchor가 generated test file 안에서 발견되는지 기록하는 것이다.

## Framing

이 observer는 테스트 품질을 판정하지 않는다.

이 observer는 product-quality gate가 아니다.

이 observer는 requirements anchor presence만 관찰한다.

`WARN`은 "테스트가 부족하다"는 판정이 아니다. 관찰 대상 test file에서 중요한 anchor group의 텍스트 evidence가 발견되지 않았다는 report-only 신호이며, 다음 rule/prompt 검토 후보를 만들기 위한 입력으로만 사용한다.

## Scope

- 대상은 Java/Spring generated test files다.
- 기본 대상 파일명은 `*Test.java`, `*Tests.java`, `*IntegrationTest.java`다.
- 관찰 scenario는 Phase 0 Step `#1`과 Step `#2-3`으로 제한한다.
- observer는 문자열 기반으로만 설계한다.
- observer는 ignored output에만 report를 쓴다.
- observer 결과는 enforcement gate, build/test failure, product-quality 보증으로 연결하지 않는다.
- 새 dependency, AST parser, linter, full Guard를 도입하지 않는다.

## Anchors

### #1 anchors

1단계 웹 요청-응답 scenario의 anchor group:

- `GET /reservations`
- `POST /reservations`
- `DELETE /reservations/{id}` 또는 `DELETE /reservations/1`
- `200 OK`
- `id = 1`
- list size `0/1/0` 또는 equivalent empty/create/delete assertions
- request body `name`/`date`/`time`

허용 evidence 예:

- route string: `"/reservations"`, `"/reservations/1"`
- status assertion: `status().isOk()`, `HttpStatus.OK`, `200`
- body assertion: `jsonPath("$.id").value(1)`, `contains("\"id\":1")`
- list assertion: `hasSize(0)`, `hasSize(1)`, `size()).isEqualTo(0)`, empty/create/delete flow를 드러내는 equivalent assertion
- request body literal or builder field: `name`, `date`, `time`

### #2-3 anchors

2-3단계 DB 전환 및 시간 관리 scenario의 anchor group:

- `GET /reservations`
- `POST /reservations`
- `DELETE /reservations/{id}` 또는 `DELETE /reservations/1`
- `POST /times`
- `GET /times`
- `DELETE /times/{id}` 또는 `DELETE /times/1`
- `200 OK`
- request body `name`/`date`/`timeId`
- request body `startAt`
- reservation response `time` object 또는 `id`/`startAt`
- reservation row count `1/0`
- `reservation_time` table 또는 time list size `1`

허용 evidence 예:

- route string: `"/reservations"`, `"/reservations/1"`, `"/times"`, `"/times/1"`
- status assertion: `status().isOk()`, `HttpStatus.OK`, `200`
- reservation request body fields: `name`, `date`, `timeId`
- time request body field: `startAt`
- nested response assertion: `jsonPath("$.time.id")`, `jsonPath("$[0].time.startAt")`, `time.id`, `time.startAt`
- DB/table anchor: `reservation_time`, `time_id`, `SELECT COUNT(*) FROM reservation`, `row count`
- list anchor: `hasSize(1)` or equivalent time list count assertion

## Finding Model

- `PASS`: required anchor groups are present enough for the scenario. This means text evidence exists for the planned anchor groups, not that the test suite is sufficient.
- `INFO`: some low-confidence anchors are present, or only partial/weak evidence is visible.
- `WARN`: important anchor groups are absent from the observed test file. This is a report-only missing-anchor signal, not a test-quality verdict.
- `UNKNOWN`: the target is not a Java/Spring test file, the scenario cannot be determined, or the file cannot be interpreted with this string-only design.

## Confidence Model

- `HIGH`: explicit route, status, body, table, or assertion string is found in the observed test file.
- `MEDIUM`: an equivalent assertion or helper pattern is found without the exact anchor string.
- `LOW`: only weak keyword evidence is found, such as a test name, helper name, constant name, or broad domain keyword.

Confidence is attached to the evidence strength, not to product behavior.

## Non-Goals

- test sufficiency 판정 아님.
- assertion correctness 증명 아님.
- product-quality 보증 아님.
- build/test failure와 연결하지 않음.
- enforcement gate 아님.
- AST/linter/full Guard 아님.
- rule/prompt/code 보강 아님.
- 새 dependency 없음.
- profile-aware backend/frontend/infra 확장 아님.
- OMO workflow/skill 각색 아님.

## False Positive / False Negative Risks

- 문자열 기반 observer는 comments, disabled tests, test names, dead helper code를 실제 assertion evidence로 오인할 수 있다.
- helper method, parameterized tests, constants, custom DSL, RestAssured/MockMvc/WebTestClient variation은 exact string을 숨길 수 있다.
- Korean test names may contain requirement meaning without route/status/body literal strings.
- `status().isOk()`가 하나의 route에만 붙어 있어도, 단순 문자열 관찰은 route별 status coverage를 과장할 수 있다.
- `hasSize(1)` 같은 count assertion은 reservation list인지 time list인지 문맥이 약하면 낮은 confidence로 기록해야 한다.
- `id`, `time`, `date` 같은 일반 단어는 domain model field나 unrelated fixture에서도 등장할 수 있다.
- table name이나 SQL string이 repository helper에 숨겨져 있으면 test file 단독 관찰에서는 missing으로 보일 수 있다.
- 이 observer는 generated code behavior, DB state correctness, HTTP contract correctness를 증명하지 않는다.

## Report Format

기존 report-only 형식을 재사용한다.

필드:

- `Target`
- `Scenario`
- `Finding`
- `Confidence`
- `Present Anchors`
- `Missing Anchors`
- `Evidence`
- `Limitations`
- `Decision`

`Decision`에는 rule/prompt 보강 여부를 직접 결정하지 않는다. `WARN/HIGH` 또는 `WARN/MEDIUM`이 actual generated run에서 반복될 때, 다음 loop의 검토 후보로만 기록한다.

## Output Location

ignored output:

- `experiments/phase0-runs/{timestamp}/test-contract-observer-report.md`
- 또는 `.persona/evidence/phase-next/test-contract-observer-report.md`

report output은 Git에 추적하지 않는다.

## Test Criteria For Implementation

다음 구현 loop에서 먼저 고정할 테스트 기준:

- `#1` test가 `GET`/`POST`/`DELETE`/`200`/`id`/list size/`name`-`date`-`time` anchors를 포함하면 `PASS/HIGH`.
- `#1` test가 `POST` 또는 `DELETE` status anchor를 빠뜨리면 `WARN/HIGH` 또는 `WARN/MEDIUM`.
- `#2-3` test가 `/times`와 `timeId`/`startAt` anchors를 포함하면 `PASS/HIGH`.
- `#2-3` test가 `timeId` 또는 `/times` anchors를 빠뜨리면 `WARN`.
- helper method나 constants를 쓰면 `MEDIUM` 또는 `LOW`로 낮춘다.
- 테스트 파일이 아니면 `UNKNOWN`.

## Next Loop

최소 observer 구현과 단위 테스트.

구현 loop에서도 observer는 report-only로 유지하고, ignored output에만 report를 쓴다. rule/prompt 보강은 actual generated run에서 반복 evidence를 확인한 뒤 별도 loop에서 판단한다.
