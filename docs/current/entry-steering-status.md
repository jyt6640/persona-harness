# Entry Steering Status

## Decision

`features.entrySteering` is a default-off OpenCode adapter opt-in. The host
transform selects the latest user-message session in its output, then evaluates
only that selected session's first user message and may prepend one advisory:

> Implementation intent detected - enter the rail with `npx ph go "<goal>"`.

It does not execute `go`, force a workflow transition, auto-finish, or change
closure authority. It is separate from `features.runtimeInjection`,
`enforce.systemConstitution`, `enforce.idleContinuation`, and
`enforce.ralphLoop`; enabling one does not enable another.

If the host output has no user-message session identity, this surface returns
without an advisory or status record. It does not evaluate or annotate another
session's messages in an interleaved history. This is a bounded host-output
selection rule, not a broad session-identity guarantee.

This surface adds the `features.entrySteering` opt-in configuration field and
source-only corpus/measurement formats for its bounded detector. It does not
migrate any existing evidence schema.

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
- one evaluation and at most one advisory per selected session
- no LLM classifier, additional hook point, package-version or release-state
  movement, migration of existing evidence schemas, enforcement claim,
  token-saving claim, or generated-app certification

## Source Snapshot

- Default and parser: `src/config/harness-config.ts:26-29,94-102,190-198`
- Selected-session first-message tracker and bounded status records:
  `src/runtime/entry-steering-status.ts:12-20,29-38,41-73,83-111,114-144`
- Existing OpenCode hook selection and integration:
  `src/runtime/hooks.ts:357-371`
- Doctor status summary:
  `src/cli/doctor.ts:180-225,273-294`

All snapshots above are at
`e3009b8c9183e1123c6a18efc8e7dfb9702f8b36`.
