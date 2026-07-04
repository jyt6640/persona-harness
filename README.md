<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

<img src="img/Persona-Harness-Logo.png" alt="Persona Harness logo" width="180">

# Persona Harness

**A completion gate for AI coding agents building Java/Spring backends.**

[![npm version](https://img.shields.io/npm/v/persona-harness?color=369eff&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![npm downloads](https://img.shields.io/npm/dt/persona-harness?color=ff6b35&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![node](https://img.shields.io/badge/node-%3E%3D20-c4f042?labelColor=black&style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-white?labelColor=black&style=flat-square)](./LICENSE)

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

> AI agents love to say "Done!" — Persona Harness makes them prove it. It is a local CLI completion gate that blocks completion claims until required reports, PH-generated evidence, and real test results exist on disk. OpenCode runtime guidance is optional preview behavior, not the product center.

> [!IMPORTANT]
> **Project status: gate-first measured release.**
> Stable npm channel: `persona-harness@latest=0.5.0`; published prerelease channel is `next=0.6.0-rc.3`; alpha remains `0.3.9-alpha.8`. The `0.6.0-rc.3` registry smoke is release-candidate package-runtime evidence only, not a `latest` move or broader product-efficacy claim.
> The runtime injection effect has been measured and is **negative in the accepted 10-pair local-current OpenCode fixture set**. See [`docs/current/injection-value-status.json`](docs/current/injection-value-status.json). Runtime guidance is therefore default-off and opt-in only; this is a scoped measurement, not a universal product-efficacy claim.
> What PH *does* claim — and has evidence for — is narrower: **it blocks unverified completion for explicitly defined evidence gates and deterministic violations.**

## Measured Behavior

Unlike most agent-harness projects, PH publishes what it has actually measured — including negatives.

| Scenario | Result | Evidence |
| :--- | :--- | :--- |
| **Forged TDD evidence** — a hand-written `red-forged.json` planted before `workflow finish` | `finish` exits **1**; forged file ignored | P0 real-Gradle run archive |
| **Green-only completion** (tests + implementation together, no red-first) — 5 repetitions each | TDD OFF: allowed **5/5** · TDD ON: blocked **5/5** | P1 completion-integrity A/B |
| **Compile error passed off as "red"** | `workflow test` exits **1**, no evidence written | P0 real-Gradle run archive |
| Runtime injection PH OFF/ON app-generation — 10 paired OpenCode runs | PH ON succeeded **10/10**, PH OFF succeeded **10/10**, but PH ON increased provider-token total, read chars, tool calls, and elapsed time in all 10 pairs | accepted local-current A/B archive |

These are completion-integrity measurements on bounded local fixtures. They are *not* token-saving, app-quality, or product-efficacy claims.

## TL;DR

> Q. What is it?

A workflow/evidence CLI + completion guard for Java/Spring backend work done by AI agents. It ships as a local CLI (`ph`) with an OpenCode plugin for optional runtime guidance and measurement hooks.

> Q. What does it actually do?

- turns a project idea or README into implementation tickets;
- keeps the agent on a repeatable backend workflow;
- runs verification through bounded commands;
- records local evidence of what was read, run, and finished;
- **blocks completion when required reports or evidence are missing.**

> Q. Does it guarantee code quality, save tokens, or replace a linter?

No. It is not a code-quality guarantee, token-saving product, broad linter, or proof that generated apps are production-ready. Every claim broader than the completion gate must be earned by measurement first — that rule is part of the project.

## Install

Requirements:

- Node.js 20+, npm
- Java 21+, Gradle
- OpenCode CLI with a configured model/provider

```bash
# OpenCode
curl -fsSL https://opencode.ai/install | bash   # or: npm install -g opencode-ai
opencode auth login

# Persona Harness
npm install -D persona-harness
npx ph --help
npx ph init
npx ph doctor
```

## Quick Start — Java/Spring Backend

Use a clean project directory (not the Persona Harness repository itself).

```bash
mkdir -p /tmp/persona-harness-demo && cd /tmp/persona-harness-demo
npm init -y
npm install -D persona-harness
```

Create a short `README.md` describing the app and constraints:

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

Initialize:

```bash
npx ph init
npx ph bootstrap backend
npx ph workflow check
```

`ph init` creates only minimal integration files (`.persona/harness.jsonc`, `.persona/conventions/`, `.persona/rules/`, `.opencode/opencode.json`, `.gitignore` entries). `ph bootstrap backend` prepares the full backend workflow: `AGENTS.md`, `.persona/project-profile.jsonc`, policy overlays, an accepted plan, report templates, and OpenCode configuration. Fresh setup is gate-first: model-facing runtime guidance is off unless explicitly enabled.

Then ask the agent, in OpenCode, with a short prompt:

```text
Read README.md and implement it.
```

The agent should run the rail itself:

```text
npx ph workflow implement
npx ph bearshell ...
npx ph plan --report-filled implementation
npx ph plan --report-filled review
npx ph workflow finish implement
```

> [!NOTE]
> If `workflow finish` fails, the agent must fix the reported blocker before claiming completion. That failure is the product working, not a bug.

## Start From An Idea Instead Of A README

Tell the agent the idea:

```text
I want to build a todo web service.
```

The agent should draft requirements first, not start coding:

```text
npx ph workflow draft --stdin
```

Review `.persona/workflow/requirements/` (`backlog.md`, `questions.md`, `assumptions.md`), then say `Proceed.` The agent runs:

```text
npx ph workflow approve requirements
npx ph workflow split .persona/workflow/requirements/backlog.md
npx ph workflow next
npx ph workflow implement
```

## Work With Multiple Tickets

```bash
npx ph workflow split README.md
npx ph workflow next
# ... implement & review ...
npx ph workflow archive <ticket-id>
npx ph workflow next
```

The workflow ledger lives under `.persona/workflow/`: active work in `work/`, completed history in `history/`, requirement sources in `requirements/`.

## TDD Rail (opt-in)

Enable both settings:

```json
{
  "enforce": {
    "executeVerification": true,
    "tdd": true
  }
}
```

When enabled, `ph workflow test` records red evidence **only from PH-run Gradle/JUnit failures** — agent-reported evidence is never accepted. Later `workflow check` / `archive` / `finish` record green evidence for the same ticket/test id.

This is a red-first completion gate. It does not scaffold tests, prove test sufficiency, run coverage or mutation testing, or certify application quality.

## Useful Commands

```bash
# Setup
npx ph init && npx ph bootstrap backend && npx ph doctor

# Workflow
npx ph workflow check
npx ph workflow implement
npx ph workflow finish implement
npx ph workflow archive <ticket-id>
npx ph workflow loop --dry-run --json  # explicit capped blocker-loop preview; no default hook

# Bounded command execution
npx ph bearshell --shell 'gradle test'

# Evidence and reports
npx ph evidence summary
npx ph evidence metrics --json
npx ph evidence ab-report --json
npx ph evidence pminus-report --json
npx ph review backend-shape

# Explicit local A/B evidence recording
npx ph evidence ab-run --scenario demo --condition baseline -- ./gradlew test
```

Stable builds also include `npx ph evidence pminus-status --json` for read-only surface decision summaries.

## Optional Integrations

The default backend bootstrap registers the remote developer MCP tools `grep_app` and `context7`.

```bash
npx ph bootstrap backend --codegraph-preview   # CodeGraph, opt-in
npx ph bootstrap backend --lsp-preview         # LSP, opt-in
npx ph bootstrap backend --runtime-injection-preview  # parked opt-in model-facing PH guidance
npx ph bootstrap backend --no-developer-mcp    # disable developer MCP
```

> [!NOTE]
> Both wrappers are preview surfaces. If required external tools are missing, they report an **unavailable** status instead of faking successful results.
> Runtime injection remains an explicit preview. It is parked after the Stage 9 banner-only H1 measurement and should not be treated as the recommended/default path.

## What Evidence Means

`.persona/evidence` stores local traces: file reads, optional injected workflow context, command activity, TDD records, and A/B measurements.

Evidence answers one question: **"Did the agent see and follow the expected rail?"**

Evidence does **not** prove: generated app quality, token savings, product efficacy, full TDD coverage, broad reliability, or successful closure in all cases.

## Recommended Backend Shape

Persona Harness steers Java/Spring projects toward:

- Gradle-first Java/Spring backend;
- `presentation` / `application` / `domain` / `infrastructure` / `global` package boundaries;
- controllers delegating to application services;
- application services orchestrating use cases without owning storage state or id sequences;
- repository interfaces in `domain`, implementations in `infrastructure`;
- domain objects with behavior;
- explicit request/response DTO boundaries.

These are steering targets and review cues, not quality guarantees.

## Troubleshooting

```bash
npm view persona-harness dist-tags --json
opencode --version
```

If `ph workflow check` reports warnings, inspect the listed blockers. Before implementation, template-report warnings are normal. After implementation, common blockers are missing evidence, unfilled reports, or verification that bypassed the rail.

If the agent ignores the workflow, paste a stricter prompt:

```text
Read README.md, .persona/project-profile.jsonc, .persona/policies, and .persona/workflow/plan.md.
Before implementing, run `npx ph workflow implement`.
Use `npx ph bearshell` for verification commands where possible.
After implementation, fill `.persona/workflow/implementation-report.md` and `.persona/workflow/review-report.md`.
Run `npx ph plan --report-filled implementation`, `npx ph plan --report-filled review`, and `npx ph workflow finish implement`.
If finish fails, do not claim completion. Fix the reported blocker first.
```

## What Persona Harness Does Not Promise

- generated application quality certification;
- token savings;
- product-efficacy or navigation-benefit proof;
- Clean Code guarantees;
- broad AST/linter enforcement;
- full TDD framework, test scaffolding, coverage, or mutation testing;
- frontend, infrastructure, or desktop workflow productization;
- a complete workflow without OpenCode.

> [!WARNING]
> `ph bearshell` is not a sandbox. It limits runtime and output size, but commands still run on your machine.

## Docs

- [Changelog](CHANGELOG.md)
- [Release notes](docs/current/release/README.md)
- [Acceptance test checklist](docs/current/acceptance-test-checklist.md)
- [Java backend MVP install guide](docs/current/java-backend-mvp-install-guide.md)

## License

Apache-2.0. See [LICENSE](LICENSE).
