# Release Checklist

Use this checklist before every npm release.

## 1. Scope

- Confirm the release version and dist-tag.
- Confirm whether the release is `alpha`, `beta`, or `latest`.
- Confirm the supported product surface.
- Confirm unsupported surfaces are still documented.
- Confirm no generated evidence, experiments, or local fixtures are included in package contents.

## 2. Metadata

- `package.json` version is correct.
- `package-lock.json` root package version is aligned.
- `package.json` license is correct.
- Root `LICENSE` file exists.
- `README.md` describes the install flow for the target dist-tag.
- Language README links work.
- `CHANGELOG.md` has an entry for the release.
- Release notes are drafted from `docs/current/release/release-notes-template.md`.

## 3. Package Contents

Run:

```bash
npm pack --dry-run --json
```

Check:

- `dist` is included.
- `README.md` and language README files are included.
- `LICENSE` is included.
- `.persona/harness.jsonc` is included.
- `.persona/rules` is included.
- Java MVP shared-skill reference subset is included.
- inactive shared-skills are excluded.
- Java no-excuse fixtures are excluded.
- `experiments/`, `.persona/evidence/`, `.persona-test-fixtures/`, and `.omo/` are excluded.

## 4. Verification

Run:

```bash
npm test
npm run typecheck
npm run build
npm run report:rules
npm run check:scope:strict
npm run check:injection-value
npm publish --dry-run --tag <dist-tag>
```

Expected:

- Tests pass.
- Typecheck passes.
- Build passes.
- Rule diagnostics are `PASS`.
- Scope diagnostics are `PASS`.
- Injection value state is acceptable for the release.
- Publish dry-run reports the expected package version, files, and dist-tag.

## 5. Install Smoke

Use a temporary project outside the repository:

```bash
tmp_project=$(mktemp -d)
cd "$tmp_project"
npm init -y
npm install -D persona-harness@<dist-tag>
npx ph --help
npx ph init
```

Check:

- `.opencode/opencode.json` exists.
- `.persona/harness.jsonc` exists.
- `.persona/rules` exists.
- `npx ph --help` shows the CLI commands.

For a local pre-publish smoke, install the generated tarball instead of the registry package.

## 6. Publish

Only run real publish after explicit approval.

```bash
npm publish --tag <dist-tag>
```

For the current alpha line:

```bash
npm publish --tag alpha
```

Do not publish under `latest` until the stable support contract is ready.

## 7. Post-publish

- Run `npm view persona-harness dist-tags --json`.
- Run `npm view persona-harness@<version> version`.
- Install in a fresh temporary project using the public dist-tag.
- Confirm `npx ph init` works from the published package.
- Update `CHANGELOG.md` date if it was left as `Unreleased`.
- Create GitHub release notes from the release notes template if this release gets a GitHub release.
