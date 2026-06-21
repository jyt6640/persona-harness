# Persona Harness

Java/Spring backend Clean Code workflow pilot for OpenCode.

Persona Harness helps an agent start from a clean project, ask for backend context, write an architecture plan, and generate code with a consistent Java/Spring structure.

[한국어](#한국어) | [English](#english) | [日本語](#日本語) | [简体中文](#简体中文)

> Current scope: Java/Spring backend MVP.
> Frontend, infra, desktop app, AST/linter enforcement, and full TDD workflow are future tracks.

## Quick Start

Alpha package flow, after npm alpha publish:

```bash
npm install -D persona-harness@alpha
npx ph init
npx ph intake --interactive
npx ph policy init
npx ph plan
```

Local development flow, before public publish:

```bash
npm install -D /absolute/path/to/persona-harness
npx ph init
npx ph intake --interactive
npx ph policy init
npx ph plan
```

Then ask OpenCode to plan first:

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.md를 읽고 구현하지 말고 architecture/technology plan만 완성해줘."
```

Accept the plan when it is good enough:

```bash
npx ph plan --status
npx ph plan --accept
```

Then ask OpenCode to implement:

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.md를 읽고 plan이 accepted 상태인지 확인한 뒤 Java/Spring Gradle 기반으로 요구사항 전체를 구현해줘. 구현 후 gradle test, gradle build, gradle bootRun, HTTP happy path와 failure path smoke를 실행하고 .persona/workflow/implementation-report.md와 .persona/workflow/review-report.md를 채워줘."
```

## What You Get

- `ph init`: installs `.persona/rules`, `.persona/harness.jsonc`, and OpenCode plugin config.
- `ph intake --interactive`: asks backend project questions and writes `.persona/project-profile.jsonc`.
- `ph policy init`: creates company and personal backend policy overlay files.
- `ph plan`: creates `.persona/workflow/plan.md` for the `blackbear` planning role.
- `ph bearshell`: runs bounded shell commands through the Persona Harness command surface.
- `ph history`: snapshots used workflow artifacts into `.persona/workflow/history/`.
- OpenCode injection: adds Java/Spring backend Clean Code context when the agent reads relevant project files.

## What It Encourages

- Gradle-first Java/Spring backend projects.
- `presentation`, `application`, `domain`, `infrastructure`, and `global` package boundaries.
- Controller delegates to Service.
- Application Service orchestrates use cases and does not own storage state or id sequence.
- Domain owns business decisions through behavior, not passive records only.
- Repository interface lives in domain, implementation lives in infrastructure.
- Request/response DTO boundary is explicit.

## What It Does Not Promise

- It does not certify generated app product quality.
- It does not enforce rules through AST, linter, or build failure gates.
- It does not prove tests are sufficient.
- It does not productize frontend, infra, or desktop workflows yet.
- It is not the final TDD workflow yet.

## For Humans

1. Write a short product README in a clean Java/Spring backend project.
2. Run `npx ph init`.
3. Run `npx ph intake --interactive` and answer the backend planning questions.
4. Run `npx ph policy init` if you want company or personal guidance.
5. Run `npx ph plan`.
6. Let OpenCode fill the plan only.
7. Review and accept the plan.
8. Let OpenCode implement from the accepted plan.
9. Check Gradle build, generated structure, and workflow reports.

## For Agents

Read these files before implementation:

- `README.md`
- `.persona/project-profile.jsonc`
- `.persona/policies/`
- `.persona/workflow/plan.md`

Do not skip the plan state. If the plan is not accepted, finish or revise the plan first.

After implementation, fill:

- `.persona/workflow/implementation-report.md`
- `.persona/workflow/review-report.md`

## Docs

- [Detailed usage notes](docs/current/persona-harness-detailed-usage.md)
- [Alpha publish readiness](docs/current/v0.3.0-alpha-publish-readiness.md)
- [External tester guide](docs/current/v0.3.0-external-tester-guide.md)
- [External tester feedback template](docs/current/v0.3.0-external-tester-feedback-template.md)
- [Java backend MVP install guide](docs/current/java-backend-mvp-install-guide.md)
- [Project progress board](docs/project-progress-board.md)

## 한국어

Persona Harness는 OpenCode에서 Java/Spring 백엔드 프로젝트를 더 균일한 Clean Code 구조로 생성하도록 돕는 하네스입니다.

현재 목표는 “0에서 바로 90점짜리 프로젝트를 만든다”에 가깝습니다. 먼저 프로젝트 맥락을 묻고, 구현 전에 architecture/technology plan을 남긴 뒤, 그 계획을 기준으로 구현하게 합니다.

가장 중요한 기준은 다음입니다.

- Gradle 기반
- `presentation/application/domain/infrastructure/global` 경계
- Service는 저장소 상태나 id sequence를 직접 소유하지 않음
- domain은 단순 record가 아니라 자기 필드로 판단과 행동을 가짐
- domain에는 repository port, infrastructure에는 repository 구현체

## English

Persona Harness is an OpenCode plugin workflow for Java/Spring backend projects.

It helps agents ask for backend context, write a plan first, and generate code with a consistent Clean Code shape. The current MVP focuses on Java/Spring backend generation, not frontend, infra, desktop, enforcement, or product-quality certification.

Use it when you want a generated backend to follow a stable structure instead of drifting into ad hoc controllers, passive domains, or service-owned storage.

## 日本語

Persona Harness は OpenCode 向けの Java/Spring バックエンド用ワークフロープラグインです。

実装前にプロジェクト情報を整理し、architecture/technology plan を作り、その計画を読ませてから実装させることを目的にしています。

現在の MVP は Java/Spring backend Clean Code に限定されています。frontend、infra、desktop、AST/linter enforcement、完全な TDD workflow はまだ対象外です。

## 简体中文

Persona Harness 是面向 OpenCode 的 Java/Spring 后端工作流插件。

它会先收集项目背景，生成 architecture/technology plan，然后让代理基于已确认的计划实现代码。当前 MVP 只面向 Java/Spring backend Clean Code，不承诺前端、基础设施、桌面应用、AST/linter 强制检查或最终产品质量认证。

适合用于验证生成代码是否能稳定保持 Controller、Service、Domain、Repository、DTO 等边界。

## License

Apache-2.0. See [LICENSE](LICENSE).
