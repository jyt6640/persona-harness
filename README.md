# Persona Harness

Persona Harness is an OpenCode plugin and local CLI for AI coding workflow rails, evidence traces, and continuation control. Its current product direction is a workflow rail product, not an eval-superiority proof project.

It helps an AI agent start from a clean project, read your backend requirements, follow an implementation rail, leave evidence of what it read/injected/ran, continue unfinished tickets, run verification, and fill workflow reports before claiming completion.

It does not certify generated application product quality. The current Java/Spring backend guidance is a stack-steering, workflow-observability, and scoped opt-in closure enforcement surface, not a Clean Code guarantee, broad AST/linter, or general enforcement engine.

## Project Status

Persona Harness is an alpha experiment.

The injection effect has been measured and is not proven. The ON/OFF eval program is stopped; see [`docs/current/injection-value-status.json`](docs/current/injection-value-status.json) for the frozen aggregate, diagnosis, and stopping rationale.

The current value axis is product workflow rail usefulness: making init, doctor, observe, workflow continue/check/finish, and report-only observer surfaces coherent enough for real users to try.

Do not read the current package as generated-app quality certification, evidence that PH beats baselines, broad enforcement, or an AST/linter gate.

Reusable assets remain:

- report-only Java/Spring observer surfaces;
- workflow rails and finish/check guidance;
- a toolchain-fair ON/OFF eval framework;
- honest measurement and observation tooling.

If you only have a product idea, Persona Harness now routes the AI through a requirements draft first. For example, `I want to build a TODO web service` should create `.persona/workflow/requirements/backlog.md` and ask for review instead of starting implementation immediately. Implementation starts after you approve the draft with a phrase such as `proceed`.

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

> Current repo release-prep target: `0.5.0-rc.1` for the `next` dist-tag.
> Current stable package: `persona-harness@latest` is verified at `0.4.0`
> with gitHead `af51e8afa3bdb41e3eb3a2abf003d95bfa7c6055`.
> Until `0.5.0-rc.1` is published, the registry `next` dist-tag remains
> `0.4.0-rc.10`; `alpha` remains `0.3.9-alpha.8`.
>
> Current scope: Java/Spring backend workflow rail MVP.
>
> Not in scope yet: frontend, infra, desktop app, broad AST/linter enforcement,
> generated-app quality certification, token-saving/product-efficacy proof,
> Codex/LSP effectiveness proof, and a full TDD framework/test-sufficiency proof.

## Who This Is For

Use Persona Harness if you want to test whether OpenCode can stay on a Java/Spring backend implementation workflow, preserve readable evidence, continue pending work, and avoid obvious stack drift before it reports completion.

It is especially focused on:

- Gradle-only Java/Spring projects
- `presentation`, `application`, `domain`, `infrastructure`, and `global` package boundaries
- Controller -> Application Service delegation
- Application Service as use-case orchestration, not storage ownership
- Repository interfaces in `domain`
- Repository implementations in `infrastructure`
- domain classes with behavior, not passive records only
- request/response DTO boundaries

Persona Harness is not mainly a CLI for humans to operate step by step. The goal is that humans can ask OpenCode in natural language, while the AI agent calls `ph` commands as its workflow rails.

## What You Need

- Node.js 20+
- npm
- Java 21+
- Gradle
- OpenCode CLI
- an OpenCode model/provider connection

Persona Harness can create local planning files without OpenCode, but the actual rule injection/evidence flow requires OpenCode.

## 1. Install And Check OpenCode

Install OpenCode:

```bash
curl -fsSL https://opencode.ai/install | bash
```

or:

```bash
npm install -g opencode-ai
```

Check that it runs:

```bash
opencode --version
opencode
```

Connect your model provider:

```bash
opencode auth login
opencode auth list
```

You can also use the OpenCode TUI:

```text
/connect
/models
```

Model IDs use OpenCode's `provider/model` format.

Example:

```text
openai/gpt-5.4-mini-fast
```

## 2. Create A Clean Test Project

Use a new folder. Do not run your first test inside the Persona Harness repository.

