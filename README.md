# Persona Harness

Persona Harness는 OpenCode에서 동작하는 TypeScript 플러그인 MVP다.

현재 productized MVP는 **Java/Spring backend Clean Code injection**이다. 목표는 같은 요구사항에서 Gradle 기반, 계층 분리, DTO boundary, Repository boundary, Service orchestration-only backend product code shape가 더 균일하게 나오도록 Java target file에 rule context를 주입하는 것이다.

frontend, infra, multi-domain shared skill은 후속 확장 후보이며 현재 release-facing MVP 범위가 아니다.

## 5분 Clean Project Flow

public npm publish 전까지는 local path 또는 tarball install로 검증한다.

```bash
cd /path/to/clean-java-spring-project
npm install -D /absolute/path/to/persona-harness
npx ph init
npx ph intake
npx ph plan
```

`npx ph init`은 다음 파일을 만든다.

- `.persona/harness.jsonc`
- `.persona/rules/`
- `.opencode/opencode.json`

`npx ph intake`는 선택 단계다. 구현 전에 프로젝트 규모, 저장소 선택, package style, DTO strictness, optional philosophy overlay를 정리할 `.persona/project-profile.jsonc` draft를 만든다. 현재는 planning surface이며 rule enforcement나 generated app product-quality 보증이 아니다.

`npx ph plan`은 `blackbear` planning role의 최소 산출물인 `.persona/workflow/plan.md` draft를 만든다. README와 채워진 backend profile summary를 구현 전 architecture/technology plan의 입력으로 고정한다. 아직 autonomous agent workflow는 아니다.

