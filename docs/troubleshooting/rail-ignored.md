# Agent ignores the rail / skips `ph bearshell`

**Symptom:** the agent uses its own Read/Grep/Glob and finishes without the rail.
The model may even say *"there is no enforced persona-harness rule in this
session."* That is literally true.

## Why

`enforce.systemConstitution` is `false` by default, so the "use the rail before
implementing / run finish before claiming done" guidance is never injected into
the model's system prompt each turn. `AGENTS.md` alone is passive and not
reinforced, so the agent has no standing reason to route verification through
`ph bearshell` or to follow the workflow.

## Fix

Turn the driver on **for this project** in `.persona/harness.jsonc`:

```jsonc
{
  "enforce": {
    "systemConstitution": true
  }
}
```

This re-injects the rail guard every relevant turn. It is a single system-prompt
transform, **not** the heavy per-file `runtimeInjection` (which was measured
net-negative and stays off). Leave `runtimeInjection` off.

If you also want the gate enforced (not just guidance), see
[enforce-the-gate.md](enforce-the-gate.md).
