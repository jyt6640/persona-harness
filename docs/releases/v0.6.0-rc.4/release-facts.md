# v0.6.0-rc.4 Release Facts

## Prep State

`0.6.0-rc.4` is prepared as the next prerelease candidate after the published
`0.6.0-rc.3` line.

- Package version in repo: `0.6.0-rc.4`.
- Planned dist-tag if published later: `next`.
- No publish, tag, or dist-tag movement is part of this prep.
- Current published stable remains `latest=0.5.0`.
- Current published prerelease remains `next=0.6.0-rc.3` until a future rc4
  publish succeeds.
- Alpha remains `alpha=0.3.9-alpha.8`.
- Published `0.6.0-rc.3` gitHead:
  `e1af520cf000e805e7df6a1616906f3f9b0e4976`.
- Published `0.6.0-rc.3` shasum:
  `ef498adfac138d9d0843406cba53acf76b34c6f1`.

## Stable Deferral

Stable `0.6.0` is not being prepared. HARDEN-2 remains blocked because stable
is not published and external tester recruitment for stable has not started.
The immediate stable gate also failed: H1-6a repeated-output compression did
not satisfy the real n=5 rail-entry non-inferiority precheck (`3/5` control,
`1/5` candidate, delta `-40pp`). Compression remains NO-GO and unimplemented.

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

H1-1, H1-4, H1-5, and H1-6b were accepted through their respective QA/External
local-current package-runtime or focused verification lanes before this release
prep. They are included as local-current evidence until a future rc4 publish
and registry smoke cover this prep commit.

The records are scoped:

- H1-1 records blocker-step contract behavior and human escalation wording.
- H1-4 records explicit block-level toolchain fail-closed behavior and mapped
  human guidance; built-in warning-level conventions remain warnings.
- H1-5 records atomic writes/fail-safe reads by touched file family only, not a
  repo-wide all-writes guarantee.
- H1-6b records structured finish summary derivation, with gate semantics,
  JSON/machine output, exit codes, defaults, and schema fields unchanged.

## Registry Evidence Status

This rc4 prep is registry NO-GO until a future publish includes this prep
commit and passes registry gitHead/shasum verification plus External registry
smoke. Local-current package-runtime records must not be described as registry
evidence.

## Release-Line Caveats

- `runtimeInjection` remains a parked opt-in preview.
- Ralph-loop and `ph workflow loop` remain default-off/explicit surfaces; no
  default change is made.
- H1-6a repeated-output compression remains NO-GO and unimplemented.
- No `.persona/evidence` schema expansion is included.
- No OpenCode hook signature change is included.
- No gate exit-code or JSON schema field movement is included.

## No-claim Boundary

This is release-prep documentation, not registry package evidence. It is not
evidence for product efficacy, token/provider-token saving, navigation benefit,
app quality, full-TDD/test sufficiency, broad reliability, closure guarantee,
autonomous completion, generated-app certification, deterministic enforcement,
production-ready delegation, reliable automatic subagent orchestration,
automatic completion/downgrade/removal, CodeGraph/LSP default/effectiveness, or
broad product claims.
