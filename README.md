# Persona Harness

Persona Harness는 OpenCode에서 동작하는 TypeScript 플러그인 MVP다.

Phase 0의 목표는 하나다.

```text
targetFile -> injection block -> 실제 모델 입력
```

아직 완전한 rule engine을 구현하지 않는다. 먼저 Java/Spring 파일을 읽거나 수정하려는 순간 파일 역할을 결정적으로 잡고, 그 파일에 맞는 클린코드/백엔드 원칙이 모델 컨텍스트에 들어가는지 증명한다.

## 현재 범위

현재 구현은 `# 1단계: 웹 요청-응답` Java/Spring 백엔드 미션만 대상으로 한다.

Phase 0 #1단계 Spring backend MVP 상태는 **종료**다.

종료 판단은 `2026-06-17T11-04-54-321Z`, `2026-06-17T11-06-35-453Z` 반복 run을 기준으로 한다. 두 run 모두 같은 기본 실행 명령으로 완주했고, 사람이 생성 코드를 직접 확인했을 때 API 계약과 Controller/Service/Repository 역할 분리를 만족했다. 직전 repository 분리 drift는 `2026-06-17T10-53-27-107Z`에서 `ReservationRepository`가 concrete 저장소 class로 생성된 문제였고, 이후 반복 2회에서는 재발하지 않았다.

이 종료는 Java/Spring Backend Phase 0 `# 1단계: 웹 요청-응답`에만 적용된다. 2단계 이후 요구사항, profile-aware rule routing, frontend, infra, benchmark routing, desktop app 안정성을 의미하지 않는다.

지원하는 파일 역할:

```text
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

MVP 밖 범위:

- profile-aware rule routing
- frontend/infra/deploy rule
- benchmark routing
- desktop app
- 2단계 이후 웹 백엔드 요구사항
- 복잡한 평가 대시보드

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
      ├─ layered-architecture.md
      ├─ package-structure.md
      ├─ validation-exception.md
      ├─ spring-controller.md
      ├─ spring-service.md
      ├─ spring-repository.md
      ├─ spring-entity.md
      ├─ spring-dto.md
      ├─ spring-test.md
      └─ step1-api-contract.md
```

현재 Phase 0 런타임은 `src/phase0/rule-loader.ts`에서 `.persona/rules/**/*.md`의 bullet 정책을 읽고, `src/phase0/injection.ts`에서 MVP용 injection block으로 압축한다. full frontmatter/glob engine은 아직 구현하지 않는다.

핵심 원칙:

- clean-code는 선택 팩이 아니라 모든 Java/Spring 파일에 깔리는 기본 베이스다.
- 짧은 코드보다 명확한 코드, 성급한 재사용보다 의도 보존을 우선한다.
- 흐름과 판단을 분리하고, 객체가 자신의 상태와 규칙을 지키게 한다.
- backend-policy는 Controller, Service, Repository, Entity, DTO, Test 역할별 책임을 분리한다.
- Domain은 Spring, HTTP, DB 세부사항을 알지 않게 둔다.
- 1단계 실험에서는 API 계약을 고정한다. 예약 추가 요청은 `name`, `date`, `time`이고 응답은 `id`, `name`, `date`, `time`이다.

`references/diff-rules`에서 가져온 철학과 보류한 개인 취향성 규칙은 [docs/rule-curation.md](docs/rule-curation.md)에 남긴다.

기준 문서:

- [docs/mvp-goal.md](docs/mvp-goal.md)
- [docs/loop-engineering.md](docs/loop-engineering.md)
- [docs/workflow.md](docs/workflow.md)
- [docs/rule-policy.md](docs/rule-policy.md)

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

## 설치와 빌드

```bash
npm install
npm run build
```

검증:

```bash
npm test
npm run typecheck
npm run build
```