OpenCode에서 Java/Spring target file을 먼저 읽게 실행한다.

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "먼저 src/main/java/.../...Controller.java 파일을 읽고, README.md 요구사항에 맞게 Gradle 기반 Spring 백엔드로 구현해줘."
```

repo 상태 확인, build/test 확인, 큰 출력 확인이 필요하면 Persona Harness command surface를 쓴다.

```bash
npx ph bearshell --shell 'gradle test'
npx ph bearshell --shell 'gradle build'
```

실행 뒤에는 evidence를 확인한다.

```bash
find .persona/evidence -type f | sort
```

주의:

- `npx ph ...`는 local/tarball dev dependency install에서 가장 안정적인 실행 형태다.
- `ph bearshell`은 Persona Harness command surface이고, clean OpenCode smoke에서 모델이 `npx ph bearshell`을 실제로 사용했다.
- Java file이 아직 없는 0-start 프로젝트는 `README.md` 또는 `requirements.md`를 먼저 읽게 실행할 수 있지만, 가장 직접적인 injection 검증은 Java/Spring target file read다.
- 이 흐름은 generated Spring app product quality나 rule enforcement를 보증하지 않는다.

## v0.2.1 Local Readiness

`v0.2.1`은 public npm publish 전 단계다. 지금 보장하는 설치 경로는 local path install과 tarball install이며, npm registry에서 `npm install -D persona-harness`로 설치하는 흐름은 아직 지원 대상으로 쓰지 않는다.

자세한 판단과 실제 검증 결과는 [docs/current/v0.2.1-release-readiness.md](docs/current/v0.2.1-release-readiness.md), [docs/current/v0.2.1-support-contract.md](docs/current/v0.2.1-support-contract.md), [docs/current/v0.2.1-package-metadata-audit.md](docs/current/v0.2.1-package-metadata-audit.md), [docs/current/clean-opencode-ph-bearshell-smoke.md](docs/current/clean-opencode-ph-bearshell-smoke.md), [docs/current/vendored-shared-skills-tarball-policy.md](docs/current/vendored-shared-skills-tarball-policy.md)를 본다.

### A. Persona Harness Repo 자체 검증

저장소를 받은 뒤 release readiness 기준으로 확인할 명령은 다음이다.

```bash
npm install
npm test
npm run typecheck
npm run build
npm run report:rules
npm run check:scope:strict
npm run check:injection-value
npm pack --dry-run
```

가장 짧은 local smoke/demo command는 다음이다.

```bash
npm install
npm run demo:init
npm run demo:bootstrap
npm run demo:java-mvp
```

`npm run demo:init`은 package artifact를 임시 clean project에 설치하고 `persona-harness init`을 실행해 `.persona/rules`, `.persona/harness.jsonc`, `.opencode/opencode.json`이 안전하게 만들어지는지 확인한다. 이때 `.persona/evidence`가 생기면 실패한다.

`npm run demo:bootstrap`은 init 이후 `README.md` target으로 설치된 plugin hook을 직접 호출해 `project-bootstrap` injection과 runtime evidence 생성을 확인한다.

`npm run demo:java-mvp`는 package artifact가 실제 설치 환경에서도 plugin hook, injection, model input transform, evidence 생성 경로를 재현하는지 확인한다. 내부적으로 빌드, `npm pack`, 임시 프로젝트 설치, `persona-harness init`, 설치된 `dist/index.js` OpenCode plugin hook 실행, Java Controller injection, model input transform, `.persona/evidence/phase0` evidence 생성을 검증한다.

### B. Clean Java/Spring Project Local Install

repo 밖의 clean Java/Spring 프로젝트에서는 local path install로 검증한다.

```bash
npm install -D /absolute/path/to/persona-harness
npx ph init
npx ph intake
npx ph plan
npx ph bearshell npm test
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "<Java/Spring target file을 먼저 읽고 기능을 구현해줘>"
```

`persona-harness init`은 대상 프로젝트에 `.persona/harness.jsonc`, `.persona/rules/`, `.opencode/opencode.json`을 설치/병합한다. `.persona/evidence/`는 template로 복사하지 않으며, OpenCode hook이 실제로 발동할 때 대상 프로젝트 안에 생성된다.

`ph intake`는 `v0.3.0` project-intake / philosophy workflow의 최소 CLI 표면이다. `.persona/project-profile.jsonc`를 만들고, 사용자가 답을 채운 뒤 agent가 구현 전 architecture/technology plan을 제안하도록 하는 데 쓴다. 자세한 범위는 [docs/current/v0.3.0-project-intake-philosophy-workflow.md](docs/current/v0.3.0-project-intake-philosophy-workflow.md)를 본다.

`ph plan`은 `blackbear` planning artifact인 `.persona/workflow/plan.md`를 만든다. README 상태와 backend profile summary를 계획 파일에 남기며, 구현은 이 계획이 검토되거나 수락된 뒤 시작한다. 자세한 범위는 [docs/current/v0.3.0-blackbear-plan-artifact.md](docs/current/v0.3.0-blackbear-plan-artifact.md)를 본다.

`ph bearshell`은 OMO `sparkshell`을 참고한 Persona Harness CLI helper다. repo inspection, CLI smoke test, 큰 출력이 나오는 명령을 bounded output으로 실행할 때 쓴다. 자세한 범위와 OMO parity gap은 [docs/current/ph-bearshell-mvp.md](docs/current/ph-bearshell-mvp.md)에 둔다.

```bash
npx ph bearshell npm test
npx ph bearshell --shell 'git status --short && npm test'
npx ph bearshell --budget 1200 --shell 'npm pack --dry-run'
```

현재 MVP는 deterministic head/tail condensation, `--shell` opt-in, `--json`, `--budget`, `PH_BEARSHELL_CONDENSE=0`만 보장한다. OMO의 native sidecar, app-server socket, tmux pane, session-context ranking, spark-model summarization은 아직 포함하지 않는다.

Persona Harness injection block은 repo inspection, CLI smoke test, 큰 출력 확인에서 `ph bearshell`을 우선 사용하라는 awareness도 함께 넣는다.

Java file이 아직 없는 0-start 상황에서는 먼저 `README.md` 또는 `requirements.md`를 읽도록 실행할 수 있다. 이 경우 `project-bootstrap` guidance가 들어가고, 이후 생성된 Java target file을 읽을 때 Controller/Service/Repository/DTO 역할별 injection이 잡힌다.

```bash
opencode run --dir . --model <model> \
  "README.md를 끝까지 읽고, 요구사항 전체를 Gradle 기반 Spring 백엔드로 구현해줘."
```

이미 Java/Spring target file이 있다면 해당 파일을 먼저 읽게 하는 편이 현재 MVP의 가장 직접적인 검증 경로다.

```bash
opencode run --dir . --model <model> \
  "먼저 src/main/java/.../presentation/...Controller.java 파일을 읽고, README.md 요구사항에 맞게 구현해줘."
