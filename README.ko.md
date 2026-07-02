<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

<img src="img/Persona-Harness-Logo.png" alt="Persona Harness 로고" width="180">

# Persona Harness

**Java/Spring 백엔드를 만드는 AI 코딩 에이전트를 위한 완료 게이트.**

[![npm version](https://img.shields.io/npm/v/persona-harness?color=369eff&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![npm downloads](https://img.shields.io/npm/dt/persona-harness?color=ff6b35&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![node](https://img.shields.io/badge/node-%3E%3D20-c4f042?labelColor=black&style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-white?labelColor=black&style=flat-square)](./LICENSE)

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

> AI 에이전트는 "다 됐습니다!"라고 말하기를 좋아합니다 — Persona Harness는 그것을 증명하게 만듭니다. 필요한 report, PH가 생성한 evidence, 실제 테스트 결과가 디스크에 존재하기 전까지 완료 주장을 차단하는 로컬 CLI completion gate입니다. OpenCode runtime guidance는 선택형 preview이지 제품의 중심이 아닙니다.

> [!IMPORTANT]
> **프로젝트 상태: gate-first measured release.**
> 안정 npm 채널은 `persona-harness@latest=0.5.0`입니다. prerelease 채널은 `next=0.5.0-rc.2`, alpha는 `0.3.9-alpha.8`을 유지합니다.
> runtime injection 효과는 측정되었고 **승인된 10쌍 local-current OpenCode fixture에서는 부정적**이었습니다. 근거는 [`docs/current/injection-value-status.json`](docs/current/injection-value-status.json)에 있습니다. 따라서 runtime guidance는 기본 꺼짐이며 명시적 opt-in preview입니다. 이 결과는 해당 fixture 범위의 측정이지 보편적 product-efficacy 주장이 아닙니다.
> PH가 실제로 주장하는 것 — 그리고 증거를 가진 것 — 은 더 좁습니다: **명시적으로 정의된 evidence gate와 결정론적 위반에 대해, 검증되지 않은 완료를 차단한다.**

## 측정된 동작

대부분의 에이전트 하네스 프로젝트와 달리, PH는 실제로 측정한 것을 — 부정적 결과까지 포함해 — 공개합니다.

| 시나리오 | 결과 | 근거 |
| :--- | :--- | :--- |
| **위조된 TDD evidence** — 수기로 만든 `red-forged.json`을 `workflow finish` 전에 심어둠 | `finish`가 **exit 1** — 위조 파일 무시 | P0 실제 Gradle run 아카이브 |
| **Green-only 완료** (테스트+구현 동시, red-first 없음) — 각 5회 반복 | TDD OFF: 허용 **5/5** · TDD ON: 차단 **5/5** | P1 completion-integrity A/B |
| **컴파일 에러를 "red"로 속임** | `workflow test`가 **exit 1**, evidence 미생성 | P0 실제 Gradle run 아카이브 |
| Runtime injection PH OFF/ON app-generation — 10 paired OpenCode runs | PH ON **10/10**, PH OFF **10/10** 성공. 다만 PH ON이 provider-token total, read chars, tool calls, elapsed time을 모든 10쌍에서 증가시킴 | accepted local-current A/B archive |

이것은 제한된 로컬 fixture에서의 completion-integrity 측정입니다. 토큰 절약, 앱 품질, 제품 효능 주장이 *아닙니다*.

## TL;DR

> Q. 이게 뭔가요?

AI 에이전트가 수행하는 Java/Spring 백엔드 작업을 위한 workflow/evidence CLI + completion guard입니다. 로컬 CLI(`ph`)와 선택형 runtime guidance/measurement hook용 OpenCode 플러그인으로 제공됩니다.

> Q. 실제로 뭘 하나요?

- 프로젝트 아이디어나 README를 구현 ticket으로 분할
- 에이전트를 반복 가능한 백엔드 workflow 위에 유지
- 제한된 명령 실행으로 검증 수행
- 무엇을 읽고 실행하고 완료했는지 로컬 evidence로 기록
- **필요한 report/evidence가 없으면 완료를 차단**

> Q. 코드 품질 보장이나 토큰 절약, linter 대체가 되나요?

아니요. 코드 품질 보장, 토큰 절약 제품, broad linter, generated app이 production-ready라는 증명이 아닙니다. 완료 게이트보다 넓은 모든 주장은 먼저 측정으로 획득해야 한다 — 이 규칙 자체가 프로젝트의 일부입니다.

## 설치

필요한 것:

- Node.js 20+, npm
- Java 21+, Gradle
- 모델/프로바이더가 설정된 OpenCode CLI

```bash
# OpenCode
curl -fsSL https://opencode.ai/install | bash   # 또는: npm install -g opencode-ai
opencode auth login

# Persona Harness
npm install -D persona-harness
npx ph --help
npx ph init
npx ph doctor
```

## 빠른 시작 — Java/Spring 백엔드

깨끗한 프로젝트 디렉터리를 사용하세요. Persona Harness 저장소 자체에서 첫 스모크 테스트를 하지 마세요.

```bash
mkdir -p /tmp/persona-harness-demo && cd /tmp/persona-harness-demo
npm init -y
npm install -D persona-harness
```

앱과 제약을 설명하는 짧은 `README.md`를 만듭니다:

```bash
cat > README.md <<'EOF'
# Todo API

Build a Java 21 Spring Boot REST API with Gradle.

## Requirements
- Users can create todos.
- Users can list todos.
- Users can mark a todo completed.
- Missing todos return an appropriate error response.

## Technical Constraints
- Java 21, Spring Boot 3, Gradle only, REST API only
- Start with in-memory persistence if needed.
- Controllers delegate to application services.
- Repository interfaces live in domain; implementations in infrastructure.
- Application services must not own storage state or id sequences.
EOF
```

초기화:

```bash
npx ph init
npx ph bootstrap backend
npx ph workflow check
```

`ph init`은 최소 통합 파일만 만듭니다(`.persona/harness.jsonc`, `.persona/conventions/`, `.persona/rules/`, `.opencode/opencode.json`, `.gitignore` 항목). `ph bootstrap backend`는 백엔드 workflow 전체를 준비합니다: `AGENTS.md`, `.persona/project-profile.jsonc`, policy overlay, 승인된 plan, report 템플릿, OpenCode 설정. 새 setup은 gate-first입니다: model-facing runtime guidance는 명시적으로 켜기 전까지 꺼져 있습니다.

그다음 OpenCode에서 에이전트에게 짧게 요청합니다:

```text
Read README.md and implement it.
```

에이전트가 스스로 rail을 실행해야 합니다:

```text
npx ph workflow implement
npx ph bearshell ...
npx ph plan --report-filled implementation
npx ph plan --report-filled review
npx ph workflow finish implement
```

> [!NOTE]
> `workflow finish`가 실패하면 에이전트는 완료를 주장하기 전에 보고된 blocker를 고쳐야 합니다. 그 실패는 버그가 아니라 제품이 작동하는 것입니다.

## README 대신 아이디어에서 시작하기

에이전트에게 아이디어를 말합니다:

```text
todo 웹 서비스를 만들고 싶어.
```

에이전트는 코딩을 시작하지 않고 요구사항 초안부터 작성해야 합니다:

```text
npx ph workflow draft --stdin
```

`.persona/workflow/requirements/`의 산출물(`backlog.md`, `questions.md`, `assumptions.md`)을 검토한 뒤 `진행해.`라고 말하면 에이전트가 실행합니다:

```text
npx ph workflow approve requirements
npx ph workflow split .persona/workflow/requirements/backlog.md
npx ph workflow next
npx ph workflow implement
```

## 여러 Ticket으로 작업하기

```bash
npx ph workflow split README.md
npx ph workflow next
# ... 구현 & 리뷰 ...
npx ph workflow archive <ticket-id>
npx ph workflow next
```

workflow 장부는 `.persona/workflow/`에 있습니다: 진행 중 작업은 `work/`, 완료 이력은 `history/`, 요구사항 원본은 `requirements/`.

## TDD Rail (opt-in)

두 설정을 모두 켜야 동작합니다:

```json
{
  "enforce": {
    "executeVerification": true,
    "tdd": true
  }
}
```

켜져 있으면 `ph workflow test`는 **PH가 직접 실행한 Gradle/JUnit 실패로부터만** red evidence를 기록합니다 — 에이전트가 보고한 evidence는 절대 받지 않습니다. 이후 `workflow check` / `archive` / `finish`가 같은 ticket/test id에 대한 green evidence를 기록합니다.

이것은 red-first 완료 게이트입니다. 테스트 scaffolding, 테스트 충분성 증명, coverage, mutation testing, 앱 품질 인증은 하지 않습니다.

## 유용한 명령

```bash
# 설정
npx ph init && npx ph bootstrap backend && npx ph doctor

# Workflow
npx ph workflow check
npx ph workflow implement
npx ph workflow finish implement
npx ph workflow archive <ticket-id>

# 제한된 명령 실행
npx ph bearshell --shell 'gradle test'

# Evidence와 report
npx ph evidence summary
npx ph evidence metrics --json
npx ph evidence ab-report --json
npx ph evidence pminus-report --json
npx ph review backend-shape

# 명시적 로컬 A/B evidence 기록
npx ph evidence ab-run --scenario demo --condition baseline -- ./gradlew test
```

Stable 빌드에는 read-only surface decision summary인 `npx ph evidence pminus-status --json`도 포함됩니다.

## 선택적 통합

기본 backend bootstrap은 원격 developer MCP 도구 `grep_app`과 `context7`을 등록합니다.

```bash
npx ph bootstrap backend --codegraph-preview   # CodeGraph, opt-in
npx ph bootstrap backend --lsp-preview         # LSP, opt-in
npx ph bootstrap backend --runtime-injection-preview  # 선택형 model-facing PH guidance
npx ph bootstrap backend --no-developer-mcp    # developer MCP 비활성화
```

> [!NOTE]
> 두 wrapper 모두 preview 표면입니다. 필요한 외부 도구가 없으면 성공을 위조하지 않고 **unavailable** 상태를 보고합니다.

## Evidence의 의미

`.persona/evidence`는 로컬 흔적을 저장합니다: 파일 읽기, 선택형 주입 workflow 컨텍스트, 명령 활동, TDD 기록, A/B 측정.

Evidence는 하나의 질문에 답합니다: **"에이전트가 기대된 rail을 보고 따랐는가?"**

Evidence가 증명하지 **않는** 것: generated app 품질, 토큰 절약, 제품 효능, full TDD coverage, broad reliability, 모든 경우의 성공적 closure.

## 권장 백엔드 형태

Persona Harness는 Java/Spring 프로젝트를 다음 방향으로 유도합니다:

- Gradle-first Java/Spring 백엔드
- `presentation` / `application` / `domain` / `infrastructure` / `global` 패키지 경계
- Controller는 application service에 위임
- Application service는 storage 상태나 id sequence를 직접 소유하지 않고 유스케이스를 조율
- Repository 인터페이스는 `domain`에, 구현은 `infrastructure`에
- 행위를 가진 도메인 객체
- 명시적 request/response DTO 경계

이것은 유도 목표와 리뷰 단서이지, 품질 보증이 아닙니다.

## 문제 해결

```bash
npm view persona-harness dist-tags --json
opencode --version
```

`ph workflow check`가 경고를 보고하면 나열된 blocker를 확인하세요. 구현 전에는 template report 경고가 정상입니다. 구현 후 흔한 blocker는 누락된 evidence, 채워지지 않은 report, rail을 우회한 검증입니다.

에이전트가 workflow를 무시하면 더 엄격한 프롬프트를 붙여넣으세요:

```text
Read README.md, .persona/project-profile.jsonc, .persona/policies, and .persona/workflow/plan.md.
Before implementing, run `npx ph workflow implement`.
Use `npx ph bearshell` for verification commands where possible.
After implementation, fill `.persona/workflow/implementation-report.md` and `.persona/workflow/review-report.md`.
Run `npx ph plan --report-filled implementation`, `npx ph plan --report-filled review`, and `npx ph workflow finish implement`.
If finish fails, do not claim completion. Fix the reported blocker first.
```

## Persona Harness가 약속하지 않는 것

- generated application 품질 인증
- 토큰 절약
- 제품 효능이나 navigation-benefit 증명
- Clean Code 보증
- broad AST/linter 강제
- full TDD 프레임워크, 테스트 scaffolding, coverage, mutation testing
- frontend, infrastructure, desktop workflow 제품화
- OpenCode 없는 완전한 workflow

> [!WARNING]
> `ph bearshell`은 샌드박스가 아닙니다. 실행 시간과 출력 크기를 제한하지만, 명령은 여전히 당신의 머신에서 실행됩니다.

## 문서

- [Changelog](CHANGELOG.md)
- [Release notes](docs/current/release/README.md)
- [인수 테스트 체크리스트](docs/current/acceptance-test-checklist.md)
- [Java backend MVP 설치 가이드](docs/current/java-backend-mvp-install-guide.md)

## 라이선스

Apache-2.0. [LICENSE](LICENSE)를 보세요.
