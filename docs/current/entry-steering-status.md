# Entry Steering Status

## Decision

`features.entrySteering` is a default-off OpenCode adapter opt-in. It evaluates
only the first user message observed for a session and may prepend one advisory:

> Implementation intent detected - enter the rail with `npx ph go "<goal>"`.

It does not execute `go`, force a workflow transition, auto-finish, or change
closure authority. It is separate from `features.runtimeInjection`,
`enforce.systemConstitution`, `enforce.idleContinuation`, and
`enforce.ralphLoop`; enabling one does not enable another.

## Detector And Corpus

The deterministic detector uses Korean/English implementation imperatives plus
code nouns. The attached-project-only phrases `그냥 해줘` and `just do it` are
the sole implicit-target exceptions. Explanation, review, summary, questions,
and non-code imperatives remain negative.

Source-only corpus:

- `experiments/entry-intent-corpus/corpus.json`
- 16 positive and 16 negative records split across Korean and English
- real-use positive #1 equivalent: `그냥 해줘`
- excluded from the npm package together with its measurement script

Preregistered thresholds:

| Metric | Boundary |
| --- | ---: |
| precision | >= 0.90 |
| recall | >= 0.85 |
| false-negative cost | 2 |
| false-positive cost | 1 |
| weighted error rate | <= 0.20 |

Local-current corpus result:

| TP | TN | FP | FN | precision | recall | weighted error rate | decision |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 16 | 16 | 0 | 0 | 1.00 | 1.00 | 0.00 | pass |

Run with `npm run measure:entry-steering`. This is a bounded corpus measurement,
not product efficacy, broad reliability, app quality, or a default-on decision.

## Session Status

When the opt-in is on, one PH-owned JSON decision is written under
`.persona/evidence/entry-steering/` per session. The filename and `sessionKey`
use a truncated SHA-256 digest. The record contains only fired/not-fired,
decision, and bounded rationale categories; it does not persist prompt text,
raw session IDs, stdout/stderr, environment values, or user secrets.

`ph doctor` reads these records without modifying them and reports enabled
state, valid decision count, fired count, and invalid/corrupt record count.

## Boundaries

- default remains `false` in parser, shipped template, bootstrap, and attach
- OpenCode `experimental.chat.messages.transform` is the only host surface
- one evaluation and at most one advisory per session
- no LLM classifier, additional hook point, schema/version/release movement,
  enforcement claim, token-saving claim, or generated-app certification