```bash
mkdir -p /tmp/persona-harness-check
cd /tmp/persona-harness-check
npm init -y
npm install -D persona-harness@latest
```

Check the package and local integration:

```bash
npx ph --help
npx ph init
npx ph doctor
```

Expected:

- `.opencode/opencode.json` exists
- `.persona/harness.jsonc` exists
- `.persona/rules` exists
- `ph doctor` shows OpenCode is present
- `ph doctor` shows the installed Persona package version

## 3. Write The Project README

Persona Harness works from your project requirements. Create a short `README.md` first.

Example:

```bash
cat > README.md <<'EOF'
# Equipment Rental API

Implement an equipment rental REST API with Java/Spring Boot and Gradle.

## Requirements

* Users can register equipment.
* Users can list equipment.
* Users can register members.
* Members can rent equipment.
* Renting fails when equipment is already rented or has insufficient quantity.
* Only the member who rented equipment can return it.
* Missing equipment, members, or rental requests return appropriate error responses.

## Technical Constraints

* Java 21+
* Spring Boot 3.x
* Gradle only
* REST API
* No UI implementation
* Start with a simple in-memory repository if needed.
* Put repository interfaces in the domain package and implementations in the infrastructure package.
* Application services must not directly own storage state or id sequences.
* Domain objects should be classes with state and behavior, not records.
* Separate Controller, Service, Domain, Repository, and DTO responsibilities.
EOF
```

You can use a different domain. For cleaner feedback, avoid the older `reservation`, `roomescape`, or `book loan` examples when testing the current package line.

## 4. Choose The Setup Path

`npx ph init` is the minimal install and OpenCode integration step. It installs `.persona/harness.jsonc`, `.persona/conventions/`, `.persona/rules/`, `.opencode/opencode.json`, and `.gitignore` entries, then exits with next-step guidance.

`npx ph init` does not create `AGENTS.md`, `.persona/project-profile.jsonc`, policy overlay files, an accepted plan, or workflow report templates.

For the normal backend-ready external tester flow:

```bash
npx ph doctor
npx ph init
npx ph bootstrap backend
npx ph workflow check
```

`npx ph bootstrap backend` prepares the backend workflow for AI implementation. It fills missing `AGENTS.md`, `.persona/project-profile.jsonc`, policy overlay files, an accepted `.persona/workflow/plan.md`, implementation/review report templates, harness config, and OpenCode config.

By default, the current backend bootstrap also prepares a remote-only OpenCode developer MCP bundle:

- remote `grep_app`;
- remote `context7`.

The PH CodeGraph wrapper is an external optional integration and is opt-in via
`--codegraph-preview`. It does not run `codegraph init`, does not create
`.codegraph/`, and does not claim token savings, navigation benefit, product
efficacy, or PH-owned CodeGraph behavior. If external CodeGraph is missing or
unusable, the wrapper stays protocol-alive with an honest unavailable `status`
facade instead of exposing fake indexed tools.

Use these opt-outs when you need a smaller or stricter OpenCode config:

```bash
npx ph bootstrap backend --no-developer-mcp
npx ph bootstrap backend --no-codegraph
```

Use explicit opt-in when you want the wrapper-backed CodeGraph registration:

```bash
npx ph bootstrap backend --codegraph-preview
```

If you want to choose the profile manually instead of using the backend-ready bootstrap path:

```bash
npx ph intake --interactive
# or, without an interactive terminal:
npx ph intake --default backend
npx ph policy init
npx ph plan --auto-accept
```

Use the bootstrap path for AI agent shells where interactive prompts are unreliable. Use the intake path when a human wants to choose project profile answers directly in a terminal.

If `.persona/project-profile.jsonc` is missing, draft, malformed, or incomplete, `ph plan` and `ph workflow implement` stop and ask for `ph intake` first. Before implementation, `npx ph workflow check` usually reports `WARN` because implementation and review reports are still templates. That is normal.

## 5. Ask OpenCode To Implement

If you only have an idea, start with that idea instead of forcing a full README first:

