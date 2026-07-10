# CI Finish Gate And Closure JSON Contract

This is the current CI contract for Persona Harness `0.6.0` on exact main
`d1b153cbb41cbbb0364df1ce4dc64ccab85f6d4f`. It documents existing CLI
behavior only. CI drives the commands; the PH CLI exit code is the authority.

## Exact Commands

The finish gate accepts this exact command:

```sh
ph workflow finish implement
```

`workflow finish` has no `--json` option in this contract. Both
`ph workflow finish implement --json` and
`ph workflow finish --json implement` are invalid commands: each exits `1`,
writes no stdout, and writes the command error and usage text to stderr.
There is therefore no `finish --json` schema or version to retain.

The supported structured companion is:

```sh
ph workflow closure next --json
```

It exits `0`, writes JSON to stdout, and writes nothing to stderr for the
observed initialized blocked fixture. The JSON is unversioned: it has no
`schema` or `version` field. Its top-level keys are `action`, `nextStep`,
`state`, and `steps`; `state.finish` is the current `passed` or `blocked`
closure state. Treat that artifact as diagnostic closure state, not as the
finish gate result.

## Finish Exit And Stream Contract

For an initialized, finish-ready project, `ph workflow finish implement` exits
`0`, writes the human-readable `Finish status: PASS` result to stdout, and
writes nothing to stderr.

For an initialized project with finish blockers, it exits `1`, writes no
stdout, and writes `Workflow finish failed: implement`, required fixes, and
the workflow-rail boundary to stderr. Do not add `|| true`,
`continue-on-error`, or an equivalent failure mask around this command.

Without a `.persona/` directory, the command exits `0` with an advisory
uninitialized-harness message. A CI job intended to exercise this gate must
therefore run in a prepared PH project with `.persona/` workflow state, an
accepted plan, the required reports and evidence, and no remaining finish
blockers.

## GitHub Actions Recipe

This source-checkout recipe builds the checked-out CLI, writes the supported
closure JSON artifact before the gate, and keeps that artifact even when the
finish command exits nonzero:

```yaml
name: persona-harness-finish

on:
  workflow_dispatch:

jobs:
  finish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: Record closure state and run finish gate
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p .persona-artifacts
          node dist/cli/index.js workflow closure next --json > .persona-artifacts/workflow-closure-next.json
          node dist/cli/index.js workflow finish implement
      - name: Retain closure state
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: persona-harness-closure-next
          path: .persona-artifacts/workflow-closure-next.json
          if-no-files-found: error
```

For the published stable package rather than a source checkout, replace the
two `node dist/cli/index.js` invocations with the exact package selector:

```sh
npm exec --yes --package=persona-harness@0.6.0 -- ph workflow closure next --json > .persona-artifacts/workflow-closure-next.json
npm exec --yes --package=persona-harness@0.6.0 -- ph workflow finish implement
```

## Boundary And Follow-Up

This contract does not make the agent-authored evidence ledger independently
trusted CI proof. A direct verification rerun is separate item 19 design work;
this recipe records the existing state and executes the existing finish gate
without claiming to solve that exposure.

It does not certify a generated app, save tokens, prove efficacy or app
quality, establish broad reliability, or add enforcement beyond the documented
finish exit and closure JSON behavior. It does not move runtime injection,
defaults, schemas, versions, publishing, tags, `latest`, or `next`.
