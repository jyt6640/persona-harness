# P2 E1 Test-Integrity Corpus

This source-only corpus preregisters a bilingual-free Java structural
false-positive contract for future warning candidates:

- `E1-A1`: assertionless or empty JUnit `@Test` methods.
- `E1-A2`: JUnit `@Disabled` or `@Ignore` test methods without a usable
  reason.

It contains 21 stable cases: 7 positive warning candidates and 14 difficult
negatives. `E1-A1` has 3 positives and 9 negatives; `E1-A2` has 4 positives
and 5 negatives. The negatives cover expected exceptions, parameterized
tests, inherited/helper assertions, interaction-only tests, framework
annotations, empty lifecycle fixtures, intentional disabled reasons, non-test
annotations, and comments/strings.

## Evaluation

The deterministic evaluator is a corpus validator and external-candidate
scorer. It does not parse Java to detect warnings, does not call product code,
and does not enable any runtime behavior.

```bash
node experiments/p2-e1-test-integrity-corpus/measure.mjs --validate
node experiments/p2-e1-test-integrity-corpus/measure.mjs
node experiments/p2-e1-test-integrity-corpus/measure.mjs --candidate /path/to/candidate.json
```

The default command uses [`reference-evaluation.json`](reference-evaluation.json),
an oracle self-check rather than detector output. A future candidate input must
include the exact corpus id, frozen-label SHA-256, every evaluated case id, and
its emitted findings. The evaluator emits per-rule TP/TN/FP/FN counts,
precision, recall, coverage, thresholds, and a pass/fail decision.

Each rule requires 100% coverage, precision `1.00`, recall `1.00`, zero false
positives, and zero false negatives. This strict threshold protects the
preregistered false-positive corpus; it is not a product target.

## Report-Only Structural Candidate

```bash
node experiments/p2-e1-test-integrity-corpus/report.mjs
```

The command tokenizes the frozen Java fixtures, resolves explicit JUnit imports
and fully qualified annotations, maps every corpus anchor to a parsed method,
and emits a candidate plus its deterministic corpus evaluation. It recognizes
only the two preregistered tracks:

- `E1-A1`: exact JUnit 4/Jupiter `@Test` methods without an assertion,
  expected-exception contract, helper assertion, or interaction verification.
  Parameterized and lifecycle annotations are excluded structurally.
- `E1-A2`: exact JUnit `@Disabled` or `@Ignore` test methods with no reason or
  a blank string reason.

The machine-readable report always includes `reportOnly: true`,
`sourceOnly: true`, `enforcement: false`, and
`productRuntimeInvocation: { "permitted": false }`. It reads only this corpus
and its fixtures. It does not import or invoke product code, register a
warning/block rule, change CLI behavior, or alter defaults.

## Mutation And Boundary

[`corpus.json`](corpus.json) freezes each record id, rule id, expected label,
category, fixture, and marker with a SHA-256. Fixture content SHA-256 values
also bind the Java source. After a candidate evaluation, labels cannot be
changed in place: add a new id, a new corpus version/fingerprint, and a
separate result artifact.

Results are corpus-only. They are not product-quality evidence and do not
authorize warnings to force, block, promote, or change defaults. The root npm
package excludes `experiments/**`; this corpus is repository source material
only.
