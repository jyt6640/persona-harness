# Persona Harness

Persona Harness is an OpenCode plugin and local CLI for Java/Spring backend generation workflows.

It helps an AI agent start from a clean project, read your backend requirements, create an architecture plan, implement with a consistent Java/Spring structure, run verification, and leave workflow reports behind.

If you only have a product idea, Persona Harness now routes the AI through a requirements draft first. For example, `TODO 웹 서비스 만들래` should create `.persona/workflow/requirements/backlog.md` and ask for review instead of starting implementation immediately. Implementation starts after you approve the draft with a phrase such as `진행하자`.

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

> Current source/package candidate: `0.3.7-alpha.1`
>
> Current scope: Java/Spring backend MVP.
>
> Not in scope yet: frontend, infra, desktop app, AST/linter enforcement, generated-app quality certification, and full TDD workflow.

## Who This Is For

Use Persona Harness if you want to test whether OpenCode can generate Java/Spring backend code with a more consistent Clean Code shape.

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
mkdir -p /tmp/persona-harness-alpha-check
cd /tmp/persona-harness-alpha-check
npm init -y
npm install -D persona-harness@alpha
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
- `ph doctor` shows `Persona package version: 0.3.7-alpha.1` after the current alpha package is installed

## 3. Write The Project README

Persona Harness works from your project requirements. Create a short `README.md` first.

Example:

```bash
cat > README.md <<'EOF'
# Equipment Rental API

Java/Spring Boot와 Gradle로 장비 대여 REST API를 구현한다.

## 요구사항

* 장비를 등록할 수 있다.
* 장비 목록을 조회할 수 있다.
* 회원을 등록할 수 있다.
* 회원이 장비를 대여할 수 있다.
* 이미 대여 중인 장비이거나 수량이 부족하면 대여에 실패한다.
* 장비를 대여한 회원 본인만 반납할 수 있다.
* 존재하지 않는 장비, 회원, 대여 요청에는 적절한 예외 응답을 반환한다.

## 기술 조건

* Java 21 이상
* Spring Boot 3.x
* Gradle only
* REST API
* 화면 구현 없음
* 저장소는 단순 in-memory 구현으로 시작해도 된다.
* Repository interface는 domain 패키지에 두고, 구현체는 infrastructure 패키지에 둔다.
* Application Service는 저장소 상태나 id sequence를 직접 소유하지 않는다.
* Domain은 record가 아니라 상태와 행동을 가진 class로 만든다.
* Controller, Service, Domain, Repository, DTO 책임을 분리한다.
EOF
```

You can use a different domain. For cleaner feedback, avoid the older `reservation`, `roomescape`, or `book loan` examples when testing the current alpha.

## 4. Choose The Setup Path

`npx ph init` is the minimal install and OpenCode integration step. It installs `.persona/harness.jsonc`, `.persona/rules/`, `.opencode/opencode.json`, and `.gitignore` entries, then exits with next-step guidance.

`npx ph init` does not create `AGENTS.md`, `.persona/project-profile.jsonc`, policy overlay files, an accepted plan, or workflow report templates.

For the normal backend-ready external tester flow:

```bash
npx ph doctor
npx ph init
npx ph bootstrap backend
npx ph workflow check
```

`npx ph bootstrap backend` prepares the backend workflow for AI implementation. It fills missing `AGENTS.md`, `.persona/project-profile.jsonc`, policy overlay files, an accepted `.persona/workflow/plan.md`, implementation/review report templates, harness config, and OpenCode config.

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
TODO 웹 서비스 만들래
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
진행하자
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
  "README.md 보고 구현해줘"
```

If you use the TUI instead:

```bash
opencode
```

Then type:

```text
README.md 보고 구현해줘
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
README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.md를 읽고 plan이 accepted 상태인지 확인한 뒤 Java/Spring Gradle 기반으로 요구사항 전체를 구현해줘.

구현 전 `npx ph workflow implement`를 실행하고, README.md는 해당 출력의 bearshell chunk-read 방식으로 끝까지 읽어줘.
명령 실행은 가능하면 `npx ph bearshell`로 해줘.
구현 후 `npx ph bearshell --shell 'gradle test'`, `npx ph bearshell --shell 'gradle build'`를 실행해줘.
실행 가능한 Spring Boot 앱이면 bootRun과 HTTP happy/failure smoke도 확인해줘.
.persona/workflow/implementation-report.md와 .persona/workflow/review-report.md를 채우고, `npx ph plan --report-filled implementation`, `npx ph plan --report-filled review`, `npx ph workflow finish implement`를 실행해줘.
finish가 실패하면 완료했다고 말하지 말고 실패 이유를 고쳐줘.
```

## 6. Check The Result

After the OpenCode run, inspect the project:

```bash
npx ph workflow check
npx ph evidence summary
npx ph review backend-shape
```

For a healthy alpha smoke, look for:

- `ph workflow finish implement` passed during the agent run
- `.persona/workflow/implementation-report.md` is filled
- `.persona/workflow/review-report.md` is filled
- `.persona/evidence/summary.md` exists after `npx ph evidence summary`
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
- `ph policy init`: creates company and personal backend policy overlay files.
- `ph plan`: creates `.persona/workflow/plan.md`.
- `ph plan --auto-accept`: creates workflow plan/report templates and marks the plan accepted for a fast smoke.
- `ph plan --accept`: marks the plan accepted.
- `ph plan --implement`: checks that implementation may start and prints the implementation rail.
- `ph bearshell`: runs timeout-bounded and output-bounded shell commands.
- `ph workflow check`: reports plan/report/evidence status.
- `ph workflow implement`: prints the single AI-facing implementation rail, including README chunk-read commands.
- `ph workflow start implement`: prints the AI-facing implementation workflow.
- `ph workflow finish implement`: checks whether the workflow can be reported complete.
- `ph doctor`: diagnoses OpenCode and Persona Harness integration.
- `ph smoke`: writes `.persona/workflow/smoke-report.md`.
- `ph feedback`: writes `.persona/workflow/feedback-report.md`.
- `ph evidence summary`: summarizes raw evidence files.
- `ph review backend-shape`: writes report-only backend Clean Code shape observations.
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

## What Persona Harness Does Not Promise

- It does not certify generated application product quality.
- It does not enforce rules through AST, linter, or build failure gates.
- It does not prove tests are sufficient.
- It does not productize frontend, infra, or desktop workflows yet.
- It is not the final TDD workflow yet.
- It is not useful as a full workflow without OpenCode.
- `ph bearshell` is not a sandbox. It limits runtime and output size, but commands still run on your machine.

## Troubleshooting

### `npm install -D persona-harness@alpha` installs an old version

Check the registry:

```bash
npm view persona-harness dist-tags --json
npm view persona-harness@alpha version
```

During the alpha pilot, `alpha` and `latest` are expected to point at the current alpha package.

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
.persona/rules를 직접 열어 읽지 말고, accepted plan과 Persona Harness injection summary를 기준으로 구현해줘.
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
