<!-- Title guide: name the behavior or user-visible outcome. Use conventional
prefixes such as feat, fix, docs, ci, or refactor when useful. -->

## What changes

<!-- Explain the concrete behavior in one or two sentences. -->

- 

## Why

<!-- Link the issue or explain the concrete problem this resolves. -->

Closes #

## Closure readiness

- [ ] Linked issue and its observable close condition are stated above.
- [ ] I included the full deterministic boundary from input through the final artifact or output.
- [ ] I showed the relevant fail-closed or adversarial boundary, not only the happy path.
- [ ] I linked independent evidence or explained why none is required.
- [ ] I named the single hosted-only residual that remains after local verification, or stated that none remains.

## User-visible behavior

- [ ] I described the expected happy path and a meaningful failure or boundary path.
- [ ] The behavior is covered by a focused test, manual observation, or both.

## Verification

- [ ] `npm test` or scoped equivalent
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run check:docs`
- [ ] Manual QA through the affected CLI, package, workflow, or UI surface

Evidence, run IDs, or screenshots when applicable:

- 

## Scope and release impact

- [ ] This PR is focused on one coherent behavior or repository workflow.
- [ ] Defaults, schemas, package version, and release behavior are unchanged, or changes are called out below.
- [ ] Claims in docs and release notes stop at the evidence collected here.

Release or migration notes:

- None.

## External decision

- [ ] Package bytes are unchanged, so External is waived with an equal-footing package comparison.
- [ ] Package bytes changed, so fresh External verification is required before integration.

## Further implementation

- [ ] This PR closes the linked issue's complete boundary; no further implementation is expected before its final evidence gate.
- [ ] Further implementation is expected; I described the remaining boundary and why this PR does not claim closure.
