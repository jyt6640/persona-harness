# v0.6.0-rc.2 Release Facts

## Registry State

`0.6.0-rc.2` is published to npm `next` after QA publish GO, registry
gitHead/shasum verification, tag creation, and External registry smoke.

- Package version: `0.6.0-rc.2`.
- Published dist-tag: `next`.
- Stable channel remains `latest=0.5.0`.
- Current prerelease channel is `next=0.6.0-rc.2`.
- Alpha channel remains `alpha=0.3.9-alpha.8`.
- Registry gitHead:
  `d3d5fdced355f0ac0fbed5e700d57b2aa1592263`.
- Registry shasum: `0eae3cc232e3f37de9390b0afc662a001aaa0b56`.
- Registry integrity:
  `sha512-HmJplQNf896/4Sfz/FiTdJoaDU5EkMrDtxCVMU1x0LfLJzJYNDa0NGafUAgiU4zWc/IA9byDUv4+DryubMVZrg==`.
- Local and remote `v0.6.0-rc.2` tags point to the registry gitHead.
- GitHub release exists as prerelease, not draft:
  `https://github.com/jyt6640/persona-harness/releases/tag/v0.6.0-rc.2`.

## Included Since `0.6.0-rc.1`

The prep includes commits after the published `v0.6.0-rc.1` prep gitHead
`b673633533a314e1a64dd6dcb18c4097c5889a2c`.

- `479521f docs: record 0.6.0-rc.1 registry smoke`.
- `dbe11b9 docs: record ralph-loop trigger retry`.
- `d567b6b feat(cli): clarify relay subagent prompt`.
- `43a42c4 docs(cli): reframe relay as checklist rail`.
- `0fe202a docs: record role-boundary attribution caveat`.
- `4e6d2f2 docs: record ralph-loop trigger design review`.
- `5cdeb69 feat(runtime): add ralph-loop tool-output trigger`.
- `3f78ec3 docs: record ralph-loop tool-output n15 measurement`.
- `d9df388 docs: introduce versioned release docs`.
- `d75d47c docs: inventory documentation taxonomy`.
- `529031f docs: add package version index`.
- `12ae5ce docs: correct ralph-loop measurement interpretation`.
- `e3da3af feat(runtime): add ralph-loop blocker depth`.
- `c35f434 docs: record opencode subagent capability probe`.
- `59269d4 fix(cli): clarify role checklist relay naming`.
- `7b59a46 test(cli): add prompt regression fixture`.

## Package Runtime Scope

The registry-smoked package contains the rc1 package-runtime surfaces plus
post-rc1 updates:

- ralph-loop tool-output trigger and blocker-depth wording;
- workflow ralph-loop dry-run/reporting updates;
- Role Checklist Relay wording and promptBlock honesty;
- role-boundary report-only heuristic caveats;
- docs taxonomy/versioned release structure;
- prompt regression tests for safe wording.

The external loop remains archive-local prototype preparation. This release does
not introduce or claim a product `ph workflow loop` command.

## External Registry Smoke

Source: npm registry only, installed as `persona-harness@next`; local tarball
was not used.

Accepted archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc060-rc2-registry-smoke-20260704T043901Z`.
`RESULT.md` classified PASS.

Accepted package/runtime observations:

- packaged LICENSE contains `Copyright 2026 jyt6640` and no placeholder
  copyright owner text;
- ralph-loop remains default-off; `workflow ralph-loop --json` emits schema
  `workflow-ralph-loop.4`; tool-output trigger marker/depth surfaces are
  packaged; there is no product `workflow loop` command;
- Role Checklist Relay compatibility flag, AGENTS guidance, optional role
  subagent entries, role order/gates, and checklist-first `promptBlocks` were
  package-observed;
- no reliable automatic OpenCode role subagent orchestration or
  production-ready delegation wording was accepted.

Later local-current records remain registry NO-GO until a future publish
includes them and passes registry smoke.

## Release-Line Caveats

- `runtimeInjection` remains a parked opt-in preview.
- Ralph-loop remains default-off. Trigger-survival is accepted for the
  calibrated hybrid tool-output measurement, but completion-integrity movement,
  default-change, autonomous completion, and closure guarantee are not proven.
- The blocker-depth and finishable-fixture work is measurement prep, not
  completion improvement evidence.
- Role Checklist Relay is checklist-first. OpenCode task/subagent capability
  was observed in a direct probe, but PH relay still does not prove reliable
  automatic OpenCode role subagent orchestration.
- Role-boundary remains report-only and heuristic; the wrong-actor attribution
  blind spot remains active.
- Fake `gradle-shim.js` / gate-gaming is a candidate adversarial measured case
  after forged-TDD detection, pending future verification for README
  measured-behavior use.
- The prompt regression fixture is test protection only.

## No-claim Boundary

This is registry package-runtime smoke evidence only. It is not evidence for token/provider-token
saving, product efficacy, navigation benefit, app quality, full-TDD/test
sufficiency, broad reliability, closure guarantee, autonomous completion,
generated-app certification, deterministic role enforcement,
production-ready delegation, automatic completion/downgrade/removal, or broad
product claims.