```text
I want to build a TODO web service.
```

The agent should not implement yet. It should run or follow:

```text
npx ph workflow draft --stdin
```

Expected draft artifacts:

- `.persona/workflow/requirements/backlog.md`
- `.persona/workflow/requirements/questions.md`
- `.persona/workflow/requirements/assumptions.md`

Review those files. If the direction is right, tell the agent:

```text
Proceed.
```

Then the agent should run or follow:

```text
npx ph workflow approve requirements
npx ph workflow split .persona/workflow/requirements/backlog.md
npx ph workflow next
npx ph workflow implement
```

If you already have a README, run OpenCode with a deliberately short prompt:

```bash
opencode run --dir . \
  --model openai/gpt-5.4-mini-fast \
  --dangerously-skip-permissions \
  "Read README.md and implement it."
```

If you use the TUI instead:

```bash
opencode
```

Then type:

```text
Read README.md and implement it.
```

The agent should run or follow these workflow commands by itself:

```text
npx ph workflow implement
npx ph bearshell ...
npx ph plan --report-filled implementation
npx ph plan --report-filled review
npx ph workflow finish implement
```

For long requirements with multiple steps, let the agent split the assignment into workflow tickets first.

If the requirements are in a file:

```text
npx ph workflow split README.md
npx ph workflow next
```

If the user pasted the requirements directly in the TUI prompt and there is no README yet, the agent should first capture the prompt as the latest requirement source:

```text
npx ph workflow capture --stdin
npx ph workflow split
npx ph workflow next
```

After one ticket is completed and reviewed:

```text
npx ph workflow archive step-1
npx ph workflow next
```

This creates `.persona/workflow/backlog.md`, active task cards under `.persona/workflow/work/`, completed task history under `.persona/workflow/history/`, and prompt-captured requirement sources under `.persona/workflow/requirements/`. It is a workflow ledger for the AI agent, not generated-app quality certification.

The difference between the requirement commands:

- `ph workflow draft --stdin`: vague product idea -> draft backlog/questions/assumptions; stop for user review.
- `ph workflow approve requirements`: mark the draft accepted after the user says to proceed.
- `ph workflow capture --stdin`: already-written prompt requirements -> latest source for ticket splitting.
- `ph workflow split`: accepted/file/prompt requirements -> implementation tickets.

If the agent ignores the workflow, paste this stricter prompt:

```text
Read README.md, .persona/project-profile.jsonc, .persona/policies, and .persona/workflow/plan.md. Confirm that the plan is accepted, then implement all requirements with Java/Spring and Gradle.

Before implementing, run `npx ph workflow implement`, then read README.md completely using the bearshell chunk-read method shown in that output.
Use `npx ph bearshell` for commands where possible.
After implementation, run `npx ph bearshell --shell 'gradle test'` and `npx ph bearshell --shell 'gradle build'`.
If the Spring Boot app can run, also check bootRun plus HTTP happy-path and failure-path smoke.
Fill .persona/workflow/implementation-report.md and .persona/workflow/review-report.md, then run `npx ph plan --report-filled implementation`, `npx ph plan --report-filled review`, and `npx ph workflow finish implement`.
If finish fails, do not claim completion. Fix the reason first.
```

## 6. Check The Result

After the OpenCode run, inspect the project:

```bash
npx ph workflow check
npx ph evidence summary
npx ph evidence metrics --json
npx ph review backend-shape
```

For a healthy alpha smoke, look for:

- `ph workflow finish implement` passed during the agent run
- `.persona/workflow/implementation-report.md` is filled
- `.persona/workflow/review-report.md` is filled
- `.persona/evidence/summary.md` exists after `npx ph evidence summary`
- `npx ph evidence metrics --json` reports only local evidence that exists; it
  does not prove token saving or product efficacy
- `npx ph review backend-shape` is mostly PASS or all PASS
- `gradle test` passed
- `gradle build` passed
- executable Spring Boot apps keep `bootJar` enabled

For generated code shape, look for:

