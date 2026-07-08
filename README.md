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

**[Start Here](docs/START-HERE.md) · [Quick Demo](docs/QUICK-DEMO.md) · [Measured Claims](docs/MEASURED-CLAIMS.md)**

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

> AI agents love to say "Done!" — Persona Harness makes them prove it. It is a local CLI completion gate that blocks completion claims until required reports, PH-generated evidence, and real test results exist on disk.

> [!IMPORTANT]
> **Alpha, gate-first, measured.** Stable: `persona-harness@latest=0.6.0` (`next=0.6.0-rc.4`). Runtime injection was measured **negative** in the accepted 10-pair fixture set, so runtime guidance is **default-off / opt-in** — not the product center. See [`injection-value-status.json`](docs/current/injection-value-status.json). What PH claims is narrow: **it blocks unverified completion for explicitly defined evidence gates and deterministic violations.**

## Measured Behavior

Unlike most agent-harness projects, PH publishes what it has actually measured — including negatives.

- **Forged TDD evidence** planted before `workflow finish` → `finish` exits **1**, forged file ignored.
- **Green-only completion** with the TDD rail on → blocked **5/5** (vs allowed 5/5 off).
- **Runtime injection**, 10 paired OpenCode runs → equal success (10/10 both), but PH ON cost more on every pair → kept **default-off**.

Completion-integrity measurements on bounded local fixtures — *not* token-saving, app-quality, or product-efficacy claims. Full boundary and evidence: **[docs/MEASURED-CLAIMS.md](docs/MEASURED-CLAIMS.md)**.

## What it is

A workflow + evidence CLI (`ph`) with an optional OpenCode plugin, for Java/Spring backend work done by AI agents. It:

- turns a project idea or README into implementation tickets;
- keeps the agent on a repeatable backend workflow;
- runs verification through bounded commands;
- records local evidence of what was read, run, and finished;
- **blocks completion when required reports or evidence are missing.**

It is **not** a code-quality guarantee, a token-saving product, a broad linter, or proof that generated apps are production-ready. Every claim broader than the completion gate must be earned by measurement first — see [MEASURED-CLAIMS](docs/MEASURED-CLAIMS.md).

## Install

Requires Node.js 20+, Java 21+ / Gradle, and the OpenCode CLI with a configured provider.

```bash
# OpenCode
curl -fsSL https://opencode.ai/install | bash   # or: npm install -g opencode-ai
opencode auth login

# Persona Harness
npm install -D persona-harness
npx ph --help && npx ph doctor
```

## Quick Start

Use a clean project directory (not the Persona Harness repo itself).

```bash
mkdir -p /tmp/ph-demo && cd /tmp/ph-demo && npm init -y
npm install -D persona-harness

npx ph init                 # minimal integration files only
npx ph bootstrap backend    # AGENTS.md, profile, plan, report templates
npx ph workflow check
```

Then, in OpenCode, ask the agent to implement your `README.md`. It should drive the rail itself and end with `npx ph workflow finish implement`.

> [!NOTE]
> If `workflow finish` fails, the agent must fix the reported blocker before claiming completion. **That failure is the product working, not a bug.**

Full walkthrough with a sample Todo API and the idea-first flow: **[Quick Demo](docs/QUICK-DEMO.md)**.

## TDD Rail (opt-in)

Enable both settings in `.persona/harness.jsonc`:

```json
{ "enforce": { "executeVerification": true, "tdd": true } }
```

`ph workflow test` then records red evidence **only from PH-run Gradle/JUnit failures** — agent-reported evidence is never accepted. `workflow check` / `archive` / `finish` record green evidence for the same ticket/test id. It is a red-first completion gate; it does not scaffold tests, prove test sufficiency, run coverage/mutation, or certify app quality.

## Commands

```bash
npx ph workflow check | implement | finish implement | archive <ticket-id>
npx ph workflow split README.md && npx ph workflow next   # multi-ticket
npx ph bearshell --shell 'gradle test'                    # bounded execution
npx ph evidence summary | metrics --json | ab-report --json | pminus-report --json
npx ph review backend-shape
```

Run `npx ph --help` for the full list. The workflow ledger lives under `.persona/workflow/` (`work/`, `history/`, `requirements/`).

## Optional integrations (opt-in previews)

```bash
npx ph bootstrap backend --codegraph-preview          # CodeGraph
npx ph bootstrap backend --lsp-preview                # Java LSP
npx ph bootstrap backend --runtime-injection-preview  # parked model-facing guidance
npx ph bootstrap backend --no-developer-mcp           # disable default developer MCP
```

Preview wrappers report an **unavailable** status when their external tools are missing, instead of faking success. Runtime injection is parked (measured negative) and is not the recommended path.

## Boundaries & safety

Evidence answers one question — *"Did the agent see and follow the expected rail?"* — and nothing more. PH does **not** promise app-quality certification, token savings, Clean Code guarantees, broad AST/linter enforcement, a full TDD framework, closure guarantees, or a complete workflow without OpenCode. The canonical list is in [MEASURED-CLAIMS](docs/MEASURED-CLAIMS.md).

> [!WARNING]
> `ph bearshell` is **not a sandbox**. It limits runtime and output size, but commands still run on your machine with your permissions. See [SECURITY](SECURITY.md).

## Docs

- **New users** → [Start Here](docs/START-HERE.md) · [Quick Demo](docs/QUICK-DEMO.md) · [Measured Claims](docs/MEASURED-CLAIMS.md)
- **Agent not following the rail?** → [Troubleshooting](docs/troubleshooting/README.md)
- **Install & backend shape** → [MVP install guide](docs/current/java-backend-mvp-install-guide.md)
- **Contributors** → [CONTRIBUTING](CONTRIBUTING.md) · [ROADMAP](ROADMAP.md) · [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md)
- **Release & measurement** → [v0.6.0 capsule](docs/releases/v0.6.0/README.md) · [package index](docs/releases/package-index.md) · [docs/current](docs/current/README.md) · [Changelog](CHANGELOG.md)

## Contributing

Contributions are welcome — including negative measurement results. PH only asserts what its evidence supports, and PRs that expand a claim must bring the measurement. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
