# HQ Delivery Control Protocol

## Source Of Truth

[`control-contract.json`](control-contract.json) is the strict
`persona.hq-control.1` policy. This document explains it; the result template
and thread index are supporting operational inputs. No absent legacy document
or historical packet supplies a gate rule.

## Owner-Default Closure

One Owner owns an issue through diagnosis, implementation, deterministic proof,
and an exact candidate freeze. The Owner expands the same candidate when a
deterministic link fails; a bounded code or one green symptom never authorizes
a separate diagnostic candidate, independent gate, or hosted retry.

## Conditional Gate Starts

Control records a named predicate before starting any gate:

| Gate | Starts only when | Does not start for |
| --- | --- | --- |
| Source | The frozen boundary changes security, authority, workflow identity, release, or a fail-closed control that needs independent judgment. | An ordinary source change with a complete Owner closure. |
| Package | The consumer package/tar, registry, release, or named external consumer boundary changes. | A package-excluded test or docs correction with unchanged behavioral package inputs. |
| Hosted | A named hosted-only residual remains after Owner closure and every required conditional gate passes. | Local diagnosis, a substitute check, or a failed observation. |

A missing predicate is `BLOCKED`. Acceptance roles decide one exact frozen head;
they do not debug it, manufacture a replacement candidate, or open a hosted
action. A failed gate returns to the same Owner for one complete correction.

## Control Ledger

Control keeps one compact row per active issue:

```text
goal | owner | current candidate | required gate | next predicate | blocker
```

The row replaces repeated narrative handoffs. It names only the active
candidate and current blocker; historical packets and hashes stay in their
existing evidence records unless decisive to the next decision.

## Result Delivery

Every terminal lane result uses the seven fields in
[`result-report-format.md`](templates/result-report-format.md) and is sent
directly to Delivery Control when thread tools are available. A failed direct
delivery is reported in the final result; it does not authorize another lane.

## Evidence, Pins, And Automation

- A complete packet is allowed only for candidate freeze, independent
  acceptance, or final hosted evidence. Routine deltas use the compact result.
- Pin only Delivery Control, the active Owner, and one currently active external
  gate. The lane directory is not a pin list or a serial workflow.
- Automation may wait once for a named event or deliver a result. It must not
  poll, retry a failed gate, create a diagnostic-wrapper chain, or automatically
  create a successor.
- A public fixture, package observation, or final hosted action is evidence
  only and runs once after its named prerequisites. It is never a debugger.

## OpenCode Model Actions

`externalOpenCodeModel` applies only when an external OpenCode test, demo, or
fixture actually invokes a model. It requires the configured OpenCode model
`openai/gpt-6-astra`, records that configured model in bounded evidence,
and returns `BLOCKED` before model or product action when unavailable. It never
silently substitutes a model, provider, alias, or local simulation.

This is the current Astra migration target. Historical Spark measurements and
the versioned `opencode-advisory-observation.1` contract retain their recorded
model; they cannot be relabeled or reused as Astra observations. A new live
model comparison needs its own current, model-bound observation contract.

GitHub Actions CI/release/publish, ordinary npm or package checks, non-OpenCode
fixture steps, and historical evidence are outside this rule.

## Pilot Measurement

Apply the policy to a three-to-five issue pilot beginning with #257; #256 stays
a separate release-blocker. For each pilot issue, record rail starts,
heavy-check repetition, repeated evidence prose, retries, and blocked-time
cause. The measurements evaluate the operating policy, not product quality.

## Stop Rules

Control uses authorization already recorded for the same scope. It asks for an
explicit decision when destructive work, publish/tag/push, or a material product
choice falls outside that authorization. Conflicting owner results and missing
external prerequisites require attribution before dependent action. Read-only
diagnosis and authorized deterministic correction continue without another
approval. No alternate executor, model, transport, or gate is inferred from a
blocked predicate, and one-shot external observations are never retried as a
debugger.
