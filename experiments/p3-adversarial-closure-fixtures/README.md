# P3-1 Adversarial Closure Fixtures

Status: source-only fixture contract for P3-1. This directory is excluded from
the npm package and is not product evidence.

The corpus preserves two production-audit P0 reproductions as future
security-regression inputs:

- `p3-1-forged-bearshell-build-success`: arbitrary project-local `bearshell`
  JSON and report text can say `BUILD SUCCESSFUL` without a real Gradle/JUnit
  run.
- `p3-1-forged-tdd-self-digest-pass`: local JUnit XML and TDD JSON can be
  self-consistent without a PH-run red-to-green chain or trusted attestation.

These payloads are intentionally adversarial. Their bytes are fixture data, not
authority. Passing this corpus validator does not mean the product is fixed, and
it does not accept the vulnerable behavior.

## Validator

Run:

```sh
node experiments/p3-adversarial-closure-fixtures/validate.mjs
```

The validator only reads this experiment directory, checks immutable file
fingerprints and typed contract fields, and exits nonzero on drift. It must not
call `ph`, shell out to the product CLI, use the network, inspect real project
state, or execute any baseline reproduction.

## Future Acceptance Boundary

P3-2 and later fixes must make these attacks non-authoritative:

- unsigned local `bearshell` text alone must not satisfy
  `workflow finish implement`;
- unsigned local TDD/JUnit files alone must not satisfy TDD/archive/finish
  authority;
- a project-local `generatedBy` marker, self-computed digest, arbitrary head,
  arbitrary command/exit, stale attempt ID, or missing external attestation must
  fail closed for finish authority.

## Mutation Policy

The corpus is append-only. Existing case IDs, payload files, transcripts, and
hashes are immutable. New attack observations require a new schema or new
result directory; existing cases must not be relabeled.