```

권한 프롬프트를 생략해야 하는 환경에서는 OpenCode 버전에 맞게 `--dangerously-skip-permissions`를 붙인다. 이 repo의 v0.2.1 readiness 검증은 로컬 OpenCode 설정에서 해당 flag 없이 수행했다.

### C. Tarball Install Verification

public publish 전에 npm tarball 기준으로도 설치를 검증한다.

```bash
npm pack
mkdir -p /tmp/persona-harness-clean-check
cd /tmp/persona-harness-clean-check
npm init -y
npm install -D /absolute/path/to/persona-harness-*.tgz
npx ph init
```

### D. Manual Plugin Connection

`persona-harness init`을 쓰지 않고 직접 연결할 때는 빌드된 플러그인을 `.opencode/opencode.json`에 등록한다.

```jsonc
{
  "plugin": [
    "/absolute/path/to/persona-harness/dist/index.js"
  ]
}
```

그 프로젝트에서 OpenCode가 `src/main/java/**/*.java` target file을 읽거나 수정하면 Persona Harness가 파일 역할을 판정하고, 해당 Java/Spring Clean Code rules를 tool output과 다음 model input에 주입한다. evidence는 해당 프로젝트의 `.persona/evidence/phase0` 아래에 남는다.

Java file이 아직 없는 0-start 상황에서는 `README.md`, `requirements.md`, `build.gradle`, `settings.gradle` target에 한해 Java backend bootstrap guidance를 주입한다. 일반 markdown 문서, `docs/` 내부 문서, `CHANGELOG.md`, 임의 note 파일에는 bootstrap injection을 걸지 않는다.

추가 설치/검증 경로는 [docs/current/java-backend-mvp-install-guide.md](docs/current/java-backend-mvp-install-guide.md)를 본다.

이 MVP는 생성된 Spring application의 품질, 테스트 충분성, rule enforcement, Guard/AST/linter 검증, frontend/infra/desktop productization을 보증하지 않는다.

Phase 0의 목표는 하나다.

```text
targetFile -> injection block -> 실제 모델 입력
```

아직 완전한 rule engine을 구현하지 않는다. 먼저 Java/Spring 파일을 읽거나 수정하려는 순간 파일 역할을 결정적으로 잡고, 그 파일에 맞는 클린코드/백엔드 원칙이 모델 컨텍스트에 들어가는지 증명한다.

방탈출 예약 앱은 Persona Harness의 product가 아니다. 예약 요구사항은 Java/Spring fixture 입력이며, 난이도를 올려가며 `targetFile -> injection block -> 실제 모델 입력 -> 모델 행동 변화 관찰` 경로가 재현되는지 보기 위한 실험 재료다.

## 현재 범위

현재 기본 runner는 `# 1단계: 웹 요청-응답` Java/Spring fixture를 대상으로 한다. #2-3은 별도 runner로 분리해 H2/JdbcTemplate/time-management fixture를 다룬다.

Phase 0 MVP 상태는 **종료**다.

이 종료는 Java/Spring Backend Phase 0에서 `targetFile -> file role -> selected rules -> injection block -> model input/tool output -> model behavior` 경로가 #1과 #2-3 fixture에서 재현 가능하게 관찰됐다는 뜻이다. 앱 품질 보증, Guard/AST/linter 검증, profile-aware/frontend/infra/desktop 확장은 포함하지 않는다.

Phase 1.1 rule-loader/frontmatter/glob/scenario selection refinement 상태도 **종료**다. 이 종료는 `.persona/rules/**/*.md` catalog loading, 정본 metadata(`id/source/domain/topic/severity/enforcement`) 파싱, minimal glob matching, scenario-aware contract selection, catalog tests, runtime selection evidence 범위에 한정된다. role/topic/severity 기반 자동 우선순위 계산, full rule engine, Guard/AST/linter, profile-aware expansion, OMO workflow adaptation, generated Spring app quality certification은 포함하지 않는다.

Phase 0 #1단계 Spring backend fixture 상태는 **종료**다.

종료 판단은 `2026-06-17T11-04-54-321Z`, `2026-06-17T11-06-35-453Z` 반복 run을 기준으로 한다. 두 run 모두 같은 기본 실행 명령으로 완주했고, 사람이 생성 코드를 직접 확인했을 때 API 계약과 Controller/Service/Repository 역할 분리를 만족했다. 이 확인은 모델 행동 변화 관찰이지 예약 앱 product 품질 보증이 아니다. 직전 repository 분리 drift는 `2026-06-17T10-53-27-107Z`에서 `ReservationRepository`가 concrete 저장소 class로 생성된 문제였고, 이후 반복 2회에서는 재발하지 않았다.

