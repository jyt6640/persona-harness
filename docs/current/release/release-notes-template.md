# Persona Harness Release Notes

## Version

`vX.Y.Z`

## Dist Tag

`alpha` / `beta` / `latest`

## npm Package

`persona-harness@X.Y.Z`

## Summary

One or two sentences explaining who should use this release and why.

Describe Persona Harness as an AI coding workflow rail + evidence + continuation harness. Do not describe the release as a Java Clean Code quality guarantee, generated app product-quality certification, evidence-count quality proof, or AST/linter/build-failure enforcement.

## What Changed

- 
- 
- 

## Install

```bash
npm install -D persona-harness@<dist-tag>
npx ph init
```

## Supported Scope

- 
- 
- 

## Not Supported

- 
- 
- 

## Verification

Commands run before release:

```bash
npm test
npm run typecheck
npm run build
npm run report:rules
npm run check:scope:strict
npm run check:injection-value
npm publish --dry-run --tag <dist-tag>
```

Result:

- 

## Package Contents Notes

- 

## Known Gaps

- 
- Generated app product quality is not certified.
- Evidence means read/injection/workflow traces, not a quality score.
- A/B or ON/OFF smoke results are stack-steering signals only and may be limited by sample size, non-blind runs, same operator, model/version, prompt, timeout, and continuation behavior.

## Release Automation

- `[ ]` tag matches `package.json` version
- `[ ]` GitHub Actions verify job passed
- `[ ]` npm publish job passed
- `[ ]` GitHub release notes were created

## Next

- 
