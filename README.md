# Persona Harness

Persona Harness는 OpenCode에서 동작하는 TypeScript 플러그인 MVP다.

Phase 0의 목표는 하나다.

```text
targetFile -> injection block -> 실제 모델 입력
```

아직 전체 rule-loader를 구현하지 않는다. 먼저 Java/Spring 파일을 읽거나 수정하려는 순간 파일 역할을 결정적으로 잡고, 그 파일에 맞는 클린코드/백엔드 원칙이 모델 컨텍스트에 들어가는지 증명한다.

## 현재 범위

현재 구현은 `# 1단계: 웹 요청-응답` 같은 Java/Spring 백엔드 미션을 대상으로 한다.

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

## 규칙 정본

Persona Harness의 기본 철학은 `.persona/rules`에 둔다.

```text
.persona/
├─ harness.jsonc
└─ rules/
   ├─ clean-code/
   │  ├─ common.md
   │  ├─ naming.md
   │  ├─ method-design.md
   │  └─ testability.md
   └─ backend/
      ├─ java-common.md
      ├─ spring-controller.md
      ├─ spring-service.md
      ├─ spring-repository.md
      ├─ spring-entity.md
      ├─ spring-dto.md
      ├─ spring-test.md
      └─ step1-api-contract.md
```

현재 Phase 0 런타임은 아직 full rule-loader가 아니라 `src/phase0/injection.ts`의 curated injection catalog를 사용한다. 단, 이 catalog는 `.persona/rules`의 정본과 같은 철학을 따르도록 맞춰둔다.

핵심 원칙:

- clean-code는 선택 팩이 아니라 모든 Java/Spring 파일에 깔리는 기본 베이스다.
- backend-policy는 Controller, Service, Repository, Entity, DTO, Test 역할별 책임을 분리한다.
- 1단계 실험에서는 API 계약을 고정한다. 예약 추가 요청은 `name`, `date`, `time`이고 응답은 `id`, `name`, `date`, `time`이다.

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

테스트는 `.persona-test-fixtures/` 아래에 Java fixture를 만든다. 이 경로는 Git에 커밋하지 않는다.

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
├─ sandbox/
│  ├─ .opencode/opencode.json
│  ├─ .persona/harness.jsonc
│  ├─ .persona/rules/...
│  ├─ requirements-step1.md
│  ├─ pom.xml
│  └─ src/...
├─ prompt.txt
├─ opencode.stdout.jsonl
├─ opencode.stderr.log
└─ analysis.md
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
opencode run --model opencode/north-mini-code-free --dangerously-skip-permissions \
  "먼저 src/main/java/com/example/reservation/ReservationController.java 파일을 읽고, 1단계 웹 요청-응답 요구사항의 예약 CRUD API를 구현해줘."
```

주의: Persona Harness 저장소 내부 하위 디렉터리에서 OpenCode를 실행하면 Git 루트 때문에 모델이 상위 저장소까지 탐색할 수 있다. 실제 실험은 독립 Java/Spring 프로젝트에서 실행하는 편이 좋다.

모델이 `ReservationController.java`를 읽으면 Persona Harness가 파일 역할을 `controller`로 판정하고, read tool output 뒤에 다음 블록을 붙인다.

```text
[Persona Harness Injection]

현재 파일: src/main/java/com/example/reservation/ReservationController.java
파일 역할: controller

적용 정책:
- Controller는 HTTP 요청/응답 변환만 담당한다.
- Controller에는 비즈니스 로직을 넣지 않는다.
- Entity를 API 응답으로 직접 반환하지 않는다.
- Request/Response DTO를 명시적으로 사용한다.
- 1단계 예약 추가 요청 본문은 반드시 name, date, time이다.
- 예약 추가 응답은 id, name, date, time을 반환한다.
- 화면, 데이터베이스, H2, 시간 관리 기능은 1단계 범위가 아니다.
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

## 실제 OpenCode 실험 결과

2026-06-17에 `opencode run`으로 Phase 0을 실행했다.

결과:

- Hook feasibility는 통과했다.
- `read`/`write` tool output에 injection block이 실제로 들어갔다.
- `.persona/evidence/phase0/*.json` evidence가 생성됐다.
- 하지만 생성된 Java/Spring 코드는 1단계 요구사항을 통과하지 못했다.

상세 분석은 추적하지 않는 `experiments/phase0-runs/*/analysis.md`에 남긴다.

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
