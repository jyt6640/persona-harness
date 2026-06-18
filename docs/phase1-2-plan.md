# Phase 1.2 Plan

## Goal

Start with one narrow Guard/AST/linter observation.

Phase 1.2 should observe whether a generated Java/Spring fixture violates one clear boundary. It should not become a broad rule engine, a product-quality gate, or a required build failure.

## First Observation Candidate

Observe whether a Spring `Controller` directly depends on a `Repository`.

The first candidate is intentionally narrow because Phase 0 and Phase 1.1 only proved rule injection and catalog-backed selection. They did not prove generated code compliance.

## Non-Goals

- Not an enforcement gate.
- Do not fail the build.
- Do not certify generated app product quality.
- Do not introduce a broad AST framework.
- Do not expand into profile-aware, frontend, infra, or OMO workflow adaptation.
- Do not replace Phase 1.1 catalog selection.

## Output

Write observation results only to ignored fixture or experiment output.

Expected report shape:

- observed fixture/run id
- files inspected
- rule observed
- PASS / WEAK / FAIL / UNKNOWN
- short evidence summary
- no product-quality certification

## Next Loop

Minimal observer design.

Recommended next loop:

```text
Design a minimal observation-only check for whether Controller directly depends on Repository, and document the report format without enforcing it.
```
