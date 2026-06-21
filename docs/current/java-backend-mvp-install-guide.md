# Java Backend MVP Install Guide

## Scope

Persona Harness의 현재 productized MVP는 Java/Spring backend Clean Code injection이다.

목표는 같은 요구사항에서 Gradle 기반, 계층 분리, DTO boundary, Repository boundary, Service orchestration-only backend product code shape가 더 균일하게 나오도록 Java target file에 rule context를 주입하는 것이다.

frontend, infra, multi-domain shared skill은 후속 확장 후보이며 현재 release-facing MVP 범위가 아니다.

## Requirements

- Node.js 20+
- npm
- OpenCode terminal CLI
- OpenCode에 연결된 model/provider

Persona Harness의 CLI는 OpenCode 없이도 `.persona` planning files를 만들 수 있지만, 핵심인 plugin hook injection과 evidence capture는 OpenCode가 있어야 동작한다.

OpenCode 설치:

```bash
curl -fsSL https://opencode.ai/install | bash
```

대안 npm 설치:

```bash
npm install -g opencode-ai
```

확인:

```bash
opencode --version
opencode
```

model/provider 연결:

```bash
opencode auth login
opencode auth list
```

또는 OpenCode TUI에서:

```text
/connect
/models
```

`opencode run --model <model>`의 model 값은 `provider/model` 형식이어야 한다. 예:

```text
openai/gpt-5.4-mini-fast
```

## Local Development Install

```bash
npm install
npm run build
```

## Project Init

대상 프로젝트에서는 다음 한 줄로 Persona Harness rules와 OpenCode plugin 연결을 설치한다.

```bash
npx persona-harness init
```

설치되는 것:

- `.persona/harness.jsonc`
- `.persona/rules/`
- `.opencode/opencode.json`

복사하지 않는 것:

- `.persona/evidence/`

`.persona/evidence/`는 init template가 아니라 hook runtime evidence다. OpenCode가 README/requirements/Gradle/Java target을 실제로 읽거나 수정할 때 대상 프로젝트 안에 생성된다.

기본 검증:

```bash
npm test
npm run typecheck
npm run build
npm run report:rules
```

`npm run report:rules`는 `.persona/rules` frontmatter diagnostics를 ignored output인 `.persona/evidence/phase-next/rule-diagnostics-report.md`에 남긴다. 이 report는 diagnostics-only surface이며 rule loading, rule selection, injection, test, typecheck, build를 막지 않는다.

## Package Artifact Smoke

가장 짧은 package artifact smoke commands:

```bash
npm run demo:init
npm run demo:bootstrap
npm run demo:java-mvp
```

`npm run demo:init`은 package artifact가 실제 설치 환경에서 `persona-harness init`으로 clean project를 안전하게 초기화하는지 확인한다.

`npm run demo:bootstrap`은 init 이후 README target에서 bootstrap injection과 runtime evidence 생성이 되는지 확인한다.

`npm run demo:java-mvp`는 package artifact가 실제 설치 환경에서도 Java Controller plugin hook, injection, model input transform, evidence 생성 경로를 재현하는지 확인한다.

검증하는 것:

- `npm pack` tarball 생성
- 임시 프로젝트에 packed `persona-harness` 설치
- 설치된 `persona-harness init` 실행
- init 직후 `.persona/evidence`가 없음을 확인
- 설치된 패키지 안의 `dist/index.js`, `.persona/harness.jsonc`, `.persona/rules` 확인
- README target의 `project-bootstrap` injection 확인
- 설치된 OpenCode plugin module import
- `tool.execute.after` hook 노출과 Java Controller injection 확인
- `experimental.chat.messages.transform` hook 노출과 model input transform 확인
- 임시 프로젝트의 `.persona/evidence/phase0` evidence JSON 생성 확인

임시 프로젝트를 보존하려면:

```bash
npm run demo:java-mvp -- --keep
```

## OpenCode Plugin Connection

테스트할 Java/Spring 프로젝트에서 `persona-harness init`을 실행한다.

```bash
npx persona-harness init
```

local development 중 직접 경로를 고정해야 하면 `.opencode/opencode.json`에 빌드된 플러그인을 등록한다.

```jsonc
{
  "plugin": [
    "/absolute/path/to/persona-harness/dist/index.js"
  ]
}
```

그 Java/Spring 프로젝트에서 OpenCode를 실행한다.

```bash
opencode run --dir /path/to/java-spring-project --model openai/gpt-5.4-mini-fast \
  "먼저 src/main/java/com/example/coupon/presentation/CouponController.java 파일을 읽고, 요구사항에 맞게 구현해줘."
```

Persona Harness는 OpenCode가 README/requirements/Gradle bootstrap target 또는 Java/Spring target file을 읽거나 수정할 때 동작한다.

흐름:

```text
README / requirements / Gradle / Java target file
-> file role
-> selected rules
-> injection block
-> tool output / model input
-> .persona/evidence/phase0 JSON
```

현재 Java/Spring target role:

```text
README.md
requirements.md
build.gradle
settings.gradle
**/*Controller.java
**/*Service.java
**/*Repository.java
**/*Entity.java
**/*Request.java
**/*Response.java
**/*Exception.java
**/*Test.java
```

## Evidence

Plugin hook이 발동하면 연결한 Java/Spring 프로젝트의 configured evidence directory 아래에 JSON이 남는다. 기본값은 다음 경로다.

```text
.persona/evidence/phase0/*.json
```

각 evidence JSON은 target file, file role, selected rules, selected rule metadata, selected shared skills, injected policy count를 기록한다.

## Non-Goals

이 install guide와 `npm run demo:java-mvp`는 다음을 보증하지 않는다.

- 생성된 Spring application의 품질
- 테스트 충분성
- rule compliance enforcement
- Guard/AST/linter 검증
- frontend, infra, multi-domain productization
- package name exact match

Backend product code shape uniformity가 현재 MVP 성공 기준이다.