Phase 0 #2-3 fixture evidence 상태도 **종료**다. `experiments/phase0-runs/2026-06-18T00-34-47-590Z`에서 Controller, Test, Request DTO, Response DTO가 실제 hook target으로 포착됐고, 해당 역할의 selected rules에 `backend/step2-3-api-contract.md`가 들어갔다. `backend/step1-api-contract.md` 혼입은 0건이었다. 같은 기본 명령의 반복 run `experiments/phase0-runs/2026-06-18T01-02-20-056Z`에서도 Controller, Test, Request DTO, Response DTO evidence가 재현됐고 `backend/step2-3-api-contract.md` 15건, `backend/step1-api-contract.md` 0건이었다.

단, 이 #2-3 evidence는 prompt에서 구현 후 Controller/Test/DTO 파일을 `glob`/`read` 하도록 명시적으로 유도해 확보한 것이다. 모델이 자연스럽게 항상 모든 역할 파일을 읽는다는 보장은 아니다. MVP 기준으로는 targetFile -> injection block -> model input/tool output -> model behavior 관찰에 충분한 증거지만, 품질 게이트, Guard/AST/linter 검증, 완성 앱 품질 보증은 아니다.

이 종료와 evidence는 Java/Spring Backend Phase 0 fixture에만 적용된다. profile-aware rule routing, frontend, infra, benchmark routing, desktop app 안정성을 의미하지 않는다.

지원하는 파일 역할:

```text
README.md / requirements.md
build.gradle / settings.gradle
**/*Controller.java
**/*Service.java
**/*Repository.java
**/*Entity.java
**/*Request.java
**/*Response.java
**/*Exception.java
**/*Test.java
```

모든 Java/Spring 파일에는 clean-code baseline이 기본으로 깔린다. 파일명이 Controller, Service, Entity 등으로 끝나면 역할별 정책이 추가된다.
README/requirements/Gradle bootstrap target에는 Java backend project start guidance만 좁게 들어간다.

MVP 밖 범위:

- profile-aware rule routing
- frontend/infra/deploy rule
- benchmark routing
- desktop app
- 2단계 이후 웹 백엔드 요구사항의 product 구현 또는 품질 보증
- 복잡한 평가 대시보드
- 방탈출 예약 앱의 product 완성도 검증
- Guard/AST/linter 기반 규칙 준수 강제

## 규칙 정본

Persona Harness의 기본 철학은 `.persona/rules`에 둔다.

```text
.persona/
├─ harness.jsonc
└─ rules/
   ├─ clean-code/
   │  ├─ abstraction.md
   │  ├─ common.md
   │  ├─ naming.md
   │  ├─ method-design.md
   │  ├─ oop.md
   │  └─ testability.md
   └─ backend/
      ├─ java-common.md
      ├─ java-backend-bootstrap.md
      ├─ gradle-bootstrap.md
      ├─ layered-architecture.md
      ├─ package-structure.md
      ├─ validation-exception.md
      ├─ spring-controller.md
      ├─ spring-service.md
      ├─ spring-repository.md
      ├─ spring-entity.md
      ├─ spring-dto.md
      ├─ spring-test.md
      ├─ step1-api-contract.md
      └─ step2-3-api-contract.md
```

현재 런타임은 `src/phase0/harness-config.ts`에서 `.persona/harness.jsonc`를 읽고, `src/phase0/rule-loader.ts`에서 `.persona/rules/**/*.md`의 bullet 정책을 읽은 뒤, `src/phase0/injection.ts`에서 MVP용 injection block으로 압축한다. Phase 1.1에서는 `src/phase0/rule-catalog.ts`, `src/phase0/rule-frontmatter.ts`, `src/phase0/rule-glob.ts`를 통해 최소 catalog/frontmatter/glob/scenario eligibility layer를 추가했다. #2-3 sandbox는 `.persona/harness.jsonc`의 `"scenario": "step2-3"` marker로 `backend/step2-3-api-contract.md`를 선택한다. `enabled`, `rulesDir`, `evidenceDir`, `maxRulesPerInjection`, `scenario`, `enabledDomains`는 런타임에서 읽는다. role/topic/severity 기반 자동 우선순위 계산을 하는 full rule engine은 아직 구현하지 않는다.

핵심 원칙:

- clean-code는 선택 팩이 아니라 모든 Java/Spring 파일에 깔리는 기본 베이스다.
- 짧은 코드보다 명확한 코드, 성급한 재사용보다 의도 보존을 우선한다.
- 흐름과 판단을 분리하고, 객체가 자신의 상태와 규칙을 지키게 한다.
- backend-policy는 Controller, Service, Repository, Entity, DTO, Test 역할별 책임을 분리한다.
- Domain은 Spring, HTTP, DB 세부사항을 알지 않게 둔다.
- 1단계 실험에서는 API 계약을 고정한다. 예약 추가 요청은 `name`, `date`, `time`이고 응답은 `id`, `name`, `date`, `time`이다.
- #2-3 fixture에서는 별도 API contract rule을 사용한다. 예약 추가 요청은 `name`, `date`, `timeId`이고, 예약 조회 응답의 `time`은 `{ id, startAt }` 객체다.

