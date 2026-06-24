# QA Coverage Dispatch Template

{{COMMON_DISPATCH_HEADER}}

Goal:
{{GOAL}}

Scope:

- 담당 범위: tests, coverage map, test strategy, test fixtures.
- feature behavior 변경은 직접 하지 말고 `Handoff`에 보고한다.
- release publish는 하지 않는다.

Context:

{{CONTEXT}}

Tasks:

1. 현재 테스트가 인수/통합/단위 중 어디에 속하는지 분류한다.
2. 목표 모듈의 public behavior와 unit seam을 정리한다.
3. 가장 약한 coverage gap부터 focused tests를 추가한다.
4. 테스트-only 변경은 독립 atomic commit으로 만든다.

Verification:

```bash
npm test -- {{FOCUSED_TESTS}}
npm run typecheck
npm run build
```

Report:

`result-report-format.md` 형식으로 보고한다.

