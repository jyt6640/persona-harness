---
name: superpowers-driver
description: "Repository-only advanced driver for a compatible coding agent that manually follows the Persona Harness public implementation entry and closure gates."
---

# Superpowers Driver

This is a source-only, manually selected driver. It steers a compatible coding
agent; it is not a Persona Harness authority surface, runtime hook, or default.

## Entry

Use this only for one concrete implementation goal in a prepared Persona
Harness project. Do not auto-bootstrap an unprepared project. Let `ph go`
report its own prerequisite failure instead of creating `.persona`, hook
configuration, or a plan on the user's behalf.

For a prepared project, enter through the public command:

```sh
npx ph go "<concrete implementation goal>"
```

Follow the emitted implementation rail and work only on its current ticket.
Do not replace that rail with a private task protocol or an automatic loop.

## Closure

The authority gate is the existing plaintext command:

```sh
npx ph workflow finish implement
```

If it blocks, address the truthful `Next action` in its human output. Use the
following command only when structured current closure guidance is needed:

```sh
npx ph workflow closure next --json
```

`workflow closure next --json` is diagnostic guidance, not a `finish --json`
result. There is no `workflow finish --json` contract.

## Authority Boundary

This driver cannot:

- mark implementation or review reports verified;
- weaken or bypass PH closure, check, or finish gates;
- auto-finish a ticket or claim completion;
- certify generated applications, app quality, efficacy, or reliability;
- enable runtime injection, host hooks, auto-spawn, defaults, schemas, or
  host-specific enforcement.

PH CLI exit codes and the existing closure/check/finish surfaces remain the
authority.
