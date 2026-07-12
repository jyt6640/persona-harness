# Start Here

A reading map for people seeing Persona Harness (PH) for the first time.
`docs/current/` has many files; you do not need them to start. Use this page.

## I just want to understand the project

1. [README](../README.md) — what PH is, in one screen.
2. [MEASURED-CLAIMS](MEASURED-CLAIMS.md) — what PH can and cannot claim.
3. [QUICK-DEMO](QUICK-DEMO.md) — see it block a completion in a few minutes.

## I want to try it

1. [QUICK-DEMO](QUICK-DEMO.md) — the fastest hands-on path.
2. [README → Quick Start](../README.md#quick-start--javaspring-backend) — the
   full workflow.
3. For an existing Java/Spring/Gradle project, run `npx ph attach` to inspect
   the inferred draft, then `npx ph attach --yes` to accept it. Use
   `npx ph attach --repair --yes` only for a recognized weak Persona Harness
   installation, never a ready attachment; unrecognized or corrupt files are
   not overwritten.
4. [Troubleshooting](troubleshooting/README.md) — if the agent implements
   directly, ignores the rail, or skips tickets on an existing project.

## I want to contribute

1. [CONTRIBUTING](../CONTRIBUTING.md) — the rules, including the Claim Ladder.
2. [MEASURED-CLAIMS](MEASURED-CLAIMS.md) — the boundary your change must respect.
3. Advanced/preview repository material lives in
   `docs/current/advanced-surface-index.md`; it is outside the first-run path.

## I want to review release facts

1. [Release capsules](releases/README.md) — the versioned release docs.
2. [Package/version index](releases/package-index.md).

## Platform and host support

| Surface | Status | Evidence boundary |
| --- | --- | --- |
| macOS / Linux + OpenCode | Verified | Current Persona Harness host-adapter and product evidence is limited to OpenCode on macOS/Linux. |
| Windows | Unverified | No Windows support claim. Lock identity device/inode behavior and stale-lock/concurrency conclusions are not measured or verified. |
| Codex adapter | Planned | No current Codex adapter or Codex product evidence; this is a planned adapter only. |

The localized README files are intentionally unchanged in this acceptance unit.
Docs review should decide synchronized translations after the canonical English
support wording is accepted.

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
