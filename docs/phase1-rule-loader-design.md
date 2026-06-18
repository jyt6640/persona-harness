# Phase 1.1 Rule Loader Design

## Goal

frontmatter/glob/scenario selection을 최소로 정교화해 hardcoded rule selection을 줄인다.

Phase 1.1의 목표는 rule-loader를 full rule engine으로 바꾸는 것이 아니다. Phase 0에서 확인한 Java/Spring Backend injection path를 유지하면서, `.persona/rules/**/*.md`의 frontmatter와 `globs`를 rule selection의 1차 입력으로 쓰도록 최소 설계를 확정한다.

## Non-Goals

- Guard/AST/linter 기반 검증을 구현하지 않는다.
- profile-aware backend/frontend/infra 확장을 구현하지 않는다.
- OMO workflow/skill 각색을 구현하지 않는다.
- full rule engine, conflict resolver, rule inheritance, deny/warn enforcement를 구현하지 않는다.
- Phase 0 MVP 종료 판단을 되돌리지 않는다.
- #1/#2-3 evidence 형식이나 injection block 형식을 바꾸지 않는다.

## Current Behavior

현재 rule-loader는 `src/phase0/rule-loader.ts`에서 rule path를 대부분 hardcoded로 선택한다.

공통으로 항상 선택되는 base rule:

- `clean-code/common.md`
- `clean-code/method-design.md`
- `backend/java-common.md`

현재 #1 기본 scenario는 `step1`이다. `.persona/harness.jsonc`가 없거나 `"scenario": "step2-3"`가 아니면 `step1`로 처리한다.

#1 `Controller` 선택:

- base rule 3개
- `backend/spring-controller.md`
- `backend/spring-dto.md`
- `backend/step1-api-contract.md`

#1 `Test` 선택:

- base rule 3개
- `clean-code/testability.md`
- `backend/spring-test.md`
- `backend/step1-api-contract.md`

#1 `Request`/`Response` DTO 선택:

- base rule 3개
- `backend/spring-dto.md`
- `backend/step1-api-contract.md`

#2-3 scenario는 `.persona/harness.jsonc`의 `"scenario": "step2-3"` marker로만 켜진다. 현재 `controller`, `test`, `request-dto`, `response-dto` role에 들어 있던 `backend/step1-api-contract.md`를 `backend/step2-3-api-contract.md`로 치환한다.

#2-3 `Controller` 선택:

- base rule 3개
- `backend/spring-controller.md`
- `backend/spring-dto.md`
- `backend/step2-3-api-contract.md`

#2-3 `Test` 선택:

- base rule 3개
- `clean-code/testability.md`
- `backend/spring-test.md`
- `backend/step2-3-api-contract.md`

#2-3 `Request`/`Response` DTO 선택:

- base rule 3개
- `backend/spring-dto.md`
- `backend/step2-3-api-contract.md`

`service`, `repository`, `entity`, `domain`, `exception`, `java-common` role은 contract rule replacement 대상이 아니다.

## Desired Behavior

Phase 1.1 구현 후에도 #1/#2-3의 observable behavior는 유지한다.

- Java/Spring 파일에는 clean-code/common, clean-code/method-design, backend/java-common baseline이 계속 적용된다.
- role-specific rule은 file-role과 rule frontmatter `globs`가 모두 맞을 때 선택된다.
- contract rule은 scenario와 target file role이 모두 맞을 때만 선택된다.
- #1에서는 `backend/step1-api-contract.md`만 contract rule로 선택된다.
- #2-3에서는 `backend/step2-3-api-contract.md`만 contract rule로 선택된다.
- `selectedRules` evidence는 지금처럼 rule path string 배열로 남긴다.
- injection block의 `선택 규칙:` 목록과 `적용 정책:` bullet format은 유지한다.

최소 목표는 hardcoded `ROLE_RULES`를 한 번에 제거하는 것이 아니라, rule markdown frontmatter를 읽어 candidate rule을 만들고 기존 role/scenario behavior와 같은 결과를 내는 것이다.

