# Context External Validation Protocol

Status: current Context-specific preregistration and result-status contract.

Machine-readable current state:
[`context-external-validation-status.json`](context-external-validation-status.json).
It records no protocol, no observations, and an `INCONCLUSIVE` product verdict.
That is an absence of external evidence, not a negative result and not an
invitation to simulate participants.

## Purpose And Separation

This protocol belongs to Context Personalization M9 and is tracked by
[#429](https://github.com/jyt6640/persona-harness/issues/429). It records what
must be fixed before a future independent observation can be interpreted.

It does not replace either of these separate boundaries:

- `context-comparison-manifest.json` is deterministic local fixture evidence
  for OFF, legacy-broad, and targeted layered Context composition.
- The independent Spring maintainer procedure is a Workflow Integrity
  experiment and is not Context product-value evidence.

No command, runtime hook, network call, GitHub authority action, workflow
state, or participant action is implemented by this protocol. The evaluator is
pure TypeScript and only validates supplied JSON-shaped values. It is available
from the installed package as `persona-harness/context-external-validation`;
that subpath is a parser and evaluator, not an observation runner.

## Schemas

The protocol uses `persona-context-external-validation-protocol.1`. Before any
observation begins it requires exactly:

- a 40-character candidate commit, package version, and SHA-256 tar digest;
- one SHA-256 task digest, rather than task text, prompts, source, paths, or
  participant contact information;
- a three-to-five member pseudonymous cohort (`P-01` through `P-99`) with a
  finite relationship category;
- a finite per-start time limit, one declared intervention policy, and the
  fixed `same-task-context-off` token reference.

The result record uses `persona-context-external-validation-status.1` with
four states:

| State | Required meaning | Allowed product verdict |
| --- | --- | --- |
| `not-started` | No protocol and no observations have been recorded. | `INCONCLUSIVE` |
| `preregistered` | An exact protocol exists, but no observation has started. | `INCONCLUSIVE` |
| `observing` | A strict subset of the cohort has terminal records. | `INCONCLUSIVE` |
| `completed` | Every cohort member has exactly one terminal record. | Calculated `PRODUCT_GO` or `PRODUCT_NO_GO` |

Unknown fields, unbounded text, raw participant data, URLs, paths, credential
shapes, unsupported relationship or intervention values, candidate mismatches,
and malformed metrics are rejected. A missing protocol after `not-started`, a
partial completed denominator, or a mismatched claimed verdict is also
rejected.

## Denominator And Verdict

Each `completed` record must contain exactly one entry for every preregistered
cohort pseudonym. An `accepted-start` carries bounded outcome metrics; a
declined or pre-start withdrawal carries only fixed `not-observed` null
metrics. This keeps every accepted start in the denominator and prevents a
selective completed result.

`PRODUCT_GO` is calculated only when all of the following are true:

1. At least three recorded starts are independent.
2. At least two starts reduce corrections or preserve the declared policy.
3. Every started record completed the task, resolved its conflict accurately,
   had no task regression, contradiction increase, or overreach increase, and
   stayed inside the preregistered time budget.
4. Every started record has token overhead at or below `1300` permille (1.3x)
   and no maintainer intervention.

`tokenOverheadPermille` is a normalized comparison value against the fixed
`same-task-context-off` reference: `1000` means the reference amount. The
status file retains neither raw token counts nor prompts; it only accepts the
bounded normalized metric.

A valid completed cohort that misses any criterion is `PRODUCT_NO_GO`. Before
completion, or with no external evidence, the only possible verdict is
`INCONCLUSIVE`. The record never stores raw prompts, source, paths,
credentials, participant names, or free-form feedback.

## What This Does Not Claim

The initial status does not show that an external host received Context, that a
model followed it, that users benefited, or that token use improved. It only
makes the future evidence bar reproducible and fail-closed.
