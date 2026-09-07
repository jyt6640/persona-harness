# Context Value Window

Status: retained offline reference. The user stopped live token experiments on
2026-09-07. This document does not authorize a new run; its numeric criteria are
not current release acceptance requirements.

`context-value-window.mjs` is a source-only, offline arithmetic helper for the
previously proposed equal-value experiment. It does not run a model, spend a budget, write
host configuration, verify provenance, or change a release gate. It is not a
published PH command or a replacement for the historical three-arm comparison.

## Before Any Run

Freeze the two artifact digests, three task scenarios, starting repositories,
requirements, active philosophy and decisions, quality rubric, guidance and
interview behavior, actual host versions, user-selected model/provider/settings,
cache conditions, and approved cost/time/token ceilings in one preregistration.
Record its SHA-256 as `registrationDigest`. A digest supplied to this helper is
only a binding identifier; an owner must inspect the actual preregistration and
confirm that it predates the observations.

Use the same active features and required meaning in A and B. Historical OFF,
skills-only, or artificially repeated broad injection is not an admissible A.
A matching `valueContractDigest` does not itself establish equal functionality:
inspect both frozen artifacts and the code/test/decision rubric first. No fair
baseline or approved ceilings means the live window must not start.

Run three scenarios twice per host, six pairs for Codex and six for Claude.
Use AB for one repetition and BA for the other within each scenario. A scenario
should cover a clear small change, another a material implementation decision,
and another multi-file work with resume/compaction. Freeze exact task content
before running; these category names are not a completed preregistration.

## Input Contract

Pass a parsed JSON object to `evaluateContextValueWindow` with protocol
`context-value-window.1`, `registrationDigest`, host `codex` or `claude`, three
distinct `scenarios`, and exactly six `pairs`. Every pair contains its scenario,
repetition (1 or 2), order (AB or BA), and runs `a` and `b`.

Each run supplies:

- `artifactDigest`, `valueContractDigest`, `startRepositoryDigest`,
  `requirementsDigest`, `profileDigest`, `decisionsDigest`, `settingsDigest`:
  lowercase SHA-256 bindings to inspected artifacts, not raw private content.
- `hostVersion` and `cacheCondition` (`cold`, `warm`, or `disabled`). Cache
  condition must be observed or controlled; an unknown condition is inconclusive.
- `outcome`: only `completed` can enter the numeric decision. Keep failed,
  cancelled, blocked, and missing attempts in the report; do not replace or drop
  them to manufacture six successful pairs.
- `profileActive`, `contextActive`, `requiredMeaningPreserved`,
  `majorQualityRegression`: source-backed observations reviewed against the
  frozen rubric, not assertions inferred from an empty payload or passing scorer.
- `accountingComplete`: all interview, guide, tool, retry, recovery, validation,
  and authorized delegated work is included. This task authorizes no subagents.
- `usageBasis: provider-task-total` and `taskTokens`: a nonnegative safe integer
  total normalized from provider observations. Convert cumulative counters to
  differences and verify inclusion semantics before supplying the number.
- `harnessBasis: observed-delivered-tokens` and `harnessTokens`: actual complete
  model-delivered PH text, including guidance, wrappers, skills, references, and
  repeated appearances. Selected/offered text and character estimates do not
  establish this value. Missing provider or delivery observations stay unknown.
- For zero harness injection only, `zeroInjectionReason: already-present` or
  `no-relevant-rules`, with separately inspected evidence of retained meaning.

Cache, reasoning, cost, and latency belong in the observation report separately.
The helper never adds these to `taskTokens`; cached input or reasoning can already
be included by a provider. An externally verified complete total is required.

## Fixed Arithmetic

For each host independently, calculate the ordinary even-sample median of the
six A values and six B values, using the average of the middle two. The harness
criterion is `median(B) <= 0.9 * median(A)`, without rounding before comparison.
The task criterion is `median(B) <= median(A)`, and at least four individual
pairs must also have `B.taskTokens <= A.taskTokens`. A zero harness baseline is
inconclusive, not infinite savings. Never pool hosts to hide a failing host.

`MEETS_CRITERIA` means only that supplied numbers and declared conditions meet
these arithmetic checks. `NOT_IMPROVED` means they do not. Missing, invalid,
incomplete, unmatched, or value-losing observations return `INCONCLUSIVE`.
Every result keeps `productVerdict: UNVERIFIED`: trust flow, actual behavior,
meaning preservation, observation authenticity, and independent-user UX need
their own evidence. Synthetic tests of this helper are not experiment results.

Do not lower thresholds after seeing results. Stop the same optimization
hypothesis after three unsuccessful revisions, retaining all outcomes as
INCONCLUSIVE or NOT_IMPROVED. This helper does not track or authorize new runs.
