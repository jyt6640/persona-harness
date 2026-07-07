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

**[Start Here](docs/START-HERE.md) · [Quick Demo](docs/QUICK-DEMO.md) · [Measured Claims](docs/MEASURED-CLAIMS.md)**

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

> AI 에이전트는 "다 됐습니다!"라고 말하기를 좋아합니다 — Persona Harness는 그것을 증명하게 만듭니다. 필요한 report, PH가 생성한 evidence, 실제 테스트 결과가 디스크에 존재하기 전까지 완료 주장을 차단하는 로컬 CLI 완료 게이트입니다.

> [!IMPORTANT]
> **Alpha, gate-first, 측정 기반.** Stable: `persona-harness@latest=0.6.0` (`next=0.6.0-rc.4`). runtime injection은 accepted 10-pair fixture에서 **negative**로 측정됐고, 따라서 runtime guidance는 **default-off / opt-in**이며 제품 중심이 아닙니다. [`injection-value-status.json`](docs/current/injection-value-status.json) 참고. PH가 주장하는 것은 좁습니다: **명시적으로 정의된 evidence gate와 결정론적 위반에 대해 검증되지 않은 완료를 차단한다.**

## 측정된 동작 (Measured Behavior)

대부분의 에이전트 하네스 프로젝트와 달리, PH는 실제로 측정한 것을 — 부정적 결과까지 — 공개합니다.

- **위조된 TDD evidence**를 `workflow finish` 전에 심음 → `finish`가 **exit 1**, 위조 파일 무시.
- **Green-only 완료**(TDD rail on) → 차단 **5/5** (off일 때는 허용 5/5).
- **runtime injection**, 10쌍 OpenCode run → 성공률 동일(둘 다 10/10)이지만 PH ON이 10쌍 전부 비용 증가 → **default-off** 유지.

제한된 로컬 fixture에서의 completion-integrity 측정입니다 — 토큰 절약/앱 품질/제품 효능 주장이 *아닙니다*. 전체 경계와 근거: **[docs/MEASURED-CLAIMS.md](docs/MEASURED-CLAIMS.md)**.

## 이게 뭔가요

AI 에이전트가 수행하는 Java/Spring 백엔드 작업을 위한 workflow + evidence CLI(`ph`)와 선택적 OpenCode 플러그인입니다. 하는 일:

- 프로젝트 아이디어나 README를 구현 ticket으로 분할
- 에이전트를 반복 가능한 백엔드 workflow 위에 유지
- 제한된 명령 실행으로 검증
- 무엇을 읽고 실행하고 완료했는지 로컬 evidence로 기록
- **필요한 report/evidence가 없으면 완료를 차단**

코드 품질 보장, 토큰 절약 제품, broad linter, generated app이 production-ready라는 증명이 **아닙니다**. 완료 게이트보다 넓은 모든 주장은 먼저 측정으로 획득해야 합니다 — [MEASURED-CLAIMS](docs/MEASURED-CLAIMS.md) 참고.

## 설치

Node.js 20+, Java 21+ / Gradle, 그리고 프로바이더가 설정된 OpenCode CLI가 필요합니다.

```bash
# OpenCode
curl -fsSL https://opencode.ai/install | bash   # 또는: npm install -g opencode-ai
opencode auth login

# Persona Harness
npm install -D persona-harness
npx ph --help && npx ph doctor
```

## 빠른 시작

깨끗한 프로젝트 디렉터리를 사용하세요 (Persona Harness repo 자체 금지).

```bash
mkdir -p /tmp/ph-demo && cd /tmp/ph-demo && npm init -y
npm install -D persona-harness

npx ph init                 # 최소 통합 파일만 생성
npx ph bootstrap backend    # AGENTS.md, profile, plan, report 템플릿
npx ph workflow check
```

그다음 OpenCode에서 에이전트에게 당신의 `README.md`를 구현하도록 요청하세요. 에이전트는 스스로 rail을 돌리고 `npx ph workflow finish implement`로 끝내야 합니다.

