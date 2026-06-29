# Release Docs

Use this package for repeatable release operations and release note drafting.

## Release Messaging Guardrail

Describe Persona Harness as an AI coding workflow rail + evidence + continuation harness.

Do not describe a release as:

- a Java Clean Code quality guarantee;
- generated app product-quality certification;
- evidence count proving quality improvement;
- AST/linter/build-failure enforcement.

External smoke and A/B or ON/OFF runs may be reported as stack-steering and workflow-closure signals only. Mention limits when relevant: small sample size, `n=1`, non-blind runs, same operator, and model/version/prompt/timeout/continuation dependence.

## 0.3.9-alpha Pre-Eval Stop Gate

Before moving from the `0.3.9-alpha` cleanup lane into `0.4` eval work, HQ must stop and ask the user for a `0.3.9-alpha` publish or release decision.

Do not start `0.4` eval immediately after the following are complete:

- `0.3.9-alpha` pre-eval code-debt cleanup;
- QA eval fixture / kill-gate documentation;
- verified report schema documentation.

Those items make the release decision ready; they do not authorize Docs Release to publish, push, tag, or start release prep without HQ/user approval.

## Current Version-Line Readiness

`0.3.9-alpha.7` shipped the read-only workflow closure planner and produced one
Windows SSH registry implementation-to-finish product usability PASS. That is a
workflow rail product signal, not eval proof, PH superiority proof, generated
app quality certification, or a general reliability guarantee.

Current release line: fresh `0.4.0-rc.1` prep from alpha8 closure convergence
state. It is a workflow closure rail product milestone candidate, not stable
`0.4.0`.

Old `0.4.0-rc.1` prep commit `5edb535` remains stale historical context and must
not be reused. The fresh RC prep must be based on current HEAD/docs.

Alpha8 packages the code-level convergence after QA no-token convergence PASS.
The first current-tarball implementation-to-finish trial was blocked by remote
SSH/SCP/PowerShell instability, not classified as Persona Harness PASS or FAIL.
The later registry alpha8 implementation-to-finish product usability trial
passed once under closure-state routing.

Channel policy: `@alpha` is the current tester/product smoke channel. `latest`
is now observed at `0.3.9-alpha.8`, but that should not be read as eval proof,
generated-app quality certification, or a general reliability guarantee.
Publish this RC with `next`, not `latest`. Future `latest` moves still need an
explicit release/dist-tag task because default install can imply a stronger
stability or value-proof claim than this evidence supports.

RC soak policy: `0.4.0-rc.1` is published under `next` and should soak there.
The local `@next` implementation-to-finish proxy trial passed, but Windows SSH
remote validation was blocked by SCP/SSH instability before product behavior.
Windows local operator direct PowerShell no-model closure surface validation now
passes for rc1 `@next`, including Korean preservation and strict blocked finish
state. Stable `0.4.0` still requires real external user feedback/soak and any
desired Windows implementation-to-finish/model route; SSH/SCP remote validation
remains unsuitable because of instability/mojibake risk. Proxy feedback from the
existing trial marked the workflow rail helpful, did not request `closure run`,
and left report consistency/noise as a soak watch item.

Post-rc1 current HEAD adds `002359c fix(cli): reject lossy Windows stdin
mojibake`. The rc1 Windows implementation trial showed that PowerShell 5.x
`Get-Content -Raw` can corrupt UTF-8 no-BOM Korean before Persona Harness sees
stdin; once `?` replacement exists, the CLI cannot recover the original text.
Use `Get-Content -LiteralPath <path> -Raw -Encoding UTF8 | npx ph workflow draft --stdin`
or the same form for `workflow capture --stdin`. This guard is not in the
published rc1 registry package unless a future package includes it, and it is a
corruption-prevention fix only, not eval proof or generated app certification.

