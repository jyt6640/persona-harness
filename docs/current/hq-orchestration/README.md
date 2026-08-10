# HQ Orchestration

This directory defines the operating contract for Delivery Control and its
bounded lanes. It does not create a gate, a thread, a retry, or a package
evidence claim by itself.

## Current Source Of Truth

- [control-contract.json](control-contract.json) is the machine-readable
  `persona.hq-control.1` policy: Owner-default closure, conditional gates, the
  ledger, result fields, packet/pin limits, automation limits, and pilot
  measurements.
- [protocol.md](protocol.md) explains how Control applies that contract.
- [templates/result-report-format.md](templates/result-report-format.md)
  defines the compact `[HQ_RESULT]` wire format.
- [thread-index.md](thread-index.md) is a routing directory, not a pin set or
  automatic progression graph.
- `externalOpenCodeModel` inside the control contract applies only to external
  OpenCode tests, demos, or fixtures that actually invoke a model. It pins the
  configured OpenCode model to `openai/gpt-5.3-codex-spark`; unavailable is
  `BLOCKED` before model or product action.

## Operating Rule

The Owner closes the deterministic boundary by default. Source, Package, and
Hosted work begin only when their named predicate is recorded in the one-line
Control ledger. A missing predicate is `BLOCKED`; it does not authorize a
substitute gate or a new diagnostic rail.

## Supporting Templates

- [common-dispatch-header.md](templates/common-dispatch-header.md) supplies the
  shared bounded dispatch rule.
- The `dispatch-*.md` files supply scope-specific prompts only after Control
  records a named owner or gate predicate.

Historical lane IDs remain discoverable in the thread index, but routine work
reuses the existing owner lane and does not create a task for every symptom.
