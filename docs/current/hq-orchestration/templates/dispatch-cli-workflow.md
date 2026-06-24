# CLI Workflow Dispatch Template

{{COMMON_DISPATCH_HEADER}}

Goal:
{{GOAL}}

Scope:

- 담당 범위: `src/cli/**`, CLI workflow tests, CLI-facing report templates.
- Runtime hook/injection/skill 문구는 직접 수정하지 말고 `Handoff`에 보고한다.
- release publish는 하지 않는다.

Context:

{{CONTEXT}}

Tasks:

1. 현재 CLI command surface와 관련 tests를 확인한다.
2. 목표 행동을 CLI 명령 출력/상태/exit code 기준으로 구현한다.
3. focused tests를 추가한다.
4. built CLI 또는 `runPersonaCli` 기반 smoke로 실제 출력 표면을 확인한다.
5. 작업 단위별 atomic commit을 만든다.

Verification:

```bash
npm test -- {{FOCUSED_TESTS}}
npm run typecheck
npm run build
```

Report:

`result-report-format.md` 형식으로 보고한다.

