## Summary

<!-- What does this change do, in one or two sentences? -->

- 

## Claim level

This project only asserts what its evidence supports. Check the highest level
this PR reaches (see [CONTRIBUTING](../CONTRIBUTING.md#the-claim-ladder)):

- [ ] 1–2: surface exists / gate is invoked in a fixture
- [ ] 3–4: PH-generated evidence + adversarial cases fail honestly
- [ ] 5: external smoke reproduces it from a fresh tarball/npm
- [ ] 6: repeated A/B shows improvement for a named scenario
- [ ] This PR makes no new claim (pure fix/refactor/docs)

If this could be read as a broader claim (token savings, quality, reliability),
link the measurement or state which level it stops at:

## Verification

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run check:docs`

Evidence / run ids (if applicable):

- 

## Scope check

- [ ] Narrow: one behavior in this PR.
- [ ] New behavior has a test (prefer red-first).
- [ ] No new always-on injection / broad linter / unproven surface added without an issue discussion.
- [ ] No claim in docs/README beyond what the evidence above supports.
