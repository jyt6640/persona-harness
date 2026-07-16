<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

<img src="img/Persona-Harness-Logo.png" alt="Persona Harness logo" width="180">

# Persona Harness

**A gate-first workflow CLI for AI coding agents building Java/Spring backends.**

[![npm version](https://img.shields.io/npm/v/persona-harness?color=369eff&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![npm downloads](https://img.shields.io/npm/dt/persona-harness?color=ff6b35&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![node](https://img.shields.io/badge/node-%3E%3D20-c4f042?labelColor=black&style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-white?labelColor=black&style=flat-square)](./LICENSE)

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

**[Start Here](docs/START-HERE.md) · [Quick Demo](docs/QUICK-DEMO.md) · [Measured Claims](docs/MEASURED-CLAIMS.md)**

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

> AI agents love to say "Done!" — Persona Harness makes them show their work. It is a local workflow gate that records and checks reports, evidence, and verification results for explicitly defined gates.

> [!IMPORTANT]
> **Alpha, gate-first, measured.** Stable: `persona-harness@latest=0.6.0`; current next-channel RC: `0.7.0-rc.2`. A 2026-07-12 local production audit found completion-integrity bypasses in the current RC line, so Stable/GA and npm `latest` movement are **NO-GO pending P3**. Runtime injection remains **default-off / opt-in**. See [`docs/current/p3-integrity-roadmap.md`](docs/current/p3-integrity-roadmap.md), [`docs/MEASURED-CLAIMS.md`](docs/MEASURED-CLAIMS.md), and [`injection-value-status.json`](docs/current/injection-value-status.json).

## Measured Behavior

Unlike most agent-harness projects, PH publishes what it has actually measured — including negatives.

- **Simple forged TDD evidence fixture** planted before `workflow finish` → `finish` exits **1**, forged file ignored.
- **Green-only completion** with the TDD rail on → blocked **5/5** (vs allowed 5/5 off).
- **Runtime injection**, 10 paired OpenCode runs → equal success (10/10 both), but PH ON cost more on every pair → kept **default-off**.

Completion-integrity measurements are bounded local fixtures. They are *not*
token-saving, app-quality, product-efficacy, security, GA, or broad
anti-forgery claims. Full boundary and P3 hold:
**[docs/MEASURED-CLAIMS.md](docs/MEASURED-CLAIMS.md)** and
**[docs/current/p3-integrity-roadmap.md](docs/current/p3-integrity-roadmap.md)**.

## What it is

A workflow + evidence CLI (`ph`) with an optional OpenCode plugin, for Java/Spring backend work done by AI agents. It:

- turns a project idea or README into implementation tickets;
- keeps the agent on a repeatable backend workflow;
- runs verification through bounded commands;
- records local evidence of what was read, run, and finished;
- can block completion when required reports or evidence for defined gates are
  missing.

It is **not** a code-quality guarantee, a token-saving product, a broad linter,
proof that generated apps are production-ready, or a strong completion-integrity
guarantee before P3 closes. Every claim broader than the measured gates must be
earned by measurement first — see [MEASURED-CLAIMS](docs/MEASURED-CLAIMS.md).

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

For a clean project directory (not the Persona Harness repo itself):

```bash
mkdir -p /tmp/ph-demo && cd /tmp/ph-demo && npm init -y
npm install -D persona-harness

npx ph init                 # minimal integration files only
npx ph bootstrap backend    # AGENTS.md, profile, plan, report templates
npx ph go "Add a task creation endpoint."
```

For an existing Java/Spring/Gradle project, inspect the inferred draft first,
then accept it explicitly:

```bash
npx ph attach
npx ph attach --yes

# Only for a recognized weak Persona Harness installation, never a ready one:
npx ph attach --repair --yes
```

`attach` refuses unrecognized or corrupt existing Persona Harness files rather
than overwriting them, and it rejects repair for an already-ready attachment.
A successful attach enables PH-run verification while keeping
`runtimeInjection`, `systemConstitution`, `idleContinuation`, and the Ralph
loop off.

`ph go` is the host-neutral single entry for one concrete implementation
requirement after bootstrap and plan acceptance. It captures the requirement,
creates and selects the ticket, and prints the existing implementation rail;
it does not require a runtime hook or enable runtime injection. The agent should
follow that rail and end with `npx ph workflow finish implement`. Its workflow
conflict preservation applies to cooperative local PH/user writers and does not
address hostile same-user filesystem path replacement.

> [!NOTE]
> If `workflow finish` fails, the agent must fix the reported blocker before claiming completion. **That failure is the product working, not a bug.**

Three-beat setup, gate, and goal-entry walkthrough: **[Quick Demo](docs/QUICK-DEMO.md)**.

## TDD Rail (opt-in)

Enable both settings in `.persona/harness.jsonc`:

```json
{ "enforce": { "executeVerification": true, "tdd": true } }
```

`ph workflow test` is intended to record red evidence from PH-run Gradle/JUnit
failures, and `workflow check` / `archive` / `finish` record green evidence for
the same ticket/test id. Current P3 work is strengthening the authority model so
unsigned project-local artifacts cannot satisfy finish authority by themselves.
It is a red-first completion gate; it does not scaffold tests, prove test
sufficiency, run coverage/mutation, or certify app quality.

## Commands

```bash
npx ph attach [--yes]                                  # existing Java/Spring/Gradle project
npx ph go "Add a task creation endpoint."                 # concrete single entry
npx ph workflow check | implement | finish implement | archive <ticket-id>
npx ph workflow split README.md && npx ph workflow next   # multi-ticket
npx ph bearshell --shell 'gradle test'                    # bounded execution
npx ph evidence summary | metrics --json | ab-report --json | pminus-report --json
npx ph review backend-shape
```

Run `npx ph --help` for the full list. The workflow ledger lives under `.persona/workflow/` (`work/`, `history/`, `requirements/`).

## Advanced surfaces

Preview integrations, shared-skill source material, Role Checklist Relay, and
developer MCP details are intentionally outside the Quick Start. Repository
contributors can use `docs/current/advanced-surface-index.md`; these surfaces
do not change the P0-3 root CLI discovery contract.

## Platform And Host Support

| Surface | Status | Evidence boundary |
| --- | --- | --- |
| Linux + OpenCode | Supported matrix | Node 20, 22, and 24 each run source-built checks plus a fresh local-tarball installed black-box check. |
| macOS + OpenCode | Limited smoke | macOS Node 22 smoke only; this is not a promise of macOS Node 20/24 coverage. |
| Windows | Unverified / nonblocking | No Windows matrix job or support claim. Lock identity device/inode behavior and stale-lock/concurrency conclusions are not measured or verified. |
| Codex adapter | Planned | No current Codex adapter or Codex product evidence; this is a planned adapter only. |

## Boundaries & safety

Evidence answers one bounded question — *"What did this PH workflow observe for
this defined gate?"* — and nothing more. PH does **not** promise app-quality
certification, token savings, Clean Code guarantees, broad AST/linter
enforcement, a full TDD framework, closure guarantees, strong anti-forgery
integrity before P3, or a complete workflow without OpenCode. The canonical list
is in [MEASURED-CLAIMS](docs/MEASURED-CLAIMS.md).

> [!WARNING]
> `ph bearshell` is **not a sandbox**. It limits runtime and output size, but commands still run on your machine with your permissions. See [SECURITY](SECURITY.md).

## Docs

- **New users** → [Start Here](docs/START-HERE.md) · [Quick Demo](docs/QUICK-DEMO.md) · [Measured Claims](docs/MEASURED-CLAIMS.md)
- **Agent not following the rail?** → [Troubleshooting](docs/troubleshooting/README.md)
- **Install & backend shape** → [MVP install guide](docs/current/java-backend-mvp-install-guide.md)
- **Contributors** → [CONTRIBUTING](CONTRIBUTING.md) · [ROADMAP](ROADMAP.md) · [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md)
- **Release & measurement** → [v0.6.0 capsule](docs/releases/v0.6.0/README.md) · [package index](docs/releases/package-index.md) · [docs/current](docs/current/README.md) · [Changelog](CHANGELOG.md)
- **Advanced repository surfaces** → `docs/current/advanced-surface-index.md`

## Contributing

Contributions are welcome — including negative measurement results. PH only asserts what its evidence supports, and PRs that expand a claim must bring the measurement. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
