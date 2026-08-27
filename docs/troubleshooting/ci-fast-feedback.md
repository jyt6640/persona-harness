# CI fast feedback and main integration

This guide explains the measured CI split introduced by [PR #386](https://github.com/jyt6640/persona-harness/pull/386). It is an operational record and troubleshooting guide, not a release-quality claim.

## The decision

The protected `Verify repository` check remains the required PR and `main` status. What changed is the work it aggregates for each event:

| Event | Required work | Why |
| --- | --- | --- |
| Pull request | Fast feedback, parallel-safe Vitest project, resource-sensitive Vitest project, and the `Verify repository` aggregate | Fast, complete source feedback before merge |
| Push to `main` | Everything from the PR path plus main package integration | Proves the authoritative package boundary after the protected merge |
| Release and publish | Existing full `test:repository` contract | Keeps release safety independent of PR latency |

`Main package integration` is intentionally skipped for pull requests. The aggregate treats that exact `skipped` result as correct on a PR and requires `success` on a `main` push. Do not make the package job required directly in branch protection; `Verify repository` is the stable required context.

## Measured result

The baseline was six successful PR runs before the split. Their total required-check durations ranged from 8m13s to 10m38s, with a median of 9m54s. The npm cache was already a hit, so cache configuration was not the dominant problem. The serial test step combined the full Vitest suite, clean-package verification, repeated policy checks, and the packaged Gradle/JUnit demo.

The first natural PR after the split was [CI run 33074010732](https://github.com/jyt6640/persona-harness/actions/runs/33074010732) for PR #386:

| Check | Duration | Result |
| --- | ---: | --- |
| Fast feedback | 36s | Success |
| Repository tests / parallel | 2m14s | Success |
| Repository tests / resource-sensitive | 3m52s | Success |
| Verify repository aggregate | 4m03s from run creation | Success |

This reduced the observed required PR feedback time by about 5m51s, or 59 percent, versus the baseline median. This is a measured result from one natural PR, not a future-runtime guarantee.

The post-merge [CI run 33074407437](https://github.com/jyt6640/persona-harness/actions/runs/33074407437) for `main` commit `5d37fa93304e002429b66843f324fe6345047951` also succeeded. Its `Main package integration` job completed in 4m36s and passed all retained package checks:

- authoritative clean-package boundary;
- Linux Node 20.19.0 source-built package surface;
- Linux Node 20.19.0 fresh local-tarball installed package surface; and
- exact packaged Gradle/JUnit cooperative finish demo.

The same commit passed [Windows platform smoke](https://github.com/jyt6640/persona-harness/actions/runs/33074407486) and the [canonical clean CI attestation builder](https://github.com/jyt6640/persona-harness/actions/runs/33074407470).

## Why this split is safe

The Vitest projects were already defined as separate execution classes. The `parallel` project contains normal test files; the `resource-sensitive` project deliberately uses one worker and disables file parallelism. The CI workflow now runs those existing projects in separate GitHub jobs instead of making the second wait behind the first in one process.

The main package job keeps the checks that are materially more expensive or need the workflow-selected observer GitHub CLI. A standalone `npm pack --dry-run` was removed from CI because the authoritative clean-package boundary performs real clean package materialization and repeated package checks. It is not a substitute for that authoritative boundary.

Release and publish workflows still run `npm run test:repository`, so this optimization does not weaken release verification.

## Troubleshooting

### `Main package integration` is skipped on a pull request

This is expected. It has `if: github.event_name == 'push'`. Confirm the `Verify repository` aggregate is successful instead:

```bash
gh pr checks <pr-number>
```

If the aggregate fails on a PR because `Main package integration` is anything other than `skipped`, inspect the event condition and the aggregate shell assertions in `.github/workflows/ci.yml`. Do not bypass the aggregate or add `Main package integration` as a second required branch-protection context.

### `Verify repository` is missing or branch protection is blocked

Branch protection keys off the check name, not the job id. Keep the job name exactly `Verify repository` and keep its `if: ${{ always() }}` guard. The aggregate must wait for all event-appropriate jobs and explicitly test their results; otherwise a skipped upstream job can accidentally make the required context look green.

Inspect the actual job graph before editing:

```bash
gh run view <run-id> --json status,conclusion,jobs,url
```

### PR feedback is slow again

Measure before changing cache keys or removing checks. Start with the job durations:

```bash
gh pr checks <pr-number>
gh run view <run-id> --json createdAt,updatedAt,jobs
```

If `Fast feedback` dominates, inspect dependency installation, typecheck, and build independently. If `Repository tests / parallel` dominates, identify the slow test file before changing worker settings. If `Repository tests / resource-sensitive` dominates, preserve its single-worker configuration first; those tests were isolated because they use shared fixtures, worktrees, or other resources that are unsafe to parallelize blindly.

### A policy check fails after changing CI YAML

The repository intentionally validates action pins, action counts, job ownership, Node support wording, and required aggregate behavior. After a legitimate workflow split, update the associated policy checks and their focused tests together:

```bash
npm run check:release-workflows
node scripts/check-supported-node-matrix.mjs
npx vitest run --testTimeout=15000 tests/release-workflow-policy.test.ts tests/supported-node-matrix-policy.test.ts
```

Do not relax these checks just to make a renamed or moved job pass. They are the regression guard for this arrangement.

### Documentation or support-matrix checks fail

The Linux support statement appears in both `README.md` and `docs/START-HERE.md`, and `scripts/check-supported-node-matrix.mjs` validates the same boundary. Update all three deliberately, then run:

```bash
npm run check:docs
node scripts/check-supported-node-matrix.mjs
```

### The main package integration job fails

Treat this as a package or hosted-boundary failure, not as a reason to restore the old slow PR job. The workflow owns the observer GitHub CLI selection and preflight. Diagnose the exact failed step from the run, reproduce only the named deterministic boundary locally when its prerequisites are available, and submit a replacement PR. Do not invent an observer path, reuse stale package evidence, or rerun the hosted job as a debugger.

## Local verification for CI changes

For this workflow shape, run the focused local checks before opening a PR:

```bash
npm run test:repository:fast
npm run check:release-workflows
node scripts/check-supported-node-matrix.mjs
npm run check:docs
npm run check:scope:strict
npm run check:injection-value
npm run typecheck
npm run build
npm pack --dry-run --json
```

The full `test:repository` contract remains useful for release-oriented work, but it depends on the workflow-owned observer precondition. Do not fake that input to make a local run appear authoritative.

## Change checklist

Before merging another CI performance change:

1. Record baseline run ids and durations.
2. State which existing check owns each safety boundary after the change.
3. Preserve the exact `Verify repository` protected context and its event-aware aggregate assertions.
4. Add a focused regression test for the new workflow shape.
5. Compare one natural PR run against the baseline.
6. Confirm one natural `main` run still executes the package integration boundary.

This keeps CI optimization evidence-led: move work only when its safety owner remains explicit and tested.
