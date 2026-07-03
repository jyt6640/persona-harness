# Rail-Entry Measurement Status

Last updated: 2026-07-03

This status note is an append-only interpretation correction for the Stage 3
rail-entry A/B archive. It does not modify the historical archive, product
behavior, evidence schemas, defaults, or release channels.

## Stage 3 Archive

Archive:
`/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stage3-rail-entry-ab-15-20260703T025514Z`

Relevant archive file:
`measurement-plan.json`

The Stage 3 measurement plan defined:

- PH OFF: no local PH install, no workspace OpenCode plugin, and
  `NPM_CONFIG_OFFLINE=true` for agent commands.
- PH ON: local-current PH tarball installed, `ph bootstrap backend
  --runtime-injection-preview --no-developer-mcp --no-codegraph --force`, and
  `runtimeInjection=true` asserted.

## Corrected Interpretation

Stage 3 measured `PH stack present vs PH absent` rail entry. A clearer short
label is `stack-vs-nothing rail entry`.

Stage 3 did not measure the preregistered H1 question:
`runtimeInjection ON vs OFF with all other PH stack setup equal`.

Therefore, Stage 3 must not be cited as banner-only effect evidence or as proof
that `runtimeInjection` itself caused the rail-entry delta. The archive remains
useful as scoped rail-entry evidence for a stack-present condition, but it is
not a runtimeInjection/banner-only default-changing measurement.

Runtime injection remains default OFF because the default-changing H1
measurement is still absent. This is not a claim that Stage 3 proved a positive
or negative banner-only/runtimeInjection effect.

## Current Decision Boundaries

- No token-saving or provider-token-saving claim.
- No product-efficacy or navigation-benefit claim.
- No app-quality, full-TDD, or test-sufficiency claim.
- No broad reliability or closure guarantee claim.
- No autonomous-loop, generated-app certification, automatic completion,
  downgrade, removal, or enforcement claim.
- No product behavior, evidence schema, default, version, publish, tag, latest,
  or dist-tag movement is made by this correction.

## Deferred Stage 10 Note

Stage 10 remains deferred. The current `ph workflow role-boundary [--json]`
surface observes relay artifact scans only; it does not observe production
source writes and does not enforce write blocking. Any wording/time-window
heuristic for production source role-boundary observation requires separate
Stage 10 approval.
