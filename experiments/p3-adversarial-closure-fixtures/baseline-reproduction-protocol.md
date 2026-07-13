# P3-1 Baseline Reproduction Protocol

Status: non-default protocol. Do not run as part of normal tests, package
checks, or release gates.

This protocol exists only to reproduce a vulnerable pre-P3 observation in a
disposable synthetic project. A vulnerable PASS is historical/audit evidence,
not an accepted product test result and not a mitigation.

## Preconditions

- Use a newly created disposable directory outside any real project.
- Do not use attendance, bus/BE, core, or any user project.
- Do not use the network, package registry, or user evidence.
- Copy only the payload bytes from one fixture case into the disposable project.
- Record the exact Persona Harness package/ref under test separately from this
  source-only corpus.

## Procedure

1. Validate this corpus with `node experiments/p3-adversarial-closure-fixtures/validate.mjs`.
2. Create a disposable project and copy one fixture payload directory into it.
3. If demonstrating the pre-P3 vulnerable observation, run the old target PH
   version inside only that disposable project.
4. Store a bounded receipt containing command argv, exit code, stdout/stderr
   summary, source fixture ID, and whether a real Gradle/JUnit run occurred.
5. Destroy the disposable project after preserving the bounded receipt.

## Red/Green Policy

Merged tests from P3-1 validate the corpus and mutation refusal only. They must
not encode a vulnerable `workflow finish implement` PASS as a green product
assertion. Future P3-2 through P3-5 branches may carry red-first security tests
only when the terminal accepted branch makes those tests green by rejecting the
forged authority.
