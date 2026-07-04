# v0.6.0-rc.3 Release Facts

## Prep State

`0.6.0-rc.3` is prepared as the next prerelease candidate after the published
`0.6.0-rc.2` line.

- Package version in repo: `0.6.0-rc.3`.
- Planned dist-tag if published later: `next`.
- No publish, tag, or dist-tag movement is part of this prep.
- Current published stable remains `latest=0.5.0`.
- Current published prerelease remains `next=0.6.0-rc.2` until a future rc3
  publish succeeds.
- Alpha remains `alpha=0.3.9-alpha.8`.
- Published `0.6.0-rc.2` gitHead:
  `d3d5fdced355f0ac0fbed5e700d57b2aa1592263`.
- Published `0.6.0-rc.2` shasum:
  `0eae3cc232e3f37de9390b0afc662a001aaa0b56`.

## Included Since `0.6.0-rc.2`

The prep includes commits after the published `v0.6.0-rc.2` line.

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

## Registry Evidence Status

This rc3 prep is registry NO-GO until a future publish includes this prep
commit and passes registry gitHead/shasum verification plus External registry
smoke. Local-current package-runtime records must not be described as registry
evidence.

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

This is release-prep documentation, not registry package evidence. It is not
evidence for token/provider-token saving, product efficacy, navigation benefit,
app quality, full-TDD/test sufficiency, broad reliability, closure guarantee,
autonomous completion, generated-app certification, deterministic role
enforcement, production-ready delegation, reliable automatic subagent
orchestration, automatic completion/downgrade/removal, or broad product claims.
