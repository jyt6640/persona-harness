# Persona Harness

Persona Harness는 Java/Spring 백엔드 프로젝트를 위한 로컬 CLI와 OpenCode workflow rail입니다.

AI 코딩 에이전트가 다음을 하도록 돕습니다.

- 아이디어나 README를 구현 ticket으로 나눔
- 반복 가능한 백엔드 workflow를 따름
- 제한된 명령 실행으로 검증을 남김
- 무엇을 읽고 실행하고 완료했는지 로컬 evidence로 기록
- 필요한 report/evidence가 없으면 완료 주장을 차단

Persona Harness는 코드 품질 보장, 토큰 절약 제품, broad linter, generated app production-ready 증명이 아닙니다.

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

## 설치

필요한 것:

- Node.js 20+
- npm
- Java 21+
- Gradle
- model/provider가 연결된 OpenCode CLI

OpenCode 설치:

```bash
curl -fsSL https://opencode.ai/install | bash
# 또는
npm install -g opencode-ai
```

Provider 연결:

```bash
opencode auth login
opencode auth list
```

프로젝트에 현재 preview package 설치:

```bash
npm install -D persona-harness@next
npx ph --help
npx ph init
npx ph doctor
```

오래된 stable package가 필요하면 stable channel을 사용합니다.

```bash
npm install -D persona-harness@latest
```

## Java/Spring 백엔드 프로젝트 시작

깨끗한 프로젝트 디렉토리에서 시작하세요. 첫 smoke test를 Persona Harness repo 안에서 돌리지 마세요.

```bash
mkdir -p /tmp/persona-harness-demo
cd /tmp/persona-harness-demo
npm init -y
npm install -D persona-harness@next
```

앱 요구사항과 제약을 담은 짧은 `README.md`를 만듭니다.

```bash
cat > README.md <<'EOF'
# Todo API

Java 21, Spring Boot, Gradle 기반 REST API를 만든다.

## 요구사항

- todo를 생성할 수 있다.
- todo 목록을 조회할 수 있다.
- todo를 완료 처리할 수 있다.
- 없는 todo는 적절한 오류 응답을 반환한다.

## 기술 제약

- Java 21
- Spring Boot 3
- Gradle only
- REST API only
- 필요하면 in-memory persistence로 시작한다.
- Controller는 Application Service에 위임한다.
- Repository interface는 domain에 둔다.
- Repository 구현체는 infrastructure에 둔다.
- Application Service가 storage state나 id sequence를 직접 소유하지 않는다.
EOF
```

Persona Harness 초기화:

```bash
npx ph init
npx ph bootstrap backend
npx ph workflow check
```

`ph init`은 최소 연동 파일만 만듭니다.

- `.persona/harness.jsonc`
- `.persona/conventions/`
- `.persona/rules/`
- `.opencode/opencode.json`
- `.gitignore` 항목

`ph bootstrap backend`는 AI 구현을 위한 백엔드 workflow를 준비합니다.

- `AGENTS.md`
- `.persona/project-profile.jsonc`
- policy overlay 파일
- accepted `.persona/workflow/plan.md`
- implementation/review report template
- OpenCode 설정

## 에이전트에게 구현 요청

OpenCode에서는 짧게 요청하세요.

```bash
opencode run --dir . \
  --model <provider/model> \
  --dangerously-skip-permissions \
  "README.md를 읽고 구현해줘."
```

TUI를 쓰면:

```bash
opencode
```

입력:

```text
README.md를 읽고 구현해줘.
```

에이전트는 Persona Harness rail을 스스로 실행해야 합니다.

```text
npx ph workflow implement
npx ph bearshell ...
npx ph plan --report-filled implementation
npx ph plan --report-filled review
npx ph workflow finish implement
```

`workflow finish`가 실패하면 완료라고 말하지 말고, 출력된 blocker를 먼저 고쳐야 합니다.

## README 없이 아이디어만 있을 때

아이디어만 말해도 됩니다.

```text
TODO 웹 서비스를 만들고 싶어.
```

이때 에이전트는 바로 코딩하지 말고 요구사항 초안을 먼저 만들어야 합니다.

```text
npx ph workflow draft --stdin
```

생성 파일:

- `.persona/workflow/requirements/backlog.md`
- `.persona/workflow/requirements/questions.md`
- `.persona/workflow/requirements/assumptions.md`

내용이 맞으면 이렇게 말합니다.

```text
진행하자.
```

그 다음 에이전트가 실행할 흐름:

```text
npx ph workflow approve requirements
npx ph workflow split .persona/workflow/requirements/backlog.md
npx ph workflow next
npx ph workflow implement
```

## 여러 ticket으로 작업하기

요구사항이 길면 ticket으로 나눕니다.

```bash
npx ph workflow split README.md
npx ph workflow next
```

ticket 하나가 구현/검토되면:

```bash
npx ph workflow archive <ticket-id>
npx ph workflow next
```

workflow 기록 위치:

- 진행 중 작업: `.persona/workflow/work/`
- 완료 ticket history: `.persona/workflow/history/`
- 요구사항 source: `.persona/workflow/requirements/`

## 자주 쓰는 명령

설정:

