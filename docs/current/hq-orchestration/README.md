# HQ Orchestration

Persona Harness HQ는 사용자와 대화하면서 기능 의도를 정규화하고, 전용 Codex 세션에 작업을 분기한 뒤, 결과를 다시 수집해 다음 작업으로 연결하는 운영 허브다.

이 문서 묶음은 수동 복붙 중심 운영을 줄이고, HQ가 `send_message_to_thread` / `read_thread` 같은 thread 도구로 직접 dispatch와 result collection을 수행하기 위한 표준이다.

## Documents

- [protocol.md](protocol.md): HQ 운영 프로토콜.
- [templates/common-dispatch-header.md](templates/common-dispatch-header.md): 모든 담당 세션에 붙이는 공통 지시.
- [templates/dispatch-cli-workflow.md](templates/dispatch-cli-workflow.md): CLI Workflow 작업 요청 템플릿.
- [templates/dispatch-runtime-hooks.md](templates/dispatch-runtime-hooks.md): Runtime Hooks 작업 요청 템플릿.
- [templates/dispatch-skills-prompting.md](templates/dispatch-skills-prompting.md): Skills Prompting 작업 요청 템플릿.
- [templates/dispatch-qa-coverage.md](templates/dispatch-qa-coverage.md): QA Coverage 작업 요청 템플릿.
- [templates/dispatch-docs-release.md](templates/dispatch-docs-release.md): Docs Release 작업 요청 템플릿.
- [templates/dispatch-research-reference.md](templates/dispatch-research-reference.md): Research Reference 작업 요청 템플릿.
- [templates/result-report-format.md](templates/result-report-format.md): 모든 세션 결과 보고 형식.

## Default Flow

1. HQ asks enough questions to normalize the user's intent.
2. HQ derives scope, non-goals, success criteria, and owner session.
3. HQ sends a dispatch prompt to the owner session.
4. Owner session reports in Korean using the standard result format.
5. HQ reads the result, checks conflicts and gaps, then decides the next dispatch.
6. Every session result is documented in repo docs or the external develop memory before release decisions.

## Core Rule

사용자는 HQ와만 대화해도 된다. HQ가 담당 세션에 보내고, 읽고, 다음 작업을 이어간다.

