# Java Backend MVP Packaging Readiness

## Goal

Make the Java/Spring backend Clean Code MVP installable, runnable, and verifiable through a packaged plugin surface.

## Readiness Command

```bash
npm run demo:java-mvp
```

The command builds the package, creates an `npm pack` tarball, installs that tarball into a temporary demo project, imports the installed `dist/index.js` OpenCode plugin module, and drives the Phase 0 hooks against a Java Controller target.

The release-facing install path is documented in [java-backend-mvp-install-guide.md](java-backend-mvp-install-guide.md).

Use `-- --keep` to keep the temporary demo project for manual inspection:

```bash
npm run demo:java-mvp -- --keep
```

## Verified Surface

- The packed package includes `dist/index.js`.
- The packed package includes `.persona/harness.jsonc` and `.persona/rules`.
- The installed OpenCode plugin exposes `tool.execute.after`.
- The installed OpenCode plugin exposes `experimental.chat.messages.transform`.
- A Java Controller target receives a Persona Harness injection block.
- The injection includes the Java common and Spring Controller rules.
- The model-input transform receives the same pending injection.
- Phase 0 evidence JSON is written under the temporary project's ignored `.persona/evidence/phase0` directory.

## What This Proves

This proves the MVP can be packed, installed into another project, loaded as an OpenCode plugin module, and exercised through the same hook surface the plugin relies on at runtime.

## Non-Goals

- Not a generated Java/Spring application quality certification.
- Not a test sufficiency judgment.
- Not a rule compliance enforcement gate.
- Not Guard/AST/linter validation.
- Not frontend, infra, or multi-domain productization.

## Current Decision

Java backend MVP packaging/demo readiness has a single local command that verifies the install/run/check path, plus a release-facing install guide. The active MVP remains Java/Spring backend Clean Code injection.

## Next Candidate

The next productization loop should decide whether to prepare a minimal OpenCode fixture demo or a desktop app track breakdown.