테스트는 매 테스트마다 `.persona-test-fixtures/`를 비우고 Java fixture를 다시 만든다. 이 경로는 Git에 커밋하지 않는다.

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
│  ├─ pom.xml
│  └─ src/...
└─ sandbox-baseline/
```

`experiments/`는 Git ignore 대상이다. 실험 로그, 모델 산출물, evidence, 냉정 분석은 로컬에 계속 쌓되 저장소에는 커밋하지 않는다.

## OpenCode에 연결하기

테스트할 Java/Spring 프로젝트의 `.opencode/opencode.json`에 빌드된 플러그인을 등록한다.

```jsonc
{
  "plugin": [
    "/Users/yongtae/Desktop/persona-harness/dist/index.js"
  ]
}
```

그 프로젝트에서 OpenCode를 실행한다.

```bash
opencode run --dir /path/to/java-spring-project --model opencode/north-mini-code-free --dangerously-skip-permissions \
  "먼저 src/main/java/com/example/reservation/ReservationController.java 파일을 읽고, 1단계 웹 요청-응답 요구사항의 예약 CRUD API를 구현해줘."
```

주의: Persona Harness 저장소 내부 하위 디렉터리에서 OpenCode를 실행하면 Git 루트 때문에 모델이 상위 저장소까지 탐색할 수 있다. 실험 스크립트는 이 문제를 줄이기 위해 `opencode run --dir {sandbox}`를 사용한다. 직접 실행할 때도 `--dir`로 독립 Java/Spring 프로젝트를 지정한다.

모델이 `ReservationController.java`를 읽으면 Persona Harness가 파일 역할을 `controller`로 판정하고, read tool output 뒤에 다음 블록을 붙인다.

```text
[Persona Harness Injection]

현재 파일: src/main/java/com/example/reservation/ReservationController.java
파일 역할: controller

적용 정책:
- 코드는 짧게보다 명확하게 작성한다.
- 메서드는 하나의 의도를 가진다.
- HTTP 요청/응답, 유스케이스 흐름, 도메인 상태, 저장소 접근 책임을 구분한다.
- Controller는 HTTP 요청/응답 변환만 담당한다.
- Controller에는 비즈니스 로직과 저장소 접근을 넣지 않는다.
- 1단계 예약 추가 요청 본문은 반드시 name, date, time이다.
```

이것이 Phase 0의 증명 대상이다.

```text
Java targetFile을 포착했다.
-> 파일 역할별 injection block을 만들었다.
-> read tool output 또는 다음 model input에 반영했다.
```

## 1단계 테스트 요구사항

현재 OpenCode 실험에 사용하는 요구사항 범위는 `# 1단계: 웹 요청-응답`만이다.

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

2단계 이후 요구사항은 Phase 0 OpenCode 연동 테스트에 넣지 않는다.

## OpenCode 실험 결과

실험 결과 원문은 README에 넣지 않는다.

상세 결과, 실패 로그, 생성 diff, 냉정 분석은 추적하지 않는 `experiments/phase0-runs/*/analysis.md`에 남긴다.

Phase 0 #1단계 backend MVP 종료 판단에 사용한 핵심 run:

- `experiments/phase0-runs/2026-06-17T10-53-27-107Z`: repository contract와 in-memory implementation이 concrete `ReservationRepository` class로 합쳐진 drift 확인.
- `experiments/phase0-runs/2026-06-17T10-58-42-358Z`: repository 분리 보강 후 PASS.
- `experiments/phase0-runs/2026-06-17T11-04-54-321Z`: 보강 후 반복 PASS.
- `experiments/phase0-runs/2026-06-17T11-06-35-453Z`: 보강 후 반복 PASS.

Detector는 문자열 기반 보조 장치다. 정상 코드가 false positive로 잡힌 적이 있으므로, detector PASS만으로 품질 완료를 선언하지 않는다. 종료 판단은 detector 결과, 생성 Java/Spring 코드 직접 확인, 반복 run PASS 근거를 합쳐 내린다.

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
- selected rule files
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
