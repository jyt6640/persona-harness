# Persona Harness

OpenCode를 위한 AI coding workflow rail + evidence + continuation harness.

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

Persona Harness는 에이전트가 빈 프로젝트에서 시작해 backend 맥락을 읽고, 구현 rail을 따라가며, 무엇을 읽고/주입받고/실행했는지 흔적을 남기고, unfinished ticket을 이어서 처리한 뒤 workflow report를 채우고 완료를 주장하도록 돕습니다.

generated app product quality를 인증하지 않습니다. 현재 Java/Spring backend guidance는 stack steering과 workflow observability를 위한 표면이지, Clean Code 보장이나 AST/linter/enforcement 엔진이 아닙니다.

`ph` 명령어는 주로 AI가 쓰는 workflow surface입니다. 사용자는 설치와 초기화만 해두고, OpenCode나 Codex-style TUI에서 “README 보고 구현해줘”처럼 자연어로 요청하는 흐름을 목표로 합니다. 이후 `ph workflow implement`, `ph bearshell`, report-fill, `ph workflow finish implement` 명령은 에이전트가 실행해야 합니다.

요구사항이 아직 README로 정리되지 않았고 “TODO 웹 서비스 만들래”처럼 아이디어만 있는 경우에는 바로 구현하지 않는 것이 목표입니다. 이때 에이전트는 먼저 `.persona/workflow/requirements/backlog.md` 초안을 만들고, 사용자가 검토 후 “진행하자”라고 말한 뒤에만 implementation ticket으로 넘어가야 합니다.

> 현재 범위: Java/Spring backend workflow rail MVP.
> frontend, infra, desktop app, AST/linter enforcement, 완전한 TDD workflow는 후속 트랙입니다.
>
> 현재 source/package 후보: `0.3.9-alpha.3`

## 요구사항

- Node.js 20+
- npm
- OpenCode terminal CLI
- OpenCode에 연결된 model/provider

## 빠른 시작

먼저 OpenCode를 설치합니다. OpenCode 공식 문서 기준으로 install script 또는 npm global install을 사용할 수 있습니다.

```bash
curl -fsSL https://opencode.ai/install | bash
```

또는:

```bash
npm install -g opencode-ai
```

설치 확인:

```bash
opencode --version
opencode
```

OpenCode에 model provider를 연결합니다.

```bash
opencode auth login
opencode auth list
```

또는 OpenCode TUI에서 실행합니다.

```text
/connect
/models
```

모델 ID는 `provider/model` 형식입니다. 예: `openai/gpt-5.4-mini-fast`.

그 다음 Java/Spring backend 프로젝트에서 Persona Harness를 설치합니다.

```bash
npm install -D persona-harness@alpha
npx ph init
npx ph bootstrap backend
```

Persona Harness 자체를 개발 중이면 local install을 사용합니다.

```bash
npm install -D /absolute/path/to/persona-harness
npx ph init
npx ph bootstrap backend
```

`npx ph init`은 최소 설치/연동 단계입니다. `.persona/harness.jsonc`, `.persona/rules/`, `.opencode/opencode.json`, `.gitignore`만 준비하고, `AGENTS.md`, `.persona/project-profile.jsonc`, plan/report template은 만들지 않습니다.

backend-ready 상태가 필요하면 `npx ph bootstrap backend`를 실행합니다. 이 명령은 `AGENTS.md`, 기본 backend profile, policy overlay, accepted plan, implementation/review report template, harness/OpenCode config 상태를 준비합니다.

초기 설정 이후에는 사용자가 모든 명령어를 외울 필요가 없습니다. 먼저 OpenCode에게 계획만 완성하게 합니다.

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "$(npx ph plan --prompt)"
```

이미 `npx ph bootstrap backend`를 실행한 빠른 alpha smoke에서는 준비된 backend profile과 accepted plan을 확인할 수 있습니다.

```bash
npx ph doctor
npx ph workflow check
```

프로젝트 조건을 직접 정하고 싶으면 수동 profile 흐름을 사용합니다.

```bash
npx ph intake --interactive --force
# 또는 비대화형 기본 profile만 필요하면:
npx ph intake --default backend
npx ph policy init
npx ph plan
npx ph plan --accept
```

`.persona/project-profile.jsonc`가 없거나 draft/invalid/incomplete 상태면 `ph plan`과 `ph workflow implement`는 구현으로 넘어가지 않고 intake부터 하라고 막습니다.

그 다음에는 짧게 구현을 요청합니다.

```text
README 보고 계획대로 구현해줘.
```

README가 아직 없고 아이디어만 있다면 먼저 이렇게 말합니다.

```text
TODO 웹 서비스 만들래.
```

에이전트는 바로 구현하지 않고 다음 workflow를 사용해야 합니다.

```text
npx ph workflow draft --stdin
```

생성되는 초안:

- `.persona/workflow/requirements/backlog.md`
- `.persona/workflow/requirements/questions.md`
- `.persona/workflow/requirements/assumptions.md`

사용자가 초안을 검토하고 괜찮으면 이렇게 말합니다.

```text
진행하자
```

그때 에이전트는 다음 흐름으로 구현 ticket을 만들어야 합니다.

```text
npx ph workflow approve requirements
npx ph workflow split .persona/workflow/requirements/backlog.md
npx ph workflow next
npx ph workflow implement
```

에이전트가 workflow를 놓치면 아래처럼 더 강한 프롬프트를 사용합니다.

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.md를 읽고 plan이 accepted 상태인지 확인한 뒤 Java/Spring Gradle 기반으로 요구사항 전체를 구현해줘. 명령 실행은 가능하면 npx ph bearshell로 하고, 구현 후 npx ph bearshell gradle test, npx ph bearshell gradle build, 실행 가능한 Spring Boot 앱이면 npx ph bearshell --shell 'gradle bootRun --args=\"--server.port=<port>\"', HTTP happy path와 failure path smoke를 실행해줘. .persona/workflow/implementation-report.md와 .persona/workflow/review-report.md를 채우고 npx ph plan --report-filled implementation 및 npx ph plan --report-filled review를 실행해줘."
```

