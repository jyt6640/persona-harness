# v0.6.0-rc.4 Release Facts

## Registry State

`0.6.0-rc.4` is published as the current prerelease package after the published
`0.6.0-rc.3` line.

- Published package version: `0.6.0-rc.4`.
- Published dist-tag: `next`.
- Source: npm registry only; External smoke installed `persona-harness@next`.
- Current published stable remains `latest=0.5.0`.
- Current published prerelease is `next=0.6.0-rc.4`.
- Alpha remains `alpha=0.3.9-alpha.8`.
- Published `0.6.0-rc.4` gitHead:
  `cf6835697f47da5a2a8372d00fc47e263ee781f8`.
- Published `0.6.0-rc.4` shasum:
  `76565f6e7d244595fa338bb646ea7888d8d5255a`.
- Published `0.6.0-rc.4` integrity:
  `sha512-8oBVX1vmudoNZCJEVXNdx/lJnPITKD0cW2OGk6Bv963oibNwyo+itxYquRNr8JlDQR7RKDmcQ5XTCVlIP9weaw==`.
- `persona-harness@0.6.0-rc.4` resolves to the same facts as
  `persona-harness@next`.
- `persona-harness@latest` remains `0.5.0`, gitHead
  `c0f1085a5182cdd17411bd043173aabc9a76b30e`, shasum
  `3a7c43e4807e7cc8bd1b6c697746d6334ee56b09`.
- Local and remote `v0.6.0-rc.4` tags point to
  `cf6835697f47da5a2a8372d00fc47e263ee781f8`.
- GitHub release exists and is prerelease/not draft.
- Accepted External archive:
  `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/rc060-rc4-registry-smoke-20260705T110131Z`.

## Stable Deferral

Stable `0.6.0` is not being prepared. HARDEN-2 remains blocked because stable
is not published and external tester recruitment for stable has not started.

S-0 correction: H1-6a repeated-output compression did not satisfy the real n=5
rail-entry non-inferiority precheck (`3/5` control, `1/5` candidate, delta
`-40pp`), but compression NO-GO itself is not the stable blocker because the
HARDEN-1 compression spec allowed rollback or record when worse. The unresolved
stable-decision issue is the shipped rc3/rc4 `Summary:` header having only that
one real-session rail-entry evidence set so far, in the inferior direction.
S-2 must regate whether the shipped header is harmful or noisy; stable should
be re-evaluated after S-2.

S-0 criterion consistency: gate-behavior-changing hardening before stable also
requires a prerelease validation distribution. This is an improved future
criterion, not a retroactive claim that earlier rc4 justification wording was
already satisfied.

## Included Since `0.6.0-rc.3`

The prep includes commits after the published `v0.6.0-rc.3` line.

- `fd68207`: HARDEN-1 H1-0 preflight record after rc3 registry smoke.
- `8f3d0b5` and `35a8bb6`: H1-1 unmapped blocker de-loop and human escalation
  wording.
- `4d5cd60`: H1-3 deterministic blocker order and chain-depth contract.
- `0485ec2`: H1-2 mechanical finish regression.
- `e07e742` and `c629294`: H1-4 block-level toolchain fail-closed behavior and
  mapped human toolchain guidance.
- `f4e6f64`, `1a8fe20`, `b848c61`, `2c13b2e`, `c37ea01`, and `3aba7bd`:
  H1-5 atomic writes and fail-safe reads split by file family.
- `c81e1d9` and `6b0cd60`: H1-6 precheck block and H1-6a real precheck record,
  including compression NO-GO.
- `501ac11`: H1-6b structured finish summary derivation.

## Accepted Local-Current Package Runtime Records

H1-1, H1-4, H1-5, and H1-6b were first accepted through their respective
QA/External local-current package-runtime or focused verification lanes before
the rc4 release prep. The final rc4 registry smoke now covers the published
package for representative package-runtime surfaces while preserving the
original local-current provenance for those implementation-specific records.

The records are scoped:

- H1-1 records blocker-step contract behavior and human escalation wording.
- H1-4 records explicit block-level toolchain fail-closed behavior and mapped
  human guidance; built-in warning-level conventions remain warnings.
- H1-5 records atomic writes/fail-safe reads by touched file family only, not a
  repo-wide all-writes guarantee.
- H1-6b records structured finish summary derivation, with gate semantics,
  JSON/machine output, exit codes, defaults, and schema fields unchanged.

## Registry Smoke Observations

The final rc4 registry smoke observed required package entries including rc4
release docs, `dist/io/atomic-file.*`,
`dist/cli/workflow-required-fix.*`, `dist/cli/workflow-output.js`, closure,
loop, ralph-loop, and Role Checklist Relay surfaces. Registry
install/version/help passed.

The smoke covered failed finish plus repeated finish, closure JSON, H1-4
toolchain path, H1-1 unmapped path, representative H1-5 atomic/corrupt-state
behavior, and retained rc3 workflow-loop/ralph-loop/relay surfaces.

H1-6b finish `Summary:` appeared before `Required fixes:`, detailed blockers
remained, and closure JSON parsed. No H1-6a compression wording appeared.
H1-6a compression remains NO-GO and unimplemented.

H1-4 `convention-toolchain-missing` used mapped install/configure/lower-level
guidance plus rerun `npx ph workflow check`; JSON maps to
`install-convention-toolchain`. H1-1 unmapped custom blocker retained
escalation wording, JSON had `unmapped-blocker` with no direct command,
`workflow loop` dry-run stopped at zero iterations, and ralph-loop reported
the unmapped next step.

Caveats: initial H1-4/H1-1 fixtures had prerequisite blockers ahead, so
isolated populated reruns were used to put target blockers first. H1-5 coverage
is representative, not a full repeat of every H1-5 family.

## Release-Line Caveats

- `runtimeInjection` remains a parked opt-in preview.
- Ralph-loop and `ph workflow loop` remain default-off/explicit surfaces; no
  default change is made.
- H1-6a repeated-output compression remains NO-GO and unimplemented.
- No `.persona/evidence` schema expansion is included.
- No OpenCode hook signature change is included.
- No gate exit-code or JSON schema field movement is included.
- S-0 made no `alpha`, `latest`, or `next` dist-tag mutation. Live alpha state
  remains `alpha=0.3.9-alpha.8`, gitHead
  `3bb90aa50c8d1231189a5ca00665e8d5bfccade9`, shasum
  `cd26989425223b5145f190c2dfbfa5ad84e57cf9`; changing or removing `alpha`
  requires a separate explicit policy decision.

## No-claim Boundary

This is registry package-runtime smoke evidence only. It is not evidence for
product efficacy, token/provider-token saving, navigation benefit, app quality,
full-TDD/test sufficiency, broad reliability, closure guarantee, autonomous
completion, generated-app certification, deterministic enforcement,
production-ready delegation, reliable automatic subagent orchestration,
automatic completion/downgrade/removal, CodeGraph/LSP default/effectiveness, or
broad product claims.
