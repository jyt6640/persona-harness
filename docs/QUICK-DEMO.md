# Quick Demo

This is a three-beat walkthrough of the public, gate-first path:
prepare a backend workspace, observe a truthful blocked finish, then enter one
concrete implementation goal. Use a throwaway directory, not this repository.

## 1. Install and prepare

Node.js 20+ and npm are required.

```bash
mkdir -p /tmp/persona-harness-quick-demo
cd /tmp/persona-harness-quick-demo
npm init -y
npm install -D persona-harness
npx ph init
npx ph bootstrap backend
```

`init` is the human front door. `bootstrap backend` adds the backend profile,
accepted plan, and workflow report templates that `ph go` requires. Default
setup keeps `runtimeInjection` off; this demo does not need a host hook.

This clean-project walkthrough does not use `attach`. For an existing
Java/Spring/Gradle project, first inspect the inferred draft with `npx ph
attach`, then run `npx ph attach --yes` to accept it. Use `npx ph attach
--repair --yes` only for a recognized weak Persona Harness installation;
ready attachments are not repair targets, and unrecognized or corrupt files
are refused rather than overwritten.

## 2. Observe a legitimate block

Run the existing plaintext finish gate before implementing anything:

```bash
npx ph workflow finish implement
```

It exits `1` in this prepared project and prints exactly one prioritized
`Next action` plus, when applicable, one phased `Next command`. For example,
the initial blocker asks for real test/build/runtime verification first, then
names `npx ph workflow check` as the command to run after that work is
recorded. Do not treat the command as a shortcut around the action.

Do not use an uninitialized directory for this beat: there, Finish exits
nonzero with the bounded `workflow-state-uninitialized` blocker. Run the
public bootstrap command first; an authority-backed Finish never treats absent
workflow state as a successful no-op.

## 3. Enter a real goal and follow the rail

```bash
npx ph go "Add a task creation endpoint."
```

`ph go` captures the concrete goal, selects the current ticket, and prints the
implementation rail. Follow that rail in your actual project. Its final gate
remains the same plaintext command:

```bash
npx ph workflow finish implement
```

When a script needs the current structured closure state, use the companion
command:

```bash
npx ph workflow closure next --json
```

`workflow closure next --json` is diagnostic state, not a `finish --json`
result. `workflow finish` has no `--json` option.

## Full Cooperative Verification Demo

Repository maintainers and reviewers can exercise the longer exact-package
contract from a Persona Harness checkout:

```bash
npm ci
node scripts/verify-cooperative-finish-demo.mjs
```

It requires Node 20.19+, JDK 21, and Gradle 9.4.0. The required repository
verification job runs this exact command. It creates a disposable Java/Spring
Gradle fixture, packs and installs the current package tarball, demonstrates
the initial `workflow-state-uninitialized` block, then records real
Gradle/JUnit evidence and reaches `Finish status: PASS` with
`--assurance cooperative`.

This is a maintainer/reviewer test contract, not an end-user startup command.
It keeps runtime injection default-off, does not call an external authority,
and does not grant trusted external authority. Add `-- --keep` only when the
temporary fixture needs manual inspection.

## Boundaries

This walkthrough demonstrates only the observed setup, blocked-finish, and
goal-entry surfaces. It does not promise automatic implementation or
completion, generated-app certification, app quality, efficacy, or broad
reliability. See [MEASURED-CLAIMS](MEASURED-CLAIMS.md) for measured-claim
boundaries.
