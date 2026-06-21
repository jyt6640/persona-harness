# Release Docs

Use this package for repeatable release operations and release note drafting.

- [Release checklist](release-checklist.md)
- [Release notes template](release-notes-template.md)

Release automation lives in `.github/workflows/release.yml`.

- Push `vX.Y.Z-alpha.N` to publish with npm dist-tag `alpha`.
- Push `vX.Y.Z-beta.N` to publish with npm dist-tag `beta`.
- Push `vX.Y.Z` to publish with npm dist-tag `latest`.
- The workflow verifies test/typecheck/build/rule diagnostics/scope/injection-value before publishing.
- GitHub release notes are generated automatically for tag releases.
