# Persona Harness Release Notes

## Version

`vX.Y.Z`

## Dist Tag

`alpha` / `beta` / `latest`

## npm Package

`persona-harness@X.Y.Z`

## Summary

One or two sentences explaining who should use this release and why.

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

## Release Automation

- `[ ]` tag matches `package.json` version
- `[ ]` GitHub Actions verify job passed
- `[ ]` npm publish job passed
- `[ ]` GitHub release notes were created

## Next

- 