- `build.gradle` and `settings.gradle`
- no `pom.xml`
- `presentation`, `application`, `domain`, `infrastructure`, and optionally `global`
- domain repository ports such as `EquipmentRepository`
- infrastructure adapters such as `InMemoryEquipmentRepository`
- Application Services with no `Map`, `AtomicLong`, `nextId`, or `idCounter` ownership
- domain classes with behavior methods
- request/response DTO packages

## What The `ph` Commands Do

These commands are intentionally visible so AI agents can call them from OpenCode/Codex-style sessions.

- `ph init`: installs `.persona/rules`, `.persona/harness.jsonc`, OpenCode plugin config, and `.gitignore` entries only.
- `ph intake`: creates an editable draft backend profile.
- `ph intake --default backend`: creates a ready default backend profile without an interactive terminal.
- `ph intake --interactive`: asks backend planning questions and writes `.persona/project-profile.jsonc`.
- `ph bootstrap backend`: backend-ready path that fills `AGENTS.md`, the default backend profile, policy overlay, accepted plan, report templates, harness config, and OpenCode config.
- `ph bootstrap backend --no-developer-mcp`: skips the default OpenCode developer MCP bundle.
- `ph bootstrap backend --no-codegraph`: keeps the developer MCP bundle but omits the local CodeGraph wrapper.
- `ph policy init`: creates company and personal backend policy overlay files.
- `ph plan`: creates `.persona/workflow/plan.md`.
- `ph plan --auto-accept`: creates workflow plan/report templates and marks the plan accepted for a fast smoke.
- `ph plan --accept`: marks the plan accepted.
- `ph plan --implement`: checks that implementation may start and prints the implementation rail.
- `ph bearshell`: runs timeout-bounded and output-bounded shell commands.
- `ph workflow check`: reports plan/report/evidence status.
- `ph workflow test`: with opt-in `enforce.tdd` and strict
  `enforce.executeVerification`, records red evidence only from PH-run
  Gradle/JUnit failing testcases.
- `ph workflow tdd`: prints read-only TDD red→green status and the next action
  without writing red/green evidence.
- `ph workflow implement`: prints the single AI-facing implementation rail, including README chunk-read commands.
- `ph workflow start implement`: prints the AI-facing implementation workflow.
- `ph workflow finish implement`: checks whether the workflow can be reported complete.
- `ph doctor`: diagnoses OpenCode and Persona Harness integration.
- `ph smoke`: writes `.persona/workflow/smoke-report.md`.
- `ph feedback`: writes `.persona/workflow/feedback-report.md`.
- `ph evidence summary`: summarizes raw evidence files.
- `ph evidence metrics [--json]`: read-only local evidence metrics for
  provider-token evidence, structured tool/MCP calls, read chars when present,
  and workflow finish command records.
- `ph review backend-shape`: writes report-only backend workflow shape observations.
- `ph history`: archives completed workflow artifacts.

## What Persona Harness Encourages

- Gradle-first Java/Spring backend projects.
- `presentation`, `application`, `domain`, `infrastructure`, and `global` package boundaries.
- Controller delegates to Application Service.
- Application Service orchestrates use cases and does not own storage state or id sequence.
- Domain owns business decisions through behavior.
- Repository interface lives in domain.
- Repository implementation lives in infrastructure.
- Request/response DTO boundary is explicit.

These are steering targets and review cues. They are not proof that the generated app is correct, maintainable, secure, or production-ready.

## What Evidence Means

`.persona/evidence` records local traces such as file reads, injected workflow/rule context, selected rails, target file roles, and workflow command activity. Evidence is useful for asking "did the agent see and follow the intended rail?" It is not a quality score, and higher evidence counts do not prove better generated code.

## Opt-In TDD Workflow Rail

`enforce.tdd` is default-off. When a project explicitly enables both
`enforce.tdd=true` and strict `enforce.executeVerification=true`,
`ph workflow test` runs PH direct Gradle/JUnit verification and records red
evidence only when a testcase genuinely fails with a JUnit `<failure>`.
`ph workflow tdd` is a read-only status helper: it reports whether the current
ticket is missing red evidence, waiting for green, passed, disabled, or
unavailable. It does not write evidence.