## Frontmatter Fields

Phase 1.1에서 읽는 필드:

- `id`: rule의 안정 식별자. 없으면 path를 fallback id로 본다.
- `source`: `clean-code` 또는 `backend-policy` 같은 rule 출처. Phase 1.1 selection에는 쓰지 않고 metadata evidence로 보존한다.
- `domain`: `common` 또는 `backend` 같은 rule domain. Phase 1.1 selection에는 쓰지 않고 metadata evidence로 보존한다.
- `topic`: rule grouping key. Phase 1.1 selection에는 쓰지 않고 metadata evidence로 보존한다.
- `globs`: target file path와 매칭할 glob 배열. Phase 1.1 selection의 핵심 입력이다.
- `scenario`: contract rule에만 쓰는 선택 marker. 허용값은 `step1`, `step2-3`, `all`이다. 없으면 `all`로 본다.
- `severity`: `must`, `should`, `prefer` 중 하나. Phase 1.1 selection에는 쓰지 않고 metadata evidence로 보존한다.
- `max_bullets`: injection에 포함할 bullet 최대 수. 없으면 기존 기본값을 따른다.
- `enforcement`: Phase 1.1에서는 `inject_only`만 활성 값으로 읽는다. 다른 값은 읽어도 실행 의미를 부여하지 않는다.

Phase 1.1에서 읽지 않는 필드:

- `description`, `applies_to`, `priority`는 현재 rule 정본에 없으므로 Phase 1.1 runtime metadata model에서 제거한다.
- `conflictsWith`, `extends`, `profile`, `owner`, `warn`, `deny`, `guard`, `linter`, `ast` 계열 필드는 구현하지 않는다.
- nested object frontmatter는 지원하지 않는다.

Frontmatter parsing scope:

- Markdown 맨 앞의 `---` block만 frontmatter로 본다.
- scalar string, number, string array만 허용한다.
- parsing 실패 시 다음 loop 구현에서는 해당 rule을 선택하지 않고 diagnostics를 남기는 방향을 우선 검토한다. 단, base rule 누락으로 기존 #1/#2-3 behavior가 깨지지 않도록 compatibility test를 먼저 둔다.

## Glob Matching Scope

Path normalization:

- target file path는 `/` separator 기준으로 정규화한다.
- repo/workspace absolute path와 relative path가 모두 들어올 수 있으므로, matching 전에는 project root 기준 relative path를 우선 계산한다.
- relative 계산이 불가능하면 normalized full path에 glob을 적용한다.

Java/Spring baseline:

- `**/*.java`는 모든 Java/Spring target file에 매칭한다.
- 이 매칭으로 `clean-code/common.md`, `clean-code/method-design.md`, `backend/java-common.md`가 계속 적용되어야 한다.

Test file:

- `**/*Test.java`는 `test` role로 매칭한다.
- test role은 `clean-code/testability.md`, `backend/spring-test.md`, 그리고 현재 scenario의 contract rule을 받을 수 있다.

DTO file:

- `**/*Request.java`는 `request-dto` role로 매칭한다.
- `**/*Response.java`는 `response-dto` role로 매칭한다.
- DTO role은 `backend/spring-dto.md`와 현재 scenario의 contract rule을 받을 수 있다.

Repository/Service/Controller file:

- `**/*Repository.java`는 `repository` role로 매칭한다.
- `**/*Service.java`는 `service` role로 매칭한다.
- `**/*Controller.java`는 `controller` role로 매칭한다.
- Controller는 `backend/spring-controller.md`, `backend/spring-dto.md`, 현재 scenario의 contract rule을 받을 수 있다.

Entity/domain/exception/common file:

