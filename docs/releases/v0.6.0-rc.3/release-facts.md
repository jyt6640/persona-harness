# v0.6.0-rc.3 Release Facts

## Registry State

`0.6.0-rc.3` is published to npm `next` after QA publish GO, registry
gitHead/shasum verification, tag creation, and External registry smoke.

- Package version: `0.6.0-rc.3`.
- Current prerelease channel: `next=0.6.0-rc.3`.
- Current published stable remains `latest=0.5.0`.
- Alpha remains `alpha=0.3.9-alpha.8`.
- `persona-harness@next` and explicit `persona-harness@0.6.0-rc.3` resolve to
  gitHead `e1af520cf000e805e7df6a1616906f3f9b0e4976`, shasum
  `ef498adfac138d9d0843406cba53acf76b34c6f1`, and integrity
  `sha512-nXImwyxON5zoph8Y3LyXqJhW1NIcX+3JvsBSFAdQlersZ8zO1KmRuRJVKB1DF87fbYxDpVyxMqFU1C6sA8HJQQ==`.
- `persona-harness@latest` remains `0.5.0`, gitHead
  `c0f1085a5182cdd17411bd043173aabc9a76b30e`, shasum
  `3a7c43e4807e7cc8bd1b6c697746d6334ee56b09`.
- Local and remote `v0.6.0-rc.3` tags point to the registry gitHead.
- GitHub release:
  `https://github.com/jyt6640/persona-harness/releases/tag/v0.6.0-rc.3`;
  draft false, prerelease true.
- External registry smoke archive:
  `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc060-rc3-registry-smoke-20260704T133936Z`.
- The smoke source was npm registry `persona-harness@next` only; no local
  tarball evidence was used.

## Included Since `0.6.0-rc.2`

This prerelease includes commits after the published `v0.6.0-rc.2` line.

- `58f53c184733e318431943c7f5e2a2cf9f75292c`:
  Stage 15 ralph-loop measurement correction and fake-shim candidate
  adversarial case frequency audit.
- `e3374f9`, `5382179`, `6a2ed2b`, `dfb08c0`, `cb15731`:
  Stage 16 rail-entry prompt regression gate, package visibility/policy
  maintenance, canonical docs index, and external-review adoption/rejection
  status.
- `d4d85bc9f36a6b345c0065aba9fb5fb0e4e5c876`:
  Stage 17 explicit `ph workflow loop` command, bounded process runner, and
  workflow-loop state.
- `02144dc7063cde4932f285133efcb90e20ed068d`:
  Stage 18 main rerun measurement status.
- `2f3625da7e56551ad5b2bc31bf83a3a298f1ef9a`:
  Stage 20 failed-finish human `Summary:` output before existing details.

## Accepted Local-Current Package Runtime Records

Stage 17 External local-current package-runtime smoke archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage17-workflow-loop-package-smoke-d4d85bc-20260704T092858Z`.

Accepted scope: package-runtime/command viability for explicit
`ph workflow loop`; not completion-integrity/default-change/product evidence.

Stage 20 External local-current package-runtime smoke archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage20-finish-summary-package-smoke-2f3625d-20260704T130812Z`.

Accepted scope: human-output UX and measurement-support surface only. Gate
semantics, exit codes, closure blockers, and JSON semantics are unchanged.

## Accepted Registry Package Runtime Records

The final rc3 registry smoke observed package entries for LICENSE, localized
READMEs, `CHANGELOG.md`, current rc3 release notes, rc3 versioned capsule
files, `workflow-loop`, `workflow-loop-state`, `bounded-process`,
`workflow-output`, `workflow-ralph-loop`, `workflow-relay`, and
`workflow-relay-ui`. Packaged LICENSE contains `Copyright 2026 jyt6640` and no
template placeholders.

Accepted Stage 17 registry package behavior:

- `ph workflow loop` dry-run emitted schema `workflow-loop.1`,
  `defaultOff=true`, blocker-depth prompt, and no state write.
- Execute mode with a fake bounded OpenCode operation wrote workflow-loop state
  plus prompt/stdout/stderr artifacts and ended at iteration cap.

Accepted Stage 20 registry package behavior:

- Failed `ph workflow finish` stderr includes `Summary:` before
  `Required fixes:`.
- Detailed blockers remain available.
- Closure JSON parses.

Accepted continuation/relay observations:

- `ph workflow ralph-loop --json` reports `workflow-ralph-loop.4`,
  `defaultOff=true`, and `mutates=false`.
- Role Checklist Relay remains checklist-first; host subagent/task invocation
  is optional and host-dependent, and role artifacts record used/unavailable
  status.

## Release-Line Caveats

- `runtimeInjection` remains a parked opt-in preview.
- Ralph-loop remains default-off. Stage 18 proves fixture-scoped
  completion-integrity movement only for the accepted finish-reachable fixture.
- `ph workflow loop` is explicit user-command behavior, not a hook/default
  behavior and not autonomous completion.
- Role Checklist Relay remains checklist-first with optional host-dependent
  subagent invocation; reliable automatic OpenCode orchestration is not proven.
- Role-boundary remains report-only and heuristic.
- Fake-shim gate-gaming remains a candidate adversarial measured case, not a
  broad reliability claim.

## No-claim Boundary

This registry package-runtime record is not evidence for token/provider-token
saving, product efficacy, navigation benefit, app quality, full-TDD/test
sufficiency, broad reliability, closure guarantee, autonomous completion,
generated-app certification, deterministic role enforcement, production-ready
delegation, reliable automatic subagent orchestration, automatic
completion/downgrade/removal, or broad product claims.
