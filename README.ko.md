# Persona Harness

OpenCode를 위한 Java/Spring backend Clean Code workflow pilot.

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

Persona Harness는 에이전트가 빈 프로젝트에서 시작해 backend 맥락을 묻고, 구현 전 architecture plan을 남긴 뒤, 더 균일한 Java/Spring 구조로 코드를 만들도록 돕습니다.

> 현재 범위: Java/Spring backend MVP.
> frontend, infra, desktop app, AST/linter enforcement, 완전한 TDD workflow는 후속 트랙입니다.

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
npx ph intake --interactive
npx ph policy init
npx ph plan
```

Persona Harness 자체를 개발 중이면 local install을 사용합니다.

```bash
npm install -D /absolute/path/to/persona-harness
npx ph init
npx ph intake --interactive
npx ph policy init
npx ph plan
```

먼저 OpenCode에게 계획만 완성하게 합니다.

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "$(npx ph plan --prompt)"
```

계획이 충분하면 수락합니다.

```bash
npx ph plan --status
npx ph plan --accept
```

그 다음 구현을 요청합니다.

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.md를 읽고 plan이 accepted 상태인지 확인한 뒤 Java/Spring Gradle 기반으로 요구사항 전체를 구현해줘. 명령 실행은 가능하면 npx ph bearshell로 하고, 구현 후 npx ph bearshell gradle test, npx ph bearshell gradle build, 실행 가능한 Spring Boot 앱이면 npx ph bearshell --shell 'gradle bootRun --args=\"--server.port=<port>\"', HTTP happy path와 failure path smoke를 실행해줘. .persona/workflow/implementation-report.md와 .persona/workflow/review-report.md를 채우고 npx ph plan --report-filled implementation 및 npx ph plan --report-filled review를 실행해줘."
```

## 제공하는 것

- `ph init`: `.persona/rules`, `.persona/harness.jsonc`, OpenCode plugin config 설치
- `ph intake --interactive`: backend planning 질문 후 `.persona/project-profile.jsonc` 생성
- `ph policy init`: 회사/개인 backend policy overlay 파일 생성
- `ph plan`: `blackbear` planning role용 `.persona/workflow/plan.md` 생성
- `ph bearshell`: bounded shell command helper
- `ph history`: 사용한 workflow artifact를 `.persona/workflow/history/`에 보존
- OpenCode injection: 관련 파일을 읽을 때 Java/Spring backend Clean Code context 주입

## 권장하는 코드 모양

- Gradle 기반 Java/Spring backend
- `presentation`, `application`, `domain`, `infrastructure`, `global` 경계
- Controller는 Service에 위임
- Application Service는 use case 흐름만 담당하고 저장소 상태/id sequence를 직접 소유하지 않음
- Domain은 단순 record가 아니라 자기 필드로 판단과 행동을 가짐
- Repository interface는 domain, 구현체는 infrastructure에 위치
- Request/response DTO boundary 명확화

## 보장하지 않는 것

- generated app product quality 인증
- AST/linter/build failure 기반 rule enforcement
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

## License

Apache-2.0. See [LICENSE](LICENSE).
