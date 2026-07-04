# v0.6.0-rc.2 Release Facts

## Prep State

This is release prep only.

- Package version: `0.6.0-rc.2`.
- Target dist-tag after future QA publish GO: `next`.
- Stable channel remains `latest=0.5.0`.
- Current prerelease channel remains `next=0.6.0-rc.1` until rc2 publish.
- Alpha channel remains `alpha=0.3.9-alpha.8`.
- Do not publish, tag, or move dist-tags in this prep.

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

The prep targets a package containing the rc1 package-runtime surfaces plus
post-rc1 updates:

- ralph-loop tool-output trigger and blocker-depth wording;
- workflow ralph-loop dry-run/reporting updates;
- Role Checklist Relay wording and promptBlock honesty;
- role-boundary report-only heuristic caveats;
- docs taxonomy/versioned release structure;
- prompt regression tests for safe wording.

The external loop remains archive-local prototype preparation. This prep does
not introduce or claim a product `ph workflow loop` command.

## Registry State

There is no accepted registry evidence for `0.6.0-rc.2` at prep time.

Future publish sequence must verify:

- `persona-harness@0.6.0-rc.2` version/gitHead/shasum;
- `persona-harness@next=0.6.0-rc.2`;
- `latest=0.5.0`;
- `alpha=0.3.9-alpha.8`;
- local and remote `v0.6.0-rc.2` tag after registry verification only.

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

This is release-prep evidence only. It is not evidence for token/provider-token
saving, product efficacy, navigation benefit, app quality, full-TDD/test
sufficiency, broad reliability, closure guarantee, autonomous completion,
generated-app certification, deterministic role enforcement,
production-ready delegation, automatic completion/downgrade/removal, or broad
product claims.
