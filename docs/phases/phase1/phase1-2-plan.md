# Phase 1.2 Plan

## Goal

Controller가 Repository를 직접 의존하는지 관찰하는 최소 observer 설계.

Phase 1.2 should observe whether a generated Java/Spring fixture violates one clear boundary. It should not become a broad rule engine, a product-quality gate, or a required build failure.

## Scope

- Java/Spring backend fixture만 대상으로 한다.
- Controller -> Repository 직접 의존 여부만 관찰한다.
- report만 남긴다.

## First Observation Candidate

Observe whether a Spring `Controller` directly depends on a `Repository`.

The first candidate is intentionally narrow because Phase 0 and Phase 1.1 only proved rule injection and catalog-backed selection. They did not prove generated code compliance.

## Non-Goals

- enforcement gate 아님
- build/test failure로 연결하지 않음
- full Guard/AST/linter 아님
- product-quality 보증 아님
- profile-aware 확장 아님
- broad AST framework 아님
- Phase 1.1 catalog selection을 대체하지 않음

## Observation Target

- Controller class
- Repository interface/implementation import
- constructor field dependency
- method body direct repository call

## Report Format

Write observation results only to ignored fixture or experiment output.

Recommended report shape:

```md
# Phase 1.2 Observer Report

## Target

확인한 파일.

## Finding

PASS / WARN / UNKNOWN

## Evidence

관찰한 import, field, constructor parameter, method call.

## Limitations

문자열 기반인지 AST 기반인지, false positive 가능성.

## Decision

품질 게이트가 아니라 다음 rule/prompt 개선 후보인지 여부.
```

Minimum fields:

- observed fixture/run id
- files inspected
- rule observed
- PASS / WARN / UNKNOWN
- short evidence summary
- no product-quality certification

## Output

ignored experiment 또는 fixture report에 observation 결과만 남긴다.

Do not write observation reports into tracked docs unless a later loop explicitly asks for a summary.

## First Experiment

다음 loop에서 구현할 최소 observer 후보:

- input: ignored Java/Spring fixture or experiment sandbox
- target: `*Controller.java`
- observation: whether controller imports, stores, constructs with, or directly calls a `Repository`
- output: ignored report only
- result: PASS / WARN / UNKNOWN

## Next Loop

Minimal observer design.

Recommended next loop:

```text
Design a minimal observation-only check for whether Controller directly depends on Repository, and document the report format without enforcing it.
```