- `**/*Entity.java`와 `**/domain/**/*.java`는 entity/domain 관련 rule을 받을 수 있다.
- `**/*Exception.java`는 validation/exception rule을 받을 수 있다.
- 위 역할에 속하지 않는 `**/*.java`는 `java-common` role로 보며 base rule만 안정적으로 유지한다.

## Scenario Selection

Scenario source는 Phase 0과 동일하게 `.persona/harness.jsonc`의 `"scenario"` field다.

- missing harness file: `step1`
- unknown scenario value: `step1`
- `"scenario": "step1"`: step1 contract
- `"scenario": "step2-3"`: step2-3 contract

Contract rule eligibility:

- `scenario: step1` rule은 active scenario가 `step1`일 때만 선택한다.
- `scenario: step2-3` rule은 active scenario가 `step2-3`일 때만 선택한다.
- `scenario: all` 또는 missing scenario rule은 scenario로 거르지 않는다.
- contract rule은 `controller`, `test`, `request-dto`, `response-dto`에만 적용한다.

Compatibility target:

- #1 Controller/Test/DTO는 `backend/step1-api-contract.md`를 받고 `backend/step2-3-api-contract.md`를 받지 않는다.
- #2-3 Controller/Test/DTO는 `backend/step2-3-api-contract.md`를 받고 `backend/step1-api-contract.md`를 받지 않는다.

## Compatibility Tests

다음 기준은 Phase 1.1 구현 loop에서 깨지면 안 된다.

- #1 Controller/Test는 `backend/step1-api-contract.md`를 받는다.
- #1 Controller/Test는 `backend/step2-3-api-contract.md`를 받지 않는다.
- #2-3 Controller/Test/DTO는 `backend/step2-3-api-contract.md`를 받는다.
- #2-3 Controller/Test/DTO는 `backend/step1-api-contract.md`를 받지 않는다.
- clean-code/java-common/base backend rule은 모든 Java/Spring 파일에 계속 적용된다.
- existing injection block format은 유지된다.
- evidence selectedRules 기록 형식은 유지된다.

추가로 권장하는 test cases:

- `ReservationController.java`는 controller role, `backend/spring-controller.md`, `backend/spring-dto.md`, scenario contract를 받는다.
- `ReservationService.java`는 service role, `backend/spring-service.md`, `backend/validation-exception.md`를 받지만 contract rule은 받지 않는다.
- `ReservationRepository.java`는 repository role, `backend/spring-repository.md`를 받지만 contract rule은 받지 않는다.
- `ReservationRequest.java`와 `ReservationResponse.java`는 DTO role, `backend/spring-dto.md`, scenario contract를 받는다.
- `ReservationTest.java`는 test role, `clean-code/testability.md`, `backend/spring-test.md`, scenario contract를 받는다.
- `Reservation.java`처럼 suffix가 없는 Java file은 base rule을 유지하고 contract rule은 받지 않는다.

## Implementation Plan

다음 loop의 최소 구현 순서:

1. 현재 `selectRulePaths` behavior를 lock하는 failing-first compatibility tests를 추가한다.
2. `.persona/rules/**/*.md`를 읽는 작은 rule catalog loader를 만든다.
3. frontmatter parser는 Phase 1.1 필드만 scalar/string-array로 파싱한다.
4. target path와 rule `globs`를 project-relative path 기준으로 매칭한다.
5. contract rule에는 `scenario` filter를 적용해 #1/#2-3 mixing을 막는다.
6. 기존 hardcoded role order와 selectedRules path shape를 유지한다.
7. `source`, `domain`, `topic`, `severity`는 selectedRuleMetadata evidence로 보존한다.
8. `max_bullets` 또는 기존 limit으로 policies를 추출한다.
9. injection block과 `selectedRules` evidence format이 바뀌지 않았는지 테스트한다.

Scope guard:

- 기존 `createInjectionBlock` public return shape는 바꾸지 않는다.
- `.persona/evidence`의 `selectedRules` path string 배열은 유지하고, metadata는 별도 필드로 추가한다.
- Guard/AST/linter/profile/frontend/infra/workflow 관련 코드는 추가하지 않는다.

