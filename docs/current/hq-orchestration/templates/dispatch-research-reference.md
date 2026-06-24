# Research Reference Dispatch Template

{{COMMON_DISPATCH_HEADER}}

Goal:
{{GOAL}}

Scope:

- 담당 범위: OMO/reference/Codex whitepaper/session strategy/research memo.
- product code 변경은 하지 않는다.
- release publish는 하지 않는다.

Context:

{{CONTEXT}}

Tasks:

1. 지정된 reference를 확인한다.
2. Persona Harness에 도입할 후보와 도입하지 말아야 할 후보를 분리한다.
3. 적용 순서와 리스크를 정리한다.
4. research memo 또는 decision memo를 독립 atomic commit으로 만든다.

Verification:

```bash
npm run check:docs
```

Report:

`result-report-format.md` 형식으로 보고한다.