## 제공하는 것

- 아래 명령어들은 사용자가 직접 외우는 CLI라기보다, OpenCode/Codex-style 세션에서 AI가 호출하기 쉽게 만든 workflow surface입니다.
- `ph init`: `.persona/rules`, `.persona/harness.jsonc`, OpenCode plugin config, `.gitignore` 설치
- `ph bootstrap backend`: `AGENTS.md`, ready 기본 backend profile, policy overlay, accepted plan, report template, harness/OpenCode config 준비
- `ph intake`: 수정 가능한 draft backend profile 생성
- `ph intake --default backend`: 대화형 터미널 없이 ready 기본 backend profile 생성
- `ph intake --interactive`: backend planning 질문 후 `.persona/project-profile.jsonc` 생성
- `ph policy init`: 회사/개인 backend policy overlay 파일 생성
- `ph plan`: `blackbear` planning role용 `.persona/workflow/plan.md` 생성
- `ph plan --auto-accept`: 빠른 smoke를 위해 plan/report template 생성 후 plan을 accepted 처리
- `ph bearshell`: bounded shell command helper
- `ph history`: 사용한 workflow artifact를 `.persona/workflow/history/`에 보존
- `ph workflow check`: 현재 plan/report/evidence 상태 확인
- `ph workflow draft --stdin`: 모호한 제품 아이디어를 요구사항 초안으로 만들고 사용자 검토에서 멈춤
- `ph workflow approve requirements`: 사용자가 초안을 승인한 뒤 accepted 상태로 표시
- `ph workflow capture --stdin`: 이미 작성된 긴 프롬프트 요구사항을 latest source로 저장
- `ph workflow split [source.md]`: 요구사항 source를 ticket/backlog로 분리
- `ph workflow next`: 첫 pending ticket 출력
- `ph workflow archive <ticket>`: 완료한 ticket을 history로 이동
- `ph workflow implement`: accepted plan workflow 상태가 준비된 뒤 AI용 단일 구현 레일과 README chunk-read 명령 출력
- `ph workflow start implement`: accepted plan workflow 상태가 준비된 뒤 AI용 구현 레일 출력
- `ph workflow finish implement`: workflow report/evidence가 준비되기 전 완료 보고 차단
- `ph workflow guard implement/final`: workflow rail이 재사용하는 저수준 strict gate
- `ph doctor`: OpenCode와 Persona Harness 연동 상태 진단
- `ph smoke`, `ph feedback`, `ph evidence summary`, `ph review backend-shape`: report-only 검증/피드백 artifact 생성
- OpenCode injection: 관련 파일을 읽을 때 Java/Spring backend workflow/guidance context 주입

## evidence의 의미

`.persona/evidence`는 파일 read, 주입된 workflow/rule context, 선택된 rail, target file role, workflow command activity 같은 실행 흔적입니다. “에이전트가 의도한 rail을 보고 따라갔는가”를 확인하기 위한 기록이지, 품질 점수나 품질 향상 증거가 아닙니다.

## 권장하는 코드 모양

- Gradle 기반 Java/Spring backend
- `presentation`, `application`, `domain`, `infrastructure`, `global` 경계
- Controller는 Service에 위임
- Application Service는 use case 흐름만 담당하고 저장소 상태/id sequence를 직접 소유하지 않음
- Domain은 단순 record가 아니라 자기 필드로 판단과 행동을 가짐
- Repository interface는 domain, 구현체는 infrastructure에 위치
- Request/response DTO boundary 명확화

위 항목은 steering target과 review cue입니다. 생성된 앱이 정확하거나 유지보수 가능하거나 안전하거나 production-ready임을 증명하지 않습니다.

## A/B와 ON/OFF smoke 한계

기존 A/B 또는 ON/OFF smoke 결과는 stack steering 신호로만 봅니다. 대부분 표본이 작고, 때로는 `n=1`이며, non-blind, same operator, model/version/prompt/timeout/continuation behavior에 의존하므로 product quality 입증으로 쓰지 않습니다.

## 보장하지 않는 것

- generated app product quality 인증
- AST/linter/build failure 기반 rule enforcement
- Clean Code 품질 보장
- evidence count를 품질 향상으로 해석하는 주장
- 테스트 충분성 증명
- frontend, infra, desktop workflow productization
- 최종 TDD workflow
- OpenCode 없는 독립 agent workflow

## 문서

- [Changelog](CHANGELOG.md)
- [Release checklist](docs/current/release/release-checklist.md)
- [Release notes template](docs/current/release/release-notes-template.md)
- [상세 사용 노트](docs/current/persona-harness-detailed-usage.md)
- [Alpha publish readiness](docs/current/v0.3.0-alpha-publish-readiness.md)
- [External tester guide](docs/current/v0.3.0-external-tester-guide.md)
- [Java backend MVP install guide](docs/current/java-backend-mvp-install-guide.md)

## 라이선스

Apache-2.0. See [LICENSE](LICENSE).
