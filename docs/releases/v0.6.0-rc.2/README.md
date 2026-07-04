# v0.6.0-rc.2 Release Capsule

This capsule is the durable index for the `0.6.0-rc.2` prerelease line. It
complements the release-operation notes in
[`docs/current/release/v0.6.0-rc.2-release-notes.md`](../../current/release/v0.6.0-rc.2-release-notes.md).

## Channel State

- Published prerelease package: `persona-harness@next=0.6.0-rc.2`.
- Registry gitHead:
  `d3d5fdced355f0ac0fbed5e700d57b2aa1592263`.
- Registry shasum: `0eae3cc232e3f37de9390b0afc662a001aaa0b56`.
- Registry integrity:
  `sha512-HmJplQNf896/4Sfz/FiTdJoaDU5EkMrDtxCVMU1x0LfLJzJYNDa0NGafUAgiU4zWc/IA9byDUv4+DryubMVZrg==`.
- Dist-tags after verification: `latest=0.5.0`, `next=0.6.0-rc.2`,
  `alpha=0.3.9-alpha.8`.
- Stable `latest` did not move.
- Local and remote `v0.6.0-rc.2` tags point to
  `d3d5fdced355f0ac0fbed5e700d57b2aa1592263` after registry verification.
- GitHub release:
  `https://github.com/jyt6640/persona-harness/releases/tag/v0.6.0-rc.2`;
  prerelease, not draft.

## Durable Records

- [`release-facts.md`](release-facts.md): prep facts, included commits, and
  release boundaries.
- [`measurements.md`](measurements.md): scoped measurement and probe summaries
  that govern this release prep.

## Registry Smoke

External registry smoke installed `persona-harness@next` from npm only; no
local tarball was used. Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc060-rc2-registry-smoke-20260704T043901Z`.
`RESULT.md` classified the smoke as PASS.

Package-runtime observations:

- packaged LICENSE contains `Copyright 2026 jyt6640` and no placeholder owner
  text;
- `workflow ralph-loop --json` emits schema `workflow-ralph-loop.4`; ralph-loop
  remains default-off and the tool-output trigger marker/depth surfaces were
  packaged; there is no product `workflow loop` command;
- Role Checklist Relay package surfaces accept the compatibility flag, write
  AGENTS guidance when previewed, keep role order/gates, expose
  checklist-first `promptBlocks`, and keep optional host-dependent role
  subagent entries;
- the smoke did not accept reliable automatic OpenCode orchestration,
  production-ready delegation, deterministic role enforcement, or broader
  product claims.

Later local-current records still require a future publish before they become
registry evidence.

## Boundaries

Do not use this release capsule to claim token/provider-token saving, product
efficacy, navigation benefit, app quality, full-TDD/test sufficiency, broad
reliability, closure guarantee, autonomous completion, generated-app
certification, deterministic role enforcement, production-ready delegation,
automatic completion/downgrade/removal, or CodeGraph/LSP default/effectiveness.
