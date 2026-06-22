# Release Docs

Use this package for repeatable release operations and release note drafting.

- [Release checklist](release-checklist.md)
- [Release notes template](release-notes-template.md)
- [GitHub Actions release automation](github-actions-release-automation.md)
- [v0.3.0-alpha.3 candidate](v0.3.0-alpha.3-candidate.md)
- [v0.3.0-alpha.3 demo packaging decision](v0.3.0-alpha.3-demo-packaging-decision.md)

Release automation lives in `.github/workflows/release.yml`.

- Push `vX.Y.Z-alpha.N` to publish with npm dist-tag `alpha`, then synchronize `latest` to the same version during the alpha pilot.
- Push `vX.Y.Z-beta.N` to publish with npm dist-tag `beta`, then synchronize `latest` to the same version during the beta pilot.
- Push `vX.Y.Z` to publish with npm dist-tag `latest`.
- The workflow verifies test/typecheck/build/rule diagnostics/scope/injection-value before publishing.
- The workflow checks that the pushed tag matches `package.json` version.
- The workflow runs `npm publish --dry-run` before real publish.
- GitHub release notes are generated automatically for tag releases.