Later `ph workflow check`, `ph workflow archive <ticket>`, or
`ph workflow finish implement` can record green evidence when the same
ticket/test id passes. With `enforce.tdd` enabled, archive/finish block until
that same ticket/test id has red evidence followed by PH-observed green
evidence. If strict execution verification is off, the rail is advisory and
writes no fake red/green evidence.

This is a deterministic red-first completion gate. It does not scaffold tests,
prove tests are sufficient, run coverage, run mutation testing, or certify the
generated app's product quality.

## A/B And ON/OFF Smoke Limits

Existing A/B or ON/OFF smoke results are stack-steering signals only. They are not product-quality proof because the samples are small, often `n=1`, non-blind, run by the same operator, and sensitive to model, provider, version, prompt, timeout, and continuation behavior.

## What Persona Harness Does Not Promise

- It does not certify generated application product quality.
- It does not enforce rules through AST, linter, or build failure gates.
- It does not guarantee Clean Code quality.
- It does not turn evidence counts into quality improvement claims.
- It does not prove tests are sufficient.
- It does not productize frontend, infra, or desktop workflows yet.
- It does not provide a full TDD framework, test scaffolding, coverage, or mutation testing.
- It is not useful as a full workflow without OpenCode.
- `ph bearshell` is not a sandbox. It limits runtime and output size, but commands still run on your machine.

## Troubleshooting

### `npm install -D persona-harness@latest` installs an unexpected version

Check the registry:

```bash
npm view persona-harness dist-tags --json
npm view persona-harness@latest version
```

The official `0.4.0` release is published under `latest`. This repository is
prepared for `0.5.0-rc.1` on the `next` dist-tag, but until that RC is
published the registry `next` dist-tag remains `0.4.0-rc.10`, and `alpha`
remains `0.3.9-alpha.8`. Verify dist-tags and package gitHead before treating
any install as current.

### `opencode` is not found

Install or reconnect OpenCode:

```bash
curl -fsSL https://opencode.ai/install | bash
opencode --version
opencode auth login
```

### OpenCode says no model is configured

Run:

```bash
opencode auth login
opencode auth list
```

or use the TUI:

```text
/connect
/models
```

### `.persona/evidence` is missing

Evidence is created by OpenCode hook activity. It is normal for `.persona/evidence` to be missing immediately after `ph init`.

Run an OpenCode task that reads project files, then check:

```bash
find .persona/evidence -type f | head
npx ph evidence summary
```

### `ph workflow check` reports WARN

WARN does not always mean failure.

Before implementation, WARN is expected because reports are still templates.

After implementation, inspect the findings:

```bash
npx ph workflow check
```

Common causes:

- implementation report is still template
- review report is still template
- evidence is missing
- final verification was run with raw shell instead of `npx ph bearshell`

### The agent reads `.persona/rules` directly

That is not desired. The agent should rely on Persona Harness injection and the accepted plan.

Tell it:

```text
Do not open and read .persona/rules directly. Implement from the accepted plan and Persona Harness injection summary.
```

### `gradle build` passes but `bootJar` is skipped

For executable Spring Boot apps, treat this as not done. Ask the agent to keep `bootJar` enabled and rerun:

```bash
npx ph bearshell --shell 'gradle build'
```

## External Tester Feedback

If you are testing the alpha, please collect:

- exact install command
- `npx ph doctor` output summary
- exact OpenCode prompt
- generated `src/main/java` tree
- `build.gradle`
- `gradle test` result
- `gradle build` result
- HTTP happy/failure smoke result if runnable
- `.persona/workflow/implementation-report.md`
- `.persona/workflow/review-report.md`
- `.persona/workflow/backend-shape-report.md`
- `.persona/evidence/summary.md`
- what felt confusing
- whether you would try it again on a real backend project

Use the template:

- [External tester feedback template](docs/current/v0.3.1-external-tester-feedback-template.md)

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
