## Summary

- 

## Scope

Keep this PR narrow:

- [ ] catalog eligibility layer
- [ ] frontmatter/glob/scenario-aware rule selection
- [ ] compatibility tests
- [ ] Phase 0/Phase 1.1 documentation

## Verification

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`

Relevant run ids:

- Phase 0 #1:
- Phase 0 #2-3:
- Phase 1.1 runtime catalog selection:

## Important Limits

- This is not a full rule engine.
- This is not Guard/AST/linter enforcement.
- This does not guarantee generated app product quality.
- Detector/evidence remains auxiliary observation, not a quality gate.
- Some live evidence may be prompt-read assisted.

## Next

- [ ] Phase 1.2 candidate is observation-only, not enforcement.
- [ ] First candidate: observe whether Controller directly depends on Repository.
- [ ] Reports should be written to ignored fixture/experiment output only.