```bash
npx ph init
npx ph bootstrap backend
npx ph doctor
```

Workflow:

```bash
npx ph workflow check
npx ph workflow implement
npx ph workflow finish implement
npx ph workflow archive <ticket-id>
```

제한된 명령 실행:

```bash
npx ph bearshell --shell 'gradle test'
npx ph bearshell --shell 'gradle build'
```

Evidence와 report:

```bash
npx ph evidence summary
npx ph evidence metrics --json
npx ph evidence ab-report --json
npx ph evidence pminus-report --json
npx ph review backend-shape
```

preview/local-current 빌드에는 다음이 있을 수 있습니다.

```bash
npx ph evidence pminus-status --json
```

명시적 local A/B evidence 기록:

```bash
npx ph evidence ab-run \
  --scenario demo \
  --condition baseline \
  -- ./gradlew test
```

## 선택 기능

기본 backend bootstrap은 remote developer MCP `grep_app`, `context7`을 등록합니다.

CodeGraph는 opt-in입니다.

```bash
npx ph bootstrap backend --codegraph-preview
```

LSP도 opt-in입니다.

```bash
npx ph bootstrap backend --lsp-preview
```

필수 외부 도구가 없으면 wrapper는 fake success를 내지 않고 unavailable status를 보고해야 합니다.

developer MCP 등록을 끄려면:

```bash
npx ph bootstrap backend --no-developer-mcp
```

## TDD Rail

TDD rail은 opt-in입니다. 두 설정이 모두 켜져야 동작합니다.

```json
{
  "enforce": {
    "executeVerification": true,
    "tdd": true
  }
}
```

켜져 있으면 `ph workflow test`가 PH가 직접 실행한 Gradle/JUnit failure에서만 red evidence를 기록합니다. 이후 `workflow check`, `workflow archive`, `workflow finish`는 같은 ticket/test id의 green evidence를 기록할 수 있습니다.

이 기능은 red-first completion gate입니다. 테스트를 만들어주거나, 테스트 충분성/coverage/mutation testing/app 품질을 증명하지 않습니다.

## Evidence의 의미

`.persona/evidence`는 파일 읽기, 주입된 workflow context, 명령 실행, TDD 기록, A/B 측정 같은 로컬 흔적입니다.

Evidence가 답하는 질문은 “에이전트가 기대한 rail을 보고 따랐는가?”입니다.

Evidence가 증명하지 않는 것:

- generated app 품질
- token saving
- product efficacy
- full TDD coverage
- broad reliability
- 모든 상황에서의 closure 성공

## 권장 백엔드 모양

Persona Harness는 Java/Spring 프로젝트를 다음 방향으로 유도합니다.

- Gradle-first Java/Spring backend
- `presentation`, `application`, `domain`, `infrastructure`, `global` package 경계
- Controller는 Application Service에 위임
- Application Service는 use case를 orchestration하고 storage state/id sequence를 직접 소유하지 않음
- Repository interface는 `domain`
- Repository 구현체는 `infrastructure`
- Domain object는 behavior를 가짐
- Request/response DTO boundary 명확화

이것은 steering target과 review cue이지 품질 보장이 아닙니다.

## 문제 해결

설치 버전 확인:

```bash
npm view persona-harness dist-tags --json
npm view persona-harness@latest version
npm view persona-harness@next version
```

`opencode`가 없으면:

```bash
curl -fsSL https://opencode.ai/install | bash
opencode --version
opencode auth login
```

`ph workflow check`가 WARN을 내면 출력된 blocker를 확인하세요. 구현 전 template report 경고는 정상입니다. 구현 후에는 evidence 누락, report 미작성, 기대한 rail 밖에서 실행한 verification이 흔한 원인입니다.

에이전트가 workflow를 무시하면 아래 프롬프트를 붙여 넣으세요.

```text
README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.md를 읽어라.
구현 전 `npx ph workflow implement`를 실행하라.
검증 명령은 가능하면 `npx ph bearshell`로 실행하라.
구현 후 `.persona/workflow/implementation-report.md`와 `.persona/workflow/review-report.md`를 채워라.
`npx ph plan --report-filled implementation`, `npx ph plan --report-filled review`, `npx ph workflow finish implement`를 실행하라.
finish가 실패하면 완료라고 말하지 말고 blocker를 먼저 고쳐라.
```

## 보장하지 않는 것

- generated application quality certification
- token saving
- product-efficacy 또는 navigation-benefit proof
- Clean Code guarantee
- broad AST/linter enforcement
- full TDD framework, test scaffolding, coverage, mutation testing
- frontend, infra, desktop workflow productization
- OpenCode 없는 완전한 workflow

`ph bearshell`은 sandbox가 아닙니다. 실행 시간과 출력 크기를 제한하지만, 명령은 여전히 사용자의 머신에서 실행됩니다.

## 문서

- [Changelog](CHANGELOG.md)
- [Release notes](docs/current/release/README.md)
- [Acceptance test checklist](docs/current/acceptance-test-checklist.md)
- [Java backend MVP install guide](docs/current/java-backend-mvp-install-guide.md)

## 라이선스

Apache-2.0. See [LICENSE](LICENSE).
