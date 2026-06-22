# Persona Harness

Java/Spring backend Clean Code workflow pilot for OpenCode.

Persona Harness helps an agent start from a clean project, ask for backend context, write an architecture plan, and generate code with a consistent Java/Spring structure.

The `ph` commands are primarily an AI-facing workflow surface. Humans install and initialize the harness, then ask OpenCode or Codex-style TUI in plain language. The agent should run the `ph` commands, record workflow evidence, and report what it did.

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

After setup, you should not need to memorize the workflow commands. For planning, ask OpenCode to use the generated prompt:

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "$(npx ph plan --prompt)"
```

If you prefer the OpenCode TUI, open it from the project root:

```bash
opencode
```

Then paste the output of:

```bash
npx ph plan --prompt
```

Accept the plan when it is good enough:

```bash
npx ph plan --status
npx ph plan --accept
```

Then use a short implementation request. The injected workflow should make the agent run `npx ph workflow start implement`, `npx ph bearshell`, the report-fill commands, and `npx ph workflow finish implement` itself:

```text
README 보고 계획대로 구현해줘.
```

If the agent misses the workflow, use the stricter prompt:

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.md를 읽고 plan이 accepted 상태인지 확인한 뒤 Java/Spring Gradle 기반으로 요구사항 전체를 구현해줘. 명령 실행은 가능하면 npx ph bearshell로 하고, 구현 후 npx ph bearshell gradle test, npx ph bearshell gradle build, 실행 가능한 Spring Boot 앱이면 npx ph bearshell --shell 'gradle bootRun --args=\"--server.port=<port>\"', HTTP happy path와 failure path smoke를 실행해줘. .persona/workflow/implementation-report.md와 .persona/workflow/review-report.md를 채우고 npx ph plan --report-filled implementation 및 npx ph plan --report-filled review를 실행해줘."
```

## What You Get

These commands are meant to be visible and easy for agents to call from OpenCode/Codex-style sessions:

- `ph init`: installs `.persona/rules`, `.persona/harness.jsonc`, and OpenCode plugin config.
- `ph intake --interactive`: asks backend project questions and writes `.persona/project-profile.jsonc`.
- `ph policy init`: creates company and personal backend policy overlay files.
- `ph plan`: creates `.persona/workflow/plan.md` for the `blackbear` planning role.
- `ph bearshell`: runs timeout-bounded and output-bounded shell commands through the Persona Harness command surface.
- `ph history`: snapshots used workflow artifacts into `.persona/workflow/history/`.
- `ph workflow check`: reports the current plan/report/evidence status.
- `ph workflow start implement`: prints the AI-facing implementation rail after the accepted-plan workflow state is ready.
- `ph workflow finish implement`: blocks completion reporting until workflow reports/evidence are ready.
- `ph workflow guard implement/final`: lower-level strict gates used by the workflow rails.
- `ph doctor`: diagnoses local OpenCode and Persona Harness integration.
- `ph smoke`, `ph feedback`, `ph evidence summary`, `ph review backend-shape`: produce report-only workflow and quality-shape artifacts.
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
- `ph bearshell` is not a sandbox. It limits runtime and output size, but commands still run on your machine.

## For Humans

1. Write a short product README in a clean Java/Spring backend project.
2. Run `npx ph init`.
3. Run `npx ph intake --interactive` and answer the backend planning questions.
4. Run `npx ph policy init` if you want company or personal guidance.
5. Run `npx ph plan`.
6. Let OpenCode fill the plan only.
7. Review and accept the plan.
8. Ask OpenCode in plain language to implement from the accepted plan.
9. Check Gradle build, generated structure, and workflow reports.

## For Agents

Treat `ph` as your workflow command surface. Do not wait for the human to manually run every command once setup is complete.

Read these files before implementation:

- `README.md`
- `.persona/project-profile.jsonc`
- `.persona/policies/`
- `.persona/workflow/plan.md`

Do not skip the plan state. If the plan is not accepted, finish or revise the plan first.

Before coding from a short implementation request, run:

```bash
npx ph workflow start implement
```

Prefer `npx ph bearshell` for repo inspection, Gradle verification, and large command output.

After implementation, fill:

- `.persona/workflow/implementation-report.md`
- `.persona/workflow/review-report.md`

Then run:

```bash
npx ph plan --report-filled implementation
npx ph plan --report-filled review
npx ph workflow finish implement
```

## Docs

- [Changelog](CHANGELOG.md)
- [Release checklist](docs/current/release/release-checklist.md)
- [Release notes template](docs/current/release/release-notes-template.md)
- [Detailed usage notes](docs/current/persona-harness-detailed-usage.md)
- [Alpha publish readiness](docs/current/v0.3.0-alpha-publish-readiness.md)
- [External tester guide](docs/current/v0.3.1-external-tester-guide.md)
- [External tester feedback template](docs/current/v0.3.1-external-tester-feedback-template.md)
- [Java backend MVP install guide](docs/current/java-backend-mvp-install-guide.md)
- [Project progress board](docs/project-progress-board.md)

## License

Apache-2.0. See [LICENSE](LICENSE).
