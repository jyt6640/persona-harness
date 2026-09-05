# Common Dispatch Header

Apply this header only after Delivery Control records a named owner or gate
predicate. Reuse the existing role workspace; do not create a task, a gate, or
a successor because a diagnostic code appeared.

- Stay inside the dispatched scope and preserve unrelated dirty files.
- The Owner owns deterministic closure. A support or acceptance lane supplies
  only its bounded decision; it does not debug, retry, or replace the candidate.
- Do not start a Source, Package, or Hosted action without its named predicate.
- Use focused checks while working. Do not repeat unchanged heavyweight checks.
- Do not poll, retry a failed observation, create a diagnostic-wrapper chain,
  or automatically progress a workflow.
- For an external OpenCode action that invokes a model, apply
  `externalOpenCodeModel`: record `configuredOpenCodeModel`, use only
  `openai/gpt-6-astra`, and stop `BLOCKED` before model or product
  action if it is unavailable. Do not substitute a model, provider, alias, or
  local simulation.
- Keep complete packets for candidate freeze, independent acceptance, or final
  hosted evidence. Use a compact result for every other handoff.
- Do not push, publish, tag, stage, create a fixture, or mutate issue state
  without explicit authorization.
- Send the terminal result directly to Delivery Control with this exact shape:

```text
[HQ_RESULT]
role=<role>
state=PASS|FAIL|BLOCKED|FROZEN
delta=<changed or discovered boundary>
evidence=<decisive observed evidence; separate inference>
decision=<one lawful conclusion>
next=<one role/action or an explicit user decision>
risk=<remaining uncertainty or hosted residual>
```