`references/diff-rules`에서 가져온 철학과 보류한 개인 취향성 규칙은 [docs/current/rule-curation.md](docs/current/rule-curation.md)에 남긴다.

`example/src`는 backend product code style reference answer로 다룬다. 이 예제는 roomescape, step1, H2, `schema.sql`, 특정 endpoint/body/test style을 보편 규칙으로 강제하기 위한 template이 아니다. 현재 기본 목표는 같은 요구사항과 선택한 기술 스택이 주어졌을 때 Clean Code 기반 backend code flow가 균일하게 나오게 하는 것이다.

현재 Java/Spring build path는 Gradle을 canonical로 둔다. Maven 기반 A/B evidence는 향후 primary 판단에서 폐기한다.

개인/팀/프로젝트 철학은 선택적으로 얹는 후속 philosophy harness layer다. 철학이 없을 때는 Clean Code와 backend 역할 책임을 기본값으로 삼고, 프로젝트 규모, 개인/팀 맥락, 저장소/DB/기술 선택 같은 최소 질문을 통해 계획을 먼저 세운 뒤 구현으로 넘어가는 방향을 유지한다.

`packages/shared-skills`에는 OMO shared-skills 구조와 skill content를 vendoring한다. Persona Harness의 목표는 OMO처럼 작업 맥락에 맞는 skill을 자연스럽게 고르되, backend/frontend/infra에 특화해 적용하는 것이다. 현재 최소 auto-routing은 TypeScript target에 `programming`, React/frontend TypeScript target에 `programming` + `frontend`를 선택한다.

기준 문서:

- [docs/current/mvp-goal.md](docs/current/mvp-goal.md)
- [docs/current/loop-engineering.md](docs/current/loop-engineering.md)
- [docs/current/workflow.md](docs/current/workflow.md)
- [docs/current/rule-policy.md](docs/current/rule-policy.md)
- [docs/current/backend-product-code-style-direction.md](docs/current/backend-product-code-style-direction.md)
- [docs/current/shared-skill-reference-direction.md](docs/current/shared-skill-reference-direction.md)
- [docs/current/skill-auto-routing-result.md](docs/current/skill-auto-routing-result.md)
- [docs/phases/phase0/phase0-step2-scope.md](docs/phases/phase0/phase0-step2-scope.md)
- [docs/phases/phase0/phase0-rule-selection-review.md](docs/phases/phase0/phase0-rule-selection-review.md)

## OpenCode 플러그인 구조

`src/index.ts`는 OpenCode가 로드할 `PluginModule`을 export한다.

```ts
export default {
  id: "persona-harness",
  server: async () => hooks,
}
```

Phase 0 hook:

- `tool.execute.before`: read/edit/write 계열 도구 인자에서 Java `targetFile`을 포착한다.
- `tool.execute.after`: read 결과에 injection block을 붙여 같은 모델 턴에서 규칙을 볼 수 있게 한다.
- `experimental.chat.messages.transform`: pending injection block을 다음 모델 입력의 최신 user message 앞에 붙인다.

OMO처럼 “모델이 알아서 좋은 스킬을 고르길 기대하는 방식”이 아니라, 파일 경로와 파일명으로 하네스가 먼저 발동한다.

## Local Development Install

```bash
npm install
npm run build
```

검증:

```bash
npm run demo:init
npm run demo:bootstrap
npm run demo:java-mvp
npm test
npm run typecheck
npm run build
npm run report:rules
npm run check:injection-value
npm run check:scope:strict
npm pack --dry-run
```

`npm test`는 Vitest 전에 diagnostics-only scope check와 docs taxonomy check를 함께 실행한다. scope drift가 보이더라도 finding 자체는 test failure gate가 아니며, scope report만 보고 싶으면 `npm run check:scope`를 실행한다. 새 docs가 루트에 생기면 `npm run check:docs`가 실패하고 `docs/current`, `docs/evidence-reviews`, `docs/phases`, `docs/archive` 중 이동할 위치를 제안한다.
릴리즈나 CI에서 scope drift를 실패로 다루고 싶으면 `npm run check:scope:strict`를 실행한다.