## Risks

- frontmatter 파싱 실패로 base rule이 빠질 수 있다.
- glob 과매칭으로 step1/step2-3 contract가 섞일 수 있다.
- glob 미매칭으로 Controller/Test/DTO가 contract rule을 잃을 수 있다.
- scenario marker 누락 시 #2-3이 step1 fallback으로 회귀할 수 있다.
- 기존 #1 regression이 생길 수 있다.
- `globs`만으로 role을 추론하면 Controller와 DTO처럼 한 rule이 여러 role에 걸치는 경우가 모호해질 수 있다.
- absolute path와 project-relative path가 섞이면 test에서는 통과하고 live hook에서는 빠질 수 있다.

## Verification

다음 loop 구현 후 실행할 명령:

- `npm test`
- `npm run typecheck`
- `npm run build`

확인할 evidence:

- #1 Controller/Test evidence의 `selectedRules`에 `backend/step1-api-contract.md`가 있고 `backend/step2-3-api-contract.md`가 없다.
- #2-3 Controller/Test/DTO evidence의 `selectedRules`에 `backend/step2-3-api-contract.md`가 있고 `backend/step1-api-contract.md`가 없다.
- 모든 Java/Spring target evidence의 `selectedRules`에 base rule이 유지된다.
- injection block의 `[Persona Harness Injection]`, `선택 규칙:`, `적용 정책:` 섹션 형식이 유지된다.
- `.persona/evidence` metadata-only 기록의 `selectedRules` path string 배열 형식이 유지된다.

## Phase 1.1 Decision

Decision: **Phase 1.1 종료**.

This decision closes the minimal catalog-based rule selection refinement described in this document. It does not close full rule-engine work.

Implemented scope:

- `.persona/rules/**/*.md` catalog loading.
- Minimal frontmatter parsing for `id`, `source`, `domain`, `topic`, `globs`, `scenario`, `severity`, `max_bullets`, and `enforcement`.
- Frontmatter parsing split into `src/phase0/rule-frontmatter.ts`.
- Minimal glob matching split into `src/phase0/rule-glob.ts`.
- Scenario-aware contract eligibility for `step1` and `step2-3`.
- Existing hardcoded fallback/order retained as a safety net.
- Existing injection block format retained.
- Existing evidence `selectedRules` rule path string array retained, with `selectedRuleMetadata` added for path/id/source/domain/topic/severity.

Test/evidence closure:

- #1 Controller/Test contract selection remains `backend/step1-api-contract.md` only.
- #2-3 Controller/Test/DTO contract selection remains `backend/step2-3-api-contract.md` only.
- Base rules `clean-code/common.md`, `clean-code/method-design.md`, and `backend/java-common.md` remain selected for Java/Spring roles.
- Catalog tests cover scenario frontmatter, `max_bullets`, glob match/mismatch, missing/empty `.persona/rules` fallback, malformed frontmatter, and split scenario/frontmatter/glob/fallback concerns.
- #2-3 live run `experiments/phase0-runs/2026-06-18T02-10-18-110Z` captured Controller/Test/DTO targetFile evidence.
- That live run left injection blocks in tool output/model input.
- Catalog selection and evidence `selectedRules` matched with 0 mismatches.
- `backend/step1-api-contract.md` did not mix into the #2-3 live run.

Non-closure:

- #1 prepare remains a static selection check, not runtime hook-path proof.
- #2-3 runtime evidence is one live implementation run.
- Natural file discovery without prompt read guidance remains unproven.
- Generated Spring app quality is not certified.
- `./gradlew test` wrapper absence and the intermediate H2 SQL syntax failure during `gradle test` are product-quality observations, not injection evidence failures.
- Guard/AST/linter, profile-aware routing, frontend/infra expansion, OMO workflow adaptation, and a full rule engine remain out of scope.
