# Runtime Injection Dispatch Template

{{COMMON_DISPATCH_HEADER}}

Goal:
{{GOAL}}

Scope:

- 담당 범위: `src/runtime/**`, runtime hook tests, injection, intent/evidence/continuation logic, profile summary attribution.
- CLI command behavior는 직접 수정하지 말고 `Handoff`에 보고한다.
- release docs/publish는 하지 않는다.

Context:

{{CONTEXT}}

Tasks:

1. intent/router/injection/evidence/continuation 흐름을 확인한다.
2. 목표 behavior가 AI-facing injection 또는 hook output에 반영되는지 구현한다.
3. evidence가 필요한 경우 schema와 기록 위치를 좁게 유지한다.
4. focused runtime tests를 추가한다.
5. 작업 단위별 atomic commit을 만든다.

Verification:

```bash
npm test -- {{FOCUSED_TESTS}}
npm run typecheck
npm run build
```

Report:

`result-report-format.md` 형식으로 보고한다.