테스트는 매 테스트마다 `.persona-test-fixtures/`를 비우고 Java fixture를 다시 만든다. 이 경로는 Git에 커밋하지 않는다.

`npm run report:rules`는 빌드 후 `.persona/rules` frontmatter diagnostics를 읽고 ignored output인 `.persona/evidence/phase-next/rule-diagnostics-report.md`에 markdown report를 남긴다. 이 report는 diagnostics-only surface다. invalid metadata를 보여주지만 rule loading, rule selection, injection, test, typecheck, build를 막지 않는다.

## Package Artifact Smoke

패키지 설치 표면까지 포함한 가장 짧은 smoke/demo command는 다음이다.

```bash
npm install
npm run demo:init
npm run demo:bootstrap
npm run demo:java-mvp
```

이 명령들은 현재 저장소를 빌드한 뒤 `npm pack`으로 tarball을 만들고, 임시 프로젝트에 `persona-harness` 패키지를 설치한다. `demo:init`은 `persona-harness init` 표면을 검증하고, `demo:bootstrap`은 README bootstrap hook surface를 검증하며, `demo:java-mvp`는 Java Controller target에 대한 Phase 0 hook을 직접 호출한다.

검증하는 것:

- 패키지 안에 `dist/index.js`, `.persona/harness.jsonc`, `.persona/rules`가 포함된다.
- `persona-harness init`이 `.persona/evidence`를 복사하지 않는다.
- README target이 `project-bootstrap` file role로 잡힌다.
- `tool.execute.after`가 Java Controller target에 `[Persona Harness Injection]`을 붙인다.
- injection block에 `backend/java-common.md`, `backend/spring-controller.md`가 포함된다.
- `experimental.chat.messages.transform`이 같은 injection을 model input 쪽 user message에 붙인다.
- 임시 프로젝트의 ignored `.persona/evidence/phase0` 아래 evidence JSON이 생성된다.

검증하지 않는 것:

- 생성된 Spring application의 product quality
- 테스트 충분성
- rule compliance enforcement
- Guard/AST/linter 검증
- frontend, infra, multi-domain productization

임시 프로젝트를 남겨 직접 확인하려면 다음처럼 실행한다.

```bash
npm run demo:java-mvp -- --keep
```

## OpenCode 연결 경로

테스트할 Java/Spring 프로젝트에서 init을 실행한다.

```bash
npx persona-harness init
```

local development 중 직접 연결하려면 `.opencode/opencode.json`에 빌드된 플러그인을 등록한다.

```jsonc
{
  "plugin": [
    "/Users/yongtae/Desktop/persona-harness/dist/index.js"
  ]
}
```

그 프로젝트에서 OpenCode를 실행하고 Java/Spring target file을 읽거나 수정한다.

```bash
opencode run --dir /path/to/java-spring-project --model openai/gpt-5.4-mini-fast \
  "먼저 src/main/java/com/example/coupon/presentation/CouponController.java 파일을 읽고, 요구사항에 맞게 구현해줘."
```

Java target file이 포착되면 Persona Harness가 `targetFile -> file role -> selected rules -> injection block -> tool output/model input` 흐름으로 동작한다. evidence는 연결한 Java/Spring 프로젝트의 `.persona/evidence/phase0` 아래에 JSON으로 남는다.

## 반복 실험 패키지

OpenCode 연동 실험은 추적하지 않는 `experiments/` 아래에 계속 남긴다.

준비만 하기:

```bash
npm run experiment:phase0:prepare
```

실제 OpenCode 실행까지 하기:

```bash
npm run experiment:phase0
```

#2-3 fixture 준비와 실행:

```bash
npm run experiment:phase0:step2-3:prepare
npm run experiment:phase0:step2-3 -- --model openai/gpt-5.4-mini-fast --timeout-ms 600000
```

각 실행은 다음 구조로 저장된다.

```text
experiments/phase0-runs/{timestamp}/
├─ goal.md
├─ worklog.md
├─ requirements.md
├─ prompt.md
├─ evidence.md
├─ stdout.log
├─ stderr.log
├─ diff.patch
├─ rule-selection.md
├─ analysis.md
├─ next-actions.md
├─ sandbox/
│  ├─ .opencode/opencode.json
│  ├─ .persona/harness.jsonc
│  ├─ .persona/rules/...
│  ├─ requirements.md
│  ├─ settings.gradle
│  ├─ build.gradle
│  └─ src/...
└─ sandbox-baseline/
```

