# Start Here

A reading map for people seeing Persona Harness (PH) for the first time.
`docs/current/` has many files; you do not need them to start. Use this page.

## I just want to understand the project

1. [README](../README.md) — what PH is, in one screen.
2. [MEASURED-CLAIMS](MEASURED-CLAIMS.md) — what PH can and cannot claim.
3. [QUICK-DEMO](QUICK-DEMO.md) — see it block a completion in a few minutes.

## I want to try it

1. [QUICK-DEMO](QUICK-DEMO.md) — the fastest hands-on path.
2. [README → Quick Start](../README.md#quick-start) — the full workflow.
3. [Portable host adapters](current/portable-host-adapters.md) — install the
   shared-skill catalog for Codex, Claude Code, OpenCode, or Antigravity.
4. For an existing Java/Spring/Gradle project, run `npx ph attach` to inspect
   the inferred draft, then `npx ph attach --yes` to accept it. Use
   `npx ph attach --repair --yes` only for a recognized weak Persona Harness
   installation, never a ready attachment; unrecognized or corrupt files are
   not overwritten.
5. [Troubleshooting](troubleshooting/README.md) — if the agent implements
   directly, ignores the rail, or skips tickets on an existing project.

## I want to contribute

1. [CONTRIBUTING](../CONTRIBUTING.md) — the rules, including the Claim Ladder.
2. [MEASURED-CLAIMS](MEASURED-CLAIMS.md) — the boundary your change must respect.
3. Advanced/preview repository material lives in
   `docs/current/advanced-surface-index.md`; it is outside the first-run path.

## I want to review release facts

1. [Release operations](current/release/README.md) — current checklists,
   immutable-tag policy, and the last recorded channel state.
2. [Release capsules](releases/README.md) — durable versioned records.
3. [Package/version index](releases/package-index.md) — the documented package chronology.

## Platform and host support

### Portable host adapters

`ph init` installs the canonical shared-skill catalog as manifest-owned regular
files in every supported project layout. This makes the catalog discoverable; it
does not establish that a running host session selected, loaded, or followed a
skill.

| Host | Generated path |
| --- | --- |
| Codex and Antigravity | `.agents/skills/persona-harness-<skill-id>/SKILL.md` |
| Claude Code | `.claude/skills/persona-harness-claude-<skill-id>/SKILL.md` |
| OpenCode | `.opencode/skills/persona-harness-opencode-<skill-id>/SKILL.md` |

Read [Portable host adapters](current/portable-host-adapters.md) before
customizing an adapter or expecting a package update to replace it. Context and
legacy runtime injection remain default-off; Context delivery is still an
OpenCode-specific optional boundary.

### Node runtime floor

Sigstore-backed package verification requires Node.js ^20.17.0 || >=22.9.0;
Node 21 is unsupported. `ph doctor` reports a bounded runtime block and
authority verification does not run below that floor. Repository source tests
use the separate Node 20.19.0 / 22.12.0+ Vite toolchain floor.

On a supported runtime, `ph doctor` reads only its fixed npm registry origin:
the installed version's deprecation field plus `latest`, `next`, `staging`,
and legacy (`legacy`/`alpha`) channel facts. Those facts are bounded
diagnostics, not Finish authority. External assurance readiness is displayed
through a separate read-only, non-consuming inspection; neither surface moves
registry or trust state.

| CLI/runtime surface | Status | Evidence boundary |
| --- | --- | --- |
| Linux CLI/package | Product: Node ^20.17.0 || >=22.9.0; source checks: Node 20.19.0 | Required Verify repository aggregates PR fast feedback and main package integration. Pull requests run policy, typecheck, build, and the two Vitest projects; main pushes additionally run Linux Node 20.19.0 source-built, packed-tarball, and fresh local-tarball installed checks. The dispatch-only support matrix retains exact product-floor Linux Node 20.17.0 and 22.9.0 imports plus latest Linux Node 20, 22, and 24 on demand. |
| macOS CLI/package | Manual limited smoke | The dispatch-only support matrix retains macOS Node 22 smoke only; this is not a promise of macOS Node 20/24 coverage. |
| Windows | Unverified / nonblocking | No Windows matrix job or support claim. Lock identity device/inode behavior and stale-lock/concurrency conclusions are not measured or verified. |

Automatic CI boundary: Verify repository is the required PR/main aggregate. Pull requests require only the fast feedback lanes; main pushes also require Linux Node 20.19.0 package integration. The dispatch-only support matrix is deferred multi-runtime evidence, not a required PR/main gate. It is distinct from the canonical clean-CI builder's main-push signed evidence and the ordinary path-filtered diagnostic selftest.

## I am confused by docs/current

- `docs/current/` is a **working area**: active decisions, status files,
  release operations, and retained historical records.
- It is **not** the best first entry point for new users.
- Older files there are not necessarily current product claims.
- Start with this page, QUICK-DEMO, and MEASURED-CLAIMS instead.

## Product positioning boundary

Persona Harness is a **gate-first workflow rail and completion-evidence
harness**. It does not claim token saving, generated app quality, product
efficacy, closure guarantee, deterministic role enforcement, or
production-ready delegation. See [MEASURED-CLAIMS](MEASURED-CLAIMS.md).
