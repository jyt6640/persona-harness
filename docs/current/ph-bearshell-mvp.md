# ph Bearshell MVP

## Goal

Bring the useful OMO `sparkshell` pattern into Persona Harness as `ph bearshell`.

This is a Persona Harness CLI runtime helper. It is not Java/Spring rule injection, not an observer, and not a product-quality gate.

## OMO Reference

OMO separates the pattern into two surfaces:

- runtime command: `omo sparkshell`
- awareness injection: rules tell the agent to prefer `omo sparkshell` for repo inspection, CLI smoke tests, git/history checks, and large output handling

Observed OMO behavior:

- `omo sparkshell <command> [args...]`
- `omo sparkshell --shell '<command>'`
- output condensation for large command output
- optional JSON mode
- environment toggles
- later/runtime-specific surfaces such as native sidecar, app-server socket, tmux pane, session context, and spark-model summarization

## Persona Harness MVP

Persona Harness now exposes:

```bash
ph bearshell <command> [args...]
persona-harness bearshell <command> [args...]
ph bearshell --shell '<command>'
ph bearshell --json <command> [args...]
ph bearshell --budget 1200 <command> [args...]
```

The `ph` and `persona-harness` bins share the same CLI entry.

## Included

- direct command execution without shell interpretation by default
- explicit `--shell` opt-in for shell metacharacters
- deterministic head/tail condensation for oversized stdout/stderr
- `--budget <chars>`
- `--json`
- `PH_BEARSHELL_CONDENSE=0`
- `PH_BEARSHELL_CONDENSE_BUDGET`
- command launch failure message for missing commands
- agent awareness injection that tells the model to prefer `ph bearshell` for repo inspection, CLI smoke tests, and large output checks

## Not Included Yet

- native sidecar
- Codex app-server socket control
- tmux pane inspection
- session-context ranking
- spark-model summarization

## Why This Shape

This keeps the first `ph bearshell` loop small enough to verify through the packaged CLI surface while preserving the OMO shape:

- helper command first
- minimal awareness/rule injection after the helper command is verified
- native/runtime sidecar later

The MVP is useful now for local and tarball verification without claiming full OMO parity.

## Verification

Required checks:

```bash
npm test
npm run typecheck
npm run build
npm pack --dry-run
node dist/cli/index.js bearshell --help
node dist/cli/index.js bearshell node -e "console.log('ph-ok')"
node dist/cli/index.js bearshell --shell "printf ph-shell"
npx vitest run tests/phase0-hooks.test.ts
```

Packaged install check:

```bash
npm pack
npm init -y
npm install -D /absolute/path/to/persona-harness-0.2.0.tgz
npx ph bearshell node -e "console.log('ph-ok')"
npx persona-harness bearshell --shell "printf persona-ok"
```

## Next Loop

Decide whether `ph bearshell` needs native sidecar, tmux pane inspection, or session-context-aware condensation.