Current-head `002359c` Windows SSH focused continuation is PARTIAL/BLOCKED, not
an implementation-to-finish PASS. The existing D-drive workspace was reachable
and Korean/stdin was no longer the blocker. After repairing a missing
`junit-platform-launcher` test runtime dependency, bearshell `gradlew.bat test`
and build passed, and source scan did not show fake Gradle shim, Java
`HttpServer`, CommonJS, or Express bypasses. However OpenCode hung during a
build bearshell closure step, reports stayed template, `req-1` stayed pending,
and final `workflow finish implement` exited 1. Stable `0.4.0` remains deferred;
future Windows validation should use a less script-heavy TUI/operator route
because the current automation/PowerShell/SSH path may overfit validation
mechanics.

That less-script-heavy Windows operator route is not validated yet. A fresh
D-drive current-tarball run installed `0.4.0-rc.1` and passed
init/doctor/bootstrap, but blocked before model: Korean preservation failed even
with the guide's `Get-Content ... -Encoding UTF8` pipe, the resulting
requirements `Original idea` became `??? ? ? API ???`, and the guide's
`workflow approve requirements` / `workflow split` / `workflow next` commands
did not match the installed CLI surface in that run. Stable `0.4.0` remains
deferred until the guide/current CLI surface and Windows validation route are
corrected and reverified.

Current HEAD `e688d39 fix(cli): guard lossy Windows stdin and pack stale dist`
addresses the two blockers from that run without changing the release boundary:
`workflow draft/capture --stdin` now rejects unrecoverable question-mark input
such as `??? ? ? API ???` before writing requirements, while normal Korean UTF-8
stdin and the existing `媛...???` mojibake guard remain intact. It also adds
`prepack: npm run build` so local `npm pack` tarballs do not carry stale `dist`,
which can make current guide commands appear missing. This is a current
HEAD/future package fix; published `0.4.0-rc.1 @next` may not include it until a
new release, and it does not repair already corrupted artifacts.

The `e688d39` Windows operator retry then confirmed preflight progress but still
blocked before app output. A fresh current HEAD tarball on Windows D-drive had
the current command surface, rejected lossy `??? ? ? API ???` stdin without
writing requirements, preserved Korean `간단한 할 일 API 만들래` with UTF-8
PowerShell encoding variables, and passed the no-token workflow draft/approve/
split/next/continue/check/closure status/next path. OpenCode started and read
workflow/profile/planner context, but README was absent and a malformed
duplicated `.persona/policies` path hit `external_directory` auto-reject; no
`src` or Gradle files were generated, reports stayed template, ticket stayed
pending, and final `workflow finish implement` exited 1. This is preflight PASS
and implementation-to-finish NOT PASS; stable `0.4.0` remains deferred.

Current HEAD `a307ac0 fix(cli): guide README-absent workflow entry` addresses
the CLI-owned part of that blocker. The duplicated `.persona/policies` absolute
path was not found in CLI/operator prompt output and appears likely
model/operator generated, but README-absent workspaces still needed clearer
rail guidance. `workflow implement`, `workflow continue`, and
`plan --implement` now route agents to repo-relative source-of-truth files:
`.persona/project-profile.jsonc`, `.persona/policies/overlay.jsonc`,
`.persona/workflow/plan.md`, and the current ticket / requirements source.
README-present projects keep README chunk guidance. This reduces entry/context
ambiguity only; it is not model follow-through proof or a closure guarantee.

The `a307ac0` Windows operator retry confirmed that previous input/packaging
and README-absent path blockers improved: fresh tarball preflight had the
current command surface, rejected lossy `???` stdin, preserved Korean, passed
no-token workflow/closure preflight, observed README-absent guidance, and did
not repeat the duplicated `.persona/policies` path. It still did not reach
implementation-to-finish PASS. OpenCode read `.persona/policies/overlay.jsonc`
but generated no app output or `src` / Gradle files; the model filled reports,
ran report-filled, and archived `step-1` anyway. Final
`workflow finish implement` exited 1 on `STACK_MISMATCH` plus pending
`step-2/3/4`. The finish gate correctly blocked, but report-filled/archive
integrity before real implementation/evidence is now the next blocker. Stable
`0.4.0` remains deferred.

