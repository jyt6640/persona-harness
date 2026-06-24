# Skills Prompting Dispatch Template

{{COMMON_DISPATCH_HEADER}}

Goal:
{{GOAL}}

Scope:

- 담당 범위: `packages/shared-skills/**`, `.persona/rules/**`, workflow rail wording, Java/backend guidance.
- CLI/runtime implementation은 직접 수정하지 말고 `Handoff`에 보고한다.
- release publish는 하지 않는다.

Context:

{{CONTEXT}}

Tasks:

1. 관련 skill/rule 문서를 확인한다.
2. 문구가 너무 강한 hard rule인지, 기본 guidance인지, project-choice인지 분류한다.
3. 필요한 최소 문구만 보강한다.
4. 문구 snapshot 또는 loader tests가 있으면 갱신한다.
5. 작업 단위별 atomic commit을 만든다.

Verification:

```bash
npm test -- {{FOCUSED_TESTS}}
npm run typecheck
npm run build
```

Report:

`result-report-format.md` 형식으로 보고한다.

