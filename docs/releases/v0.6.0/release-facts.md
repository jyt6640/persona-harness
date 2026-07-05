# v0.6.0 Release Facts

## Registry State

`0.6.0` is the current stable package published to npm `latest`.

- Accepted archive:
  `/Users/yongtae/Desktop/persona-harness-artifacts/archive/2026-06-24-desktop-persona-runs/stable-060-registry-smoke-20260705T041031Z`.
- Source: npm registry only; installed `persona-harness@latest`; no local
  tarball evidence.
- Installed package: `persona-harness@0.6.0`.
- `persona-harness@latest`: version `0.6.0`, gitHead
  `13b1f1b79884e2214c0b41a735b87cdd6d65ee00`, shasum
  `ffd77996263cffb858bd977edb73b03cf2820c75`, integrity
  `sha512-0dY/LqXYuSD7/G/GsALoE0RBKClikt1MPVR6GvbXRieBiSDh5CEt0JNP0RxJ8Ur3howsURYeaFQX8aRhSzKP0A==`.
- Explicit `persona-harness@0.6.0` resolves to the same version, gitHead,
  shasum, and integrity.
- Stable smoke-time dist-tags were `latest=0.6.0`, `next=0.6.0-rc.4`, and
  `alpha=0.3.9-alpha.8`. The later ROLE-RULES T0 cleanup retired the legacy
  `alpha` dist-tag; live readback now shows `latest=0.6.0` and
  `next=0.6.0-rc.4`.
- Local and remote `v0.6.0` point to
  `13b1f1b79884e2214c0b41a735b87cdd6d65ee00`.
- GitHub release `v0.6.0` is stable: `isDraft=false`,
  `isPrerelease=false`.

## Stable Decision Basis

The stable decision cycle S-0 through S-3 resolved the prior stable blocker:

- S-0 corrected the blocker: H1-6a compression NO-GO itself did not block
  stable; the shipped failed-finish human `Summary:` header's inferior
  real-session rail-entry evidence did.
- S-1 established `gate-fixture.2` with control rail entry `10/10`.
- S-2 regated the `Summary:` header: control `10/10`, candidate `9/10`, delta
  `-10pp`, non-inferiority false, decision
  `FAIL_RECOMMEND_HEADER_OFF_FOR_S3`.
- S-3 removed the failed-finish human `Summary:` header and QA/External
  accepted local-current package smoke at commit
  `c7affd7674fc949b373c414974b05010b8dd1f21`.

With the header off, failed `ph workflow finish implement` human stderr renders
`Required fixes:` directly. Detailed blocker diagnostics remain visible, and
`workflow closure next --json` remains the machine-readable next-step surface.

## Included Since `0.6.0-rc.4`

- `fdc2623`: S-1 `gate-fixture.2` record with control rail entry `10/10`.
- `d4cce82`: S-2 Summary-header regate record with candidate `9/10` vs control
  `10/10`, non-inferiority false.
- `c7affd7`: S-3 removal of the failed-finish human `Summary:` header.

## Stable HARDEN-1 Surface

- H1-1 records unmapped blocker de-loop and human escalation.
- H1-2 records mechanical finish regression coverage.
- H1-3 records deterministic blocker order and chain-depth contract.
- H1-4 records explicit block-level toolchain fail-closed behavior and mapped
  human guidance.
- H1-5 records atomic writes and fail-safe reads by migrated file family only.
- H1-6a repeated-output compression remains NO-GO and unimplemented.
- H1-6b structured required-fix data remains implementation support, but the
  failed-finish human `Summary:` header is not rendered.

## Final Registry Smoke

The final stable registry smoke observed required package entries including
LICENSE, localized READMEs, CHANGELOG, stable docs, `dist/io/atomic-file.*`,
`dist/cli/workflow-required-fix.*`, `dist/cli/workflow-output.js`, closure,
workflow-loop/state, ralph-loop/state/tool-output, workflow relay/UI, and
bootstrap multi-agent surfaces.

Basic install, help, version, workflow help, and bootstrap help succeeded.
Stable S-3 failed-finish output had no `Summary:` header, retained
`Required fixes:` and detailed blocker diagnostics, and had no
`details unchanged since last check` or H1-6a compression wording. Generic
closure JSON parsed with `action=next`, `nextStep.id=verify-app`, and first
blocker `verification-unknown`.

The smoke covered the H1-4 `convention-toolchain-missing` path and mapped it to
`install-convention-toolchain` with
`commandAfterContent="npx ph workflow check"`. It also covered the H1-1
unmapped path with escalation/no-step-mapping wording, `unmapped-blocker`, and
loop/ralph-loop stop surfaces; representative H1-5 `writeFileAtomic`
success/failure cleanup and corrupt ralph-loop state no-crash; and retained
default-off/schema-stable surfaces including `workflow-ralph-loop.4`,
`workflow-loop.1`, and Role Checklist Relay checklist-first/host-dependent
guidance.

H1-1/H1-4 blocker fixtures reused prior accepted disposable fixture shapes to
isolate target blockers. H1-5 coverage is representative helper/corrupt-state
spot smoke, not repo-wide all-writes atomicity evidence. No real
OpenCode/model/eval run was performed in the stable registry smoke.

## Release-Line Caveats

- `runtimeInjection` remains a parked opt-in preview.
- Ralph-loop and `ph workflow loop` remain default-off/explicit surfaces; no
  default change is made.
- Stage 18 completion-integrity evidence remains fixture-scoped and does not
  prove broad product efficacy, reliability, app quality, token saving, or a
  default change.
- No `.persona/evidence` schema expansion is included.
- No OpenCode hook signature change is included.
- No gate exit-code or JSON schema field movement is included.
- No publish, tag, latest, next, or alpha dist-tag movement is included in this
  docs-record task.

## Tester Plan

This final stable record is the handoff point for external tester recruitment.
Recruitment is planned/ready to start; this release-facts file records no
concrete started-recruitment evidence. `PROJECT-PLAN.md` section 4 makes
stable the trigger for 3-5 external testers. Tester observation should focus
on onboarding drop-off, time to first finish, doctor/feedback usage, user
reaction to gate blocks, team-convention demand, real fake-shim or gate-gaming
incidents, and tester-driven UX complaints.

HARDEN-2 may start only after this stable final record and tester kickoff
status are recorded. It remains subordinate to incoming tester feedback.

## No-claim Boundary

This is registry package-runtime smoke evidence only. It is not evidence for
product efficacy, token/provider-token saving, navigation benefit, app quality,
full-TDD/test sufficiency, broad reliability, closure guarantee, autonomous
completion, generated-app certification, deterministic enforcement,
production-ready delegation, reliable automatic subagent orchestration,
automatic completion/downgrade/removal, CodeGraph/LSP default/effectiveness,
or broad product claims.