`experiments/`는 Git ignore 대상이다. 실험 로그, 모델 산출물, evidence, 냉정 분석은 로컬에 계속 쌓되 저장소에는 커밋하지 않는다.

## Injection 확인 예시

모델이 Java Controller target file을 읽으면 Persona Harness가 파일 역할을 `controller`로 판정하고, read tool output 또는 다음 model input에 다음 형태의 블록을 붙인다.

```text
[Persona Harness Injection]

현재 파일: src/main/java/com/example/coupon/presentation/CouponController.java
파일 역할: controller

선택 규칙:
- clean-code/common.md
- clean-code/method-design.md
- backend/java-common.md
- backend/spring-controller.md
- backend/spring-dto.md

적용 정책:
- 코드는 짧게보다 명확하게 작성한다.
- 메서드는 하나의 의도를 가진다.
- HTTP 요청/응답, 유스케이스 흐름, 도메인 상태, 저장소 접근 책임을 구분한다.
- Controller는 HTTP 요청/응답 변환만 담당한다.
- Controller에는 비즈니스 로직과 저장소 접근을 넣지 않는다.

주의:
이 Phase 0 블록은 .persona/rules 정본과 최소 frontmatter/glob/scenario catalog layer를 읽는 MVP rule-loader 결과이며, 아직 full rule engine은 아니다.
repo inspection, CLI smoke test, 큰 출력 확인은 `ph bearshell`을 우선 사용한다.
```

이것이 Phase 0의 증명 대상이다.

```text
Java targetFile을 포착했다.
-> 파일 역할별 injection block을 만들었다.
-> read tool output 또는 다음 model input에 반영했다.
```

## Fixture 요구사항

현재 기본 OpenCode 실험에 사용하는 fixture 입력은 `# 1단계: 웹 요청-응답`만이다.

이 요구사항은 예약 앱을 제품으로 만들기 위한 명세가 아니라 Java/Spring 파일 역할별 규칙 주입을 관찰하기 위한 fixture다.

요구사항:

- 방탈출 카페 관리자가 전화/현장 예약을 직접 등록/관리하는 예약 관리 API를 만든다.
- 별도의 데이터베이스 없이 메모리로 예약 상태를 관리한다.
- 서버를 재시작하면 데이터는 모두 사라진다.
- 화면은 만들지 않는다.
- API 동작 확인은 테스트나 HTTP 클라이언트로 한다.

예약 CRUD API:

- `GET /reservations`: 예약 목록 조회
- `POST /reservations`: `name`, `date`, `time`으로 예약 추가
- `DELETE /reservations/{id}`: 예약 삭제

완료 테스트:

- `GET /reservations` 요청 시 `200 OK`
- 아직 생성 요청이 없으면 예약 목록 크기 `0`
- `POST /reservations` 요청 시 `200 OK`
- 예약 추가 응답의 `id`는 `1`
- 예약 추가 후 `GET /reservations` 예약 목록 크기 `1`
- `DELETE /reservations/1` 요청 시 `200 OK`
- 삭제 후 `GET /reservations` 예약 목록 크기 `0`

2단계 이후 요구사항은 기본 #1 runner에 넣지 않는다. #2-3은 별도 runner에서 더 복잡한 Spring fixture 입력으로만 다루며, product 구현 범위로 승격하지 않는다.

## OpenCode 실험 결과

실험 결과 원문은 README에 넣지 않는다.

상세 결과, 실패 로그, 생성 diff, 냉정 분석은 추적하지 않는 `experiments/phase0-runs/*/analysis.md`에 남긴다.

Phase 0 #1단계 backend MVP 종료 판단에 사용한 핵심 run:

- `experiments/phase0-runs/2026-06-17T10-53-27-107Z`: repository contract와 in-memory implementation이 concrete `ReservationRepository` class로 합쳐진 drift 확인.
- `experiments/phase0-runs/2026-06-17T10-58-42-358Z`: repository 분리 보강 후 PASS.
- `experiments/phase0-runs/2026-06-17T11-04-54-321Z`: 보강 후 반복 PASS.
- `experiments/phase0-runs/2026-06-17T11-06-35-453Z`: 보강 후 반복 PASS.

Phase 0 #2-3 fixture live evidence:

