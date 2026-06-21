# Persona Harness

Java/Spring backend Clean Code workflow pilot for OpenCode.

Persona Harness helps an agent start from a clean project, ask for backend context, write an architecture plan, and generate code with a consistent Java/Spring structure.

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

> Current scope: Java/Spring backend MVP.
> Frontend, infra, desktop app, AST/linter enforcement, and full TDD workflow are future tracks.

## Requirements

- Node.js 20+
- npm
- OpenCode terminal CLI
- A model/provider configured in OpenCode

## Quick Start

Install OpenCode first. The official OpenCode docs recommend the install script, or a global npm install:

```bash
curl -fsSL https://opencode.ai/install | bash
```

or:

```bash
npm install -g opencode-ai
```

Verify it:

```bash
opencode --version
opencode
```

Connect a model provider in OpenCode:

```bash
opencode auth login
opencode auth list
```

You can also open the OpenCode TUI and run:

```text
/connect
/models
```

Use model IDs in `provider/model` format, for example `openai/gpt-5.4-mini-fast`.

Then install Persona Harness in your Java/Spring backend project:

```bash
npm install -D persona-harness@alpha
npx ph init
npx ph intake --interactive
npx ph policy init
npx ph plan
```

If you are developing Persona Harness itself, use a local install instead:

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
- It is not useful as a full agent workflow without OpenCode.

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

- [Changelog](CHANGELOG.md)
- [Release checklist](docs/current/release/release-checklist.md)
- [Release notes template](docs/current/release/release-notes-template.md)
- [Detailed usage notes](docs/current/persona-harness-detailed-usage.md)
- [Alpha publish readiness](docs/current/v0.3.0-alpha-publish-readiness.md)
- [External tester guide](docs/current/v0.3.0-external-tester-guide.md)
- [External tester feedback template](docs/current/v0.3.0-external-tester-feedback-template.md)
- [Java backend MVP install guide](docs/current/java-backend-mvp-install-guide.md)
- [Project progress board](docs/project-progress-board.md)

## License

Apache-2.0. See [LICENSE](LICENSE).