> [!NOTE]
> `workflow finish`가 실패하면 에이전트는 완료를 주장하기 전에 보고된 blocker를 고쳐야 합니다. **그 실패는 버그가 아니라 제품이 작동하는 것입니다.**

샘플 Todo API와 아이디어-우선 흐름을 포함한 전체 안내: **[Quick Demo](docs/QUICK-DEMO.md)**.

## TDD Rail (opt-in)

`.persona/harness.jsonc`에서 두 설정을 모두 켭니다:

```json
{ "enforce": { "executeVerification": true, "tdd": true } }
```

그러면 `ph workflow test`는 **PH가 직접 실행한 Gradle/JUnit 실패로부터만** red evidence를 기록합니다 — 에이전트가 보고한 evidence는 절대 받지 않습니다. 이후 `workflow check` / `archive` / `finish`가 같은 ticket/test id의 green evidence를 기록합니다. red-first 완료 게이트이며, 테스트 scaffolding·충분성 증명·coverage/mutation·앱 품질 인증은 하지 않습니다.

## 명령

```bash
npx ph workflow check | implement | finish implement | archive <ticket-id>
npx ph workflow split README.md && npx ph workflow next   # 멀티 ticket
npx ph bearshell --shell 'gradle test'                    # 제한된 실행
npx ph evidence summary | metrics --json | ab-report --json | pminus-report --json
npx ph review backend-shape
```

전체 목록은 `npx ph --help`. workflow 장부는 `.persona/workflow/`(`work/`, `history/`, `requirements/`)에 있습니다.

## 선택적 통합 (opt-in preview)

```bash
npx ph bootstrap backend --codegraph-preview          # CodeGraph
npx ph bootstrap backend --lsp-preview                # Java LSP
npx ph bootstrap backend --runtime-injection-preview  # parked model-facing guidance
npx ph bootstrap backend --no-developer-mcp           # 기본 developer MCP 비활성화
```

preview wrapper는 외부 도구가 없으면 성공을 위조하지 않고 **unavailable** 상태를 보고합니다. runtime injection은 parked(negative 측정)이며 권장 경로가 아닙니다.

## 경계와 안전

Evidence는 하나의 질문에만 답합니다 — *"에이전트가 기대된 rail을 보고 따랐는가?"* — 그 이상은 아닙니다. PH는 앱 품질 인증, 토큰 절약, Clean Code 보장, broad AST/linter 강제, full TDD 프레임워크, closure 보장, OpenCode 없는 완전한 workflow를 **약속하지 않습니다**. 정본 목록은 [MEASURED-CLAIMS](docs/MEASURED-CLAIMS.md)에 있습니다.

> [!WARNING]
> `ph bearshell`은 **샌드박스가 아닙니다**. 실행 시간과 출력 크기를 제한하지만, 명령은 여전히 당신의 머신에서 당신의 권한으로 실행됩니다. [SECURITY](SECURITY.md) 참고.

## 문서

- **새 사용자** → [Start Here](docs/START-HERE.md) · [Quick Demo](docs/QUICK-DEMO.md) · [Measured Claims](docs/MEASURED-CLAIMS.md)
- **설치 & 백엔드 형태** → [MVP 설치 가이드](docs/current/java-backend-mvp-install-guide.md)
- **기여자** → [CONTRIBUTING](CONTRIBUTING.md) · [ROADMAP](ROADMAP.md) · [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md)
- **릴리스 & 측정** → [v0.6.0 캡슐](docs/releases/v0.6.0/README.md) · [패키지 인덱스](docs/releases/package-index.md) · [docs/current](docs/current/README.md) · [Changelog](CHANGELOG.md)

## 기여

기여를 환영합니다 — 부정적 측정 결과도 포함해서요. PH는 증거가 뒷받침하는 것만 주장하며, 주장을 넓히는 PR은 그 측정을 함께 가져와야 합니다. [CONTRIBUTING.md](CONTRIBUTING.md)부터 읽어주세요.

## 라이선스

Apache-2.0. [LICENSE](LICENSE)를 보세요.
