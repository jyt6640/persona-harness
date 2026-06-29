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

## Post-Alpha7 Version-Line Readiness

`0.3.9-alpha.7` shipped the read-only workflow closure planner and produced one
Windows SSH registry implementation-to-finish product usability PASS. That is a
workflow rail product signal, not eval proof, PH superiority proof, generated
app quality certification, or a general reliability guarantee.

Recommended next line: `0.4.0-rc.1`, if HQ/user wants a user-facing workflow
rail milestone candidate while keeping prerelease boundaries. Do not cut
`0.4.0` stable until release messaging, `latest` strategy, and additional user
or smoke confidence support a stable default-install claim. Use
`0.3.9-alpha.8` only if another narrow alpha fix is needed before the milestone
candidate.

Current `0.4.0-rc.1` prep commit `5edb535` is parked and not publish-ready
pending CLI wiring review for closure planner integration into `workflow
continue`, `plan-next`, finish guidance, and post-build closure guidance.

That prep is now stale because `a8eb03d fix(cli): wire closure planner into
workflow continue` landed after it. The release lane must wait for QA
verification and a closure trial rerun before choosing between refreshed
`0.4.0-rc.1` prep and a narrow `0.3.9-alpha.8`.

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