Current HEAD `8660ef3 fix(cli): guard ticket archive on closure blockers`
addresses the archive side of that blocker without turning report markers into
quality gates. `plan --report-filled` remains a report marker. `workflow archive
<ticket>` now reads closure state and exits 1 instead of moving work to history
when non-ticket blockers remain, including `verification-unknown`,
`evidence-missing`, `report-coverage-missing`, and stack / verification / report
blockers. Pending-ticket and history-repair blockers are not treated as archive
blockers. Reports marked filled without app/evidence/verification now leave the
backlog/work ticket pending.

- [Release checklist](release-checklist.md)
- [Release notes template](release-notes-template.md)
- [GitHub Actions release automation](github-actions-release-automation.md)
- [v0.3.0-alpha.3 candidate](v0.3.0-alpha.3-candidate.md)
- [v0.3.0-alpha.3 demo packaging decision](v0.3.0-alpha.3-demo-packaging-decision.md)
- [v0.3.0-alpha.3 release notes](v0.3.0-alpha.3-release-notes.md)
- [v0.3.1-alpha.0 release notes](v0.3.1-alpha.0-release-notes.md)
- [v0.3.2-alpha.0 release notes](v0.3.2-alpha.0-release-notes.md)
- [v0.3.2-alpha.1 release notes](v0.3.2-alpha.1-release-notes.md)
- [v0.3.2-alpha.2 release notes](v0.3.2-alpha.2-release-notes.md)
- [v0.3.6-alpha.0 release notes](v0.3.6-alpha.0-release-notes.md)
- [v0.3.6-alpha.1 release notes](v0.3.6-alpha.1-release-notes.md)
- [v0.3.7-alpha.1 release notes](v0.3.7-alpha.1-release-notes.md)
- [v0.3.8-alpha.0 release notes](v0.3.8-alpha.0-release-notes.md)
- [v0.3.8-alpha.1 release notes](v0.3.8-alpha.1-release-notes.md)
- [v0.3.8-alpha.2 release notes](v0.3.8-alpha.2-release-notes.md)
- [v0.3.8-alpha.3 release notes](v0.3.8-alpha.3-release-notes.md)
- [v0.3.8-alpha.4 release notes](v0.3.8-alpha.4-release-notes.md)
- [v0.3.8-alpha.5 release notes](v0.3.8-alpha.5-release-notes.md)
- [v0.3.9-alpha.0 release notes](v0.3.9-alpha.0-release-notes.md)
- [v0.3.9-alpha.1 release notes](v0.3.9-alpha.1-release-notes.md)
- [v0.3.9-alpha.2 release notes](v0.3.9-alpha.2-release-notes.md)
- [v0.3.9-alpha.3 release notes](v0.3.9-alpha.3-release-notes.md)
- [v0.3.9-alpha.4 release notes](v0.3.9-alpha.4-release-notes.md)
- [v0.3.9-alpha.5 release notes](v0.3.9-alpha.5-release-notes.md)
- [v0.3.9-alpha.6 release notes](v0.3.9-alpha.6-release-notes.md)
- [v0.3.9-alpha.7 release notes](v0.3.9-alpha.7-release-notes.md)
- [v0.3.9-alpha.8 release notes](v0.3.9-alpha.8-release-notes.md)
- [v0.4.0-rc.1 release notes](v0.4.0-rc.1-release-notes.md)
- [v0.3.6 workflow ticket backlog](../v0.3.6-workflow-ticket-backlog.md)
- [v0.3.6 requirements draft workflow](../v0.3.6-requirements-draft-workflow.md)

Release automation lives in `.github/workflows/release.yml`.

- Push `vX.Y.Z-alpha.N` to publish with npm dist-tag `alpha`, then synchronize `latest` to the same version during the alpha pilot.
- Push `vX.Y.Z-beta.N` to publish with npm dist-tag `beta`, then synchronize `latest` to the same version during the beta pilot.
- Push `vX.Y.Z` to publish with npm dist-tag `latest`.
- The workflow verifies test/typecheck/build/rule diagnostics/scope/injection-value before publishing.
- The workflow checks that the pushed tag matches `package.json` version.
- The workflow runs `npm publish --dry-run` before real publish.
- GitHub release notes are generated automatically for tag releases.
