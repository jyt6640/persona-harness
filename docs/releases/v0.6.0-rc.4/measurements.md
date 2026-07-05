# v0.6.0-rc.4 Measurement Summary

This summary points to accepted measurement/status records that shape the
published `0.6.0-rc.4` prerelease. It does not replace append-only status files under
`docs/current/`.

## H1-0 Preflight

H1-0 is PARTIAL for stable readiness:

- The final `0.6.0-rc.3` registry-smoke docs record closed at commit
  `c285bfcd845914d103503c38bd9a76c6baefd380`.
- Stage 18 provider-token cost-per-verified-completion telemetry was recorded.
  OFF finish PASS was `0/10`, so cost per verified completion is `infinite`.
  Internal and external values are telemetry only, not token-saving evidence.
- The real n>=5 rail-entry regression gate was not satisfied for stable.

## H1-6a Compression Precheck

H1-6a repeated-output compression is rejected for this prep. The real
rail-entry precheck observed:

| Condition | Rail entry |
| --- | ---: |
| Current/control | `3/5` |
| Summary-header candidate | `1/5` |

Delta: `-40pp`. Non-inferiority was not met.

The repeated finish/check behavior rows were no-worse, but the rail-entry gate
is the prerequisite. Compression remains NO-GO and unimplemented.

## H1-6b Structured Finish Summary

H1-6b is accepted: failed `workflow finish implement` human summaries are
derived from structured closure blocker/required-fix objects instead of
reparsing rendered `Closure blocker:` text. The accepted Stage 20 summary
shape, H1-1 unmapped-blocker escalation wording, and H1-4 mapped toolchain
guidance are preserved.

This is output robustness hardening. It is not a product-efficacy,
token-saving, broad reliability, closure-guarantee, or app-quality claim.

## H1-1 through H1-5 Hardening

- H1-1: unmapped blockers stop continuation loops and surface human
  configuration/maintainer escalation.
- H1-2: mechanical finish regression protects a finish-reachable
  Java/Spring-shaped fixture.
- H1-3: deterministic blocker order and current gate-chain depth contract are
  locked in tests.
- H1-4: explicit block-level ast-grep/toolchain-dependent conventions fail
  closed when the required toolchain is missing or fails; built-in warning
  conventions remain warnings.
- H1-5: atomic writes and fail-safe reads were split by file family.

## Stable Deferral

`0.6.0` stable remains deferred. `0.6.0-rc.4` is a prerelease `next` package,
not stable. HARDEN-2 should not proceed until stable prerequisites are
separately met or waived.

## Stable Cycle S-0 Correction

H1-6a compression NO-GO itself does not block stable, because the HARDEN-1
compression spec allowed rollback or record when a compression candidate was
worse. The unresolved stable-decision issue is the shipped rc3/rc4 `Summary:`
header. Its only real-session rail-entry evidence set so far is the H1-6a real
precheck (`n=5`, candidate `1/5` vs current/control `3/5`), and that evidence
points inferior. S-2 must regate whether the shipped header is harmful or noisy;
stable should be re-evaluated after that result.

The prior rc4 criterion also needs a future-facing correction. A release
candidate that carries gate-behavior-changing hardening before stable should
have a prerelease validation distribution. This is a criteria improvement for
future decisions, not a retroactive claim that earlier criterion wording was
already satisfied.

S-0 also confirmed H1-0c telemetry was already recorded in
`docs/current/ralph-loop-measurement-status.md`: OFF cost per verified
completion is `∞`, internal is `60485.35`, and external is `84572.61`. This is
telemetry only, not token/provider-token saving evidence.

## Claim Boundary

None of the measurements above support product efficacy, token/provider-token
saving, navigation benefit, app quality, full-TDD/test sufficiency, broad
reliability, closure guarantee, autonomous completion, generated-app
certification, deterministic enforcement, production-ready delegation, reliable
automatic subagent orchestration, automatic completion/downgrade/removal, or
CodeGraph/LSP default/effectiveness.
