# v0.6.0-rc.1 Release Facts

## Registry

QA accepted the Stage 14 External registry smoke as registry package-runtime
evidence only.

- Package: `persona-harness@next=0.6.0-rc.1`.
- Registry gitHead:
  `b673633533a314e1a64dd6dcb18c4097c5889a2c`.
- Registry shasum: `5c8bcd5c1bd4165dd129e39624408672f88091ce`.
- Dist-tags: `latest=0.5.0`, `next=0.6.0-rc.1`,
  `alpha=0.3.9-alpha.8`.
- Local and remote `v0.6.0-rc.1` tags point to
  `b673633533a314e1a64dd6dcb18c4097c5889a2c` after registry verification.
- Trusted Publisher run `28653322434` succeeded.
- Release workflow run `28653429619` succeeded.

External archive:

`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage14-rc060-rc1-registry-smoke-20260703T100732Z`

## Package Runtime Smoke

The registry smoke observed package entries for localized READMEs,
`CHANGELOG.md`, `docs/current/release/v0.6.0-rc.1-release-notes.md`,
ralph-loop/state runtime, session registry, hooks, role-boundary
heuristic/policy/evidence, continuation utterance gate,
`workflow ralph-loop`, `workflow role-boundary`, bootstrap, workflow relay, and
continuation prompt.

Accepted command surfaces exited 0:

- `ph --help`;
- `ph version`, returning `0.6.0-rc.1`;
- `ph bootstrap --help`;
- `workflow ralph-loop --json`;
- `workflow role-boundary --json` and human output;
- default init/bootstrap;
- multi-agent preview init/bootstrap/rerun;
- `workflow relay status --json`;
- `workflow relay next --json`;
- the smoke driver.

`workflow ralph-loop --json` emitted `workflow-ralph-loop.3`, stayed
default-off/dry-run/no-write, and reported `maxAttempts=3` plus
`maxSessionAttempts=9`.

`workflow role-boundary --json` emitted `workflow-role-boundary-report.2`,
remained report-only/heuristic, reported block mode unavailable/no
deterministic enforcement, and wrote no files.

Bootstrap relay guidance remained absent by default, present and idempotent
with `--multi-agent-preview`, and relay status/next JSON used role order
`test-writer`, `implementer`, `reviewer`.

Mutation boundaries held: ralph-loop dry-run and role-boundary report wrote no
files; other writes were confined to disposable fixture init/bootstrap/workflow
state. External did not publish again, tag, move `latest`/dist-tags, or change
version.

## Release-Line Caveats

- `runtimeInjection` remains a parked opt-in preview. The release does not
  make a default change or removal claim.
- Ralph-loop remains default-off and parked. Stage 12 did not exercise
  ralph-loop in the ON model-session pilot.
- Static relay guidance is observable through package surfaces, but Stage 13
  did not show reliable OpenCode role subagent invocation or orchestration.
- Role-boundary remains report-only and heuristic. Block mode remains
  unavailable without stable per-session role identity.
- The scorecard is secondary archive observation only and does not override
  preregistered kill criteria.

## No-claim Boundary

This is registry package-runtime smoke only. It is not evidence for
token/provider-token saving, product efficacy, navigation benefit, app quality,
full-TDD/test sufficiency, broad reliability, closure guarantee, autonomous
completion, generated-app certification, deterministic role enforcement,
production-ready delegation, automatic completion/downgrade/removal, or broad
product claims.