- `experiments/phase0-runs/2026-06-18T00-16-01-731Z`: scenario-aware contract selection 후 Controller evidence에서 `backend/step2-3-api-contract.md` 선택, `backend/step1-api-contract.md` 0건.
- `experiments/phase0-runs/2026-06-18T00-34-47-590Z`: prompt로 Controller/Test/DTO read를 유도한 뒤 Controller, Test, Request DTO, Response DTO live targetFile evidence 확보. `backend/step2-3-api-contract.md` 14건, `backend/step1-api-contract.md` 0건.
- `experiments/phase0-runs/2026-06-18T01-02-20-056Z`: 같은 기본 명령 반복 run. Controller, Test, Request DTO, Response DTO live targetFile evidence 재현. `backend/step2-3-api-contract.md` 15건, `backend/step1-api-contract.md` 0건.
- `experiments/phase0-runs/2026-06-18T02-10-18-110Z`: Phase 1.1 catalog 기반 runtime selection 확인. Controller/Test/DTO targetFile evidence가 잡혔고, injection block이 tool output/model input에 남았으며, catalog selection과 evidence `selectedRules`가 일치했다. `backend/step2-3-api-contract.md` 17건, `backend/step1-api-contract.md` 0건.

이 #2-3 evidence는 앱 완성도 평가가 아니라 rule selection과 injection path 관찰이다. prompt가 read를 명시적으로 유도했으므로 모델의 자연스러운 파일 탐색 습관을 증명하지 않는다.

Detector는 문자열 기반 보조 관찰 장치다. 정상 코드가 false positive로 잡힌 적이 있으므로, detector PASS만으로 품질 완료를 선언하지 않는다. Phase 0에서는 Guard/AST/linter로 규칙 준수를 강제하지 않는다. 생성 Spring 앱 품질 평가는 후속 관찰로 의미가 있지만 MVP의 중심 목표는 규칙 주입 경로의 결정성과 재현성이다.

Phase 0 MVP decision: **#2-3 evidence 종료, Phase 0 MVP 종료**.

Phase 1.1 decision: **Phase 1.1 종료**. #1 prepare는 step1 selection 정적 확인에 가깝고 runtime hook path 증명은 아니다. #2-3 live evidence는 runtime hook path에서 catalog selection이 흔들리지 않았다는 증거다. live run은 #2-3 1회뿐이고, 생성된 Spring 앱 품질 보증은 아니다. `./gradlew test` wrapper 부재 실패와 `gradle test` H2 SQL syntax 중간 실패는 product-quality 이슈로 분리하며, injection evidence 실패로 보지 않는다.

## 실패했을 때 확인할 것

- `dist/index.js`가 최신 빌드인지 확인한다.
- 실험 sandbox의 `.opencode/opencode.json`이 `dist/index.js`를 가리키는지 확인한다.
- OpenCode가 상위 Git 루트로 올라가지 않도록 `--dir {sandbox}`가 적용됐는지 확인한다.
- `experiments/phase0-runs/{timestamp}/stderr.log`를 확인한다.
- `experiments/phase0-runs/{timestamp}/evidence.md`와 `sandbox/.persona/evidence/phase0/*.json`에 selected rules가 남았는지 확인한다.
- `analysis.md`의 Result가 `UNKNOWN`이면 실제 OpenCode 실행이나 생성 코드 테스트가 아직 끝나지 않은 상태다.

## Evidence 확인

실제 OpenCode 실행 중 hook이 발동하면 아래 경로에 metadata-only evidence가 남는다.

```text
.persona/evidence/phase0/*.json
```

저장하는 것:

- hook 이름
- sessionID
- callID
- targetFile
- fileRole
- selectedRules: selected rule path string array
- selected rule metadata: path, id, source, domain, topic, severity
- injected policy count
- injection이 들어간 위치: pending-store, tool-output, model-input

저장하지 않는 것:

- 코드 원문
- diff
- rule 본문 전체
- 사용자 개인 노트

## OMO 참고 코드

OMO 코드는 이 저장소에 커밋하지 않는다. 로컬 분석용으로만 ignored reference checkout을 둔다.

```bash
mkdir -p references
git clone https://github.com/code-yeongyu/oh-my-openagent references/oh-my-openagent
```

`references/`는 Git ignore 대상이다.

주요 참고 파일:

```text
references/oh-my-openagent/packages/omo-opencode/src/index.ts
references/oh-my-openagent/packages/omo-opencode/src/testing/create-plugin-module.ts
references/oh-my-openagent/packages/omo-opencode/src/plugin/tool-execute-before.ts
references/oh-my-openagent/packages/omo-opencode/src/plugin/tool-execute-after.ts
references/oh-my-openagent/packages/omo-opencode/src/plugin/messages-transform.ts
```

Persona Harness가 가져올 것은 OMO 전체 시스템이 아니라 OpenCode plugin/hook 작동 방식이다.
