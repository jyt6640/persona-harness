---
title: Local-current acceptance and 10-pair OpenCode A/B
date: 2026-07-02
source: 1563a25ca5bbddcaf3d63e7f5e7e73d61b9b718d
package: 0.4.1-rc.2
mode: local-current
result: PASS
archive: /Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/local-current-acceptance-ab-20260702-20260702-153213
acceptance: PASS 49 / N.A 5 / FAIL 0
ab: 10 paired OpenCode app-generation runs; PH ON increased measured provider tokens, read chars, and tool calls in this fixture set.
tags:
  - acceptance
  - opencode-ab
  - pminus
---

# Local-current acceptance and 10-pair OpenCode A/B

## Scope

- Source: `1563a25ca5bbddcaf3d63e7f5e7e73d61b9b718d`
- Package: `0.4.1-rc.2`
- Mode: local-current tarball
- Archive:
  `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/local-current-acceptance-ab-20260702-20260702-153213`
- Tarball shasum:
  `d8a5f85b5b7ce98c73fef547b99a941509bba518`
- Tarball sha256:
  `406f86348b9eac20c612030400a1065f9765a8d3322f04462b4e9f535076f00c`

## Acceptance

- `acceptance-summary.json` schema: `persona-acceptance-checklist.1`
- Counts: PASS 49, N.A 5, FAIL 0
- Accepted N.A items:
  - B8 full B loop not separately run
  - F2/F3 runtime injection/system-prompt internals not deterministically
    observable from package-surface logs
  - F4 hook-error isolation not forced in package acceptance
  - I3 compaction opt-in not triggered/forced
- Verification commands exited 0: typecheck, full `npm test`, build,
  `smoke:product-mvp`, `check:docs`, `check:injection-value`, npm pack dry-run,
  and git diff check.

## 10-pair A/B

- A/B summary schema: `persona-agent-session-ab.1`
- 10 paired tasks / 20 OpenCode app-generation sessions
- Concurrency cap 2; pair-internal runs were sequential
- Counterbalanced order: 5 OFF to ON, 5 ON to OFF
- Same prompt and README hash within each pair
- README sha256:
  `35dbcd343428d9de73fbfabb9c76c35334755e8996bd48c0441eb8fadac30f1c`
- OFF success: 10/10
- ON success: 10/10

| Metric | PH OFF | PH ON |
| --- | ---: | ---: |
| Mean provider total | 119,320.7 | 712,935.8 |
| Mean elapsed | 51,261.7ms | 152,525.5ms |
| Mean read chars | 1,152.7 | 20,650 |
| Mean tool calls | 15.4 | 38.9 |
| Mean MCP calls | 0 | 0 |

All 10 provider-token, read-char, tool-call, and elapsed paired deltas were
higher for PH ON. The independent sign check was two-sided `p≈0.00195` for
provider total, read chars, tool calls, and elapsed, with elapsed kept under the
archived concurrency/noisy-timing caveat.

`pminus-report` classified scenario `opencode-app-generation` as `worse` with
decision hint `remove-candidate`. `pminus-status` reported surface
`ph-runtime-injection`, outcome `worse=1`, provider telemetry `available`, and
recommended next action `remove-candidate`.

## Phase Note

All 20 runs had phase provider-token totals reconciling to run totals.
OpenCode did not expose transformed system prompt or injection-context cost
separately, so the aggregate phase table excludes `injection/context`; that
cost remains embedded in classified model steps and unknown buckets.

## Boundaries

This is local-current acceptance and scoped negative A/B measurement evidence
for this fixture/task set only. It supports P-minus review/decision support
only. It is not a token-saving, provider-token saving, product-efficacy,
navigation-benefit, app-quality, full-TDD/test-sufficiency, CodeGraph/LSP
default/effectiveness, broad reliability, closure guarantee, Codex/code-nav
replacement, automatic downgrade/removal, publish, tag, latest, dist-tag, or
universal product claim.
