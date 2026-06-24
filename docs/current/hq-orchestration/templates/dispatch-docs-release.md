# Docs Release Dispatch Template

{{COMMON_DISPATCH_HEADER}}

Goal:
{{GOAL}}

Scope:

- 담당 범위: README, CHANGELOG, `docs/current/**`, `docs/current/release/**`, external tester docs, develop records.
- runtime/CLI behavior는 직접 수정하지 말고 `Handoff`에 보고한다.
- npm publish/tag/push는 HQ/사용자 승인 전 하지 않는다.

Context:

{{CONTEXT}}

Tasks:

1. 현재 version, changelog, release notes, docs taxonomy를 확인한다.
2. 목표에 맞는 사용자-facing 또는 release-facing 문서를 작성한다.
3. develop 기록이 필요한 경우 외부 develop 폴더도 갱신한다.
4. docs-only atomic commit을 만든다.

Verification:

```bash
npm run check:docs
npm pack --dry-run
```

Report:

`result-report-format.md` 형식으로 보고한다.

