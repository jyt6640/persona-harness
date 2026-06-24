# HQ Thread Orchestration Protocol

## Goal

HQ가 사용자와 대화하면서 기능 의도를 정규화하고, 작업을 담당 세션으로 분기하고, 결과를 문서화한 뒤, 다음 작업을 다시 지시한다.

## Non-Goals

- 전용 세션이 자동 공유 메모리를 가진다고 가정하지 않는다.
- 사용자가 각 세션에 직접 복붙해야 한다고 가정하지 않는다.
- 하나의 큰 작업을 하나의 큰 커밋으로 묶지 않는다.
- 범위 밖 작업을 담당 세션이 임의로 수행하게 하지 않는다.

## Intent Normalization

HQ는 기능 개발 요청을 받으면 바로 dispatch하지 않는다. 먼저 아래 항목이 충분히 정규화됐는지 본다.

- 사용자가 만들고 싶은 기능 또는 workflow.
- 기능이 해결할 실제 문제.
- 성공했을 때 사용자가 관찰할 행동.
- 입력 artifact: README, prompt-only requirements, profile, plan, backlog, ticket.
- 담당 영역: CLI, Runtime, Skills, QA, Docs, Research.
- 범위 밖 항목.
- 검증 방법.
- 커밋 단위.

불분명하면 HQ가 계속 질문한다. 질문은 한 번에 너무 많이 던지지 말고, 다음 분기 판단에 필요한 것부터 묻는다.

## Dispatch Rules

HQ는 담당 세션에 메시지를 직접 보낸다.

모든 dispatch에는 다음이 포함되어야 한다.

- 공통 지시.
- Goal.
- Scope.
- Non-goals.
- Current context.
- 해야 할 일.
- 검증 명령.
- 보고 형식.

담당 세션은 반드시 한국어로 보고한다.

## Result Collection

HQ는 담당 세션 결과를 읽은 뒤 다음을 확인한다.

- Result가 goal을 만족하는지.
- Changed files가 담당 범위 안인지.
- Tests와 verification이 충분한지.
- Commit이 작업 단위별로 나뉘었는지.
- Handoff가 필요한지.
- 다른 세션 작업과 충돌하는지.

결과는 반드시 문서화한다.

- 제품/사용자-facing 결정: `docs/current/**`
- release 관련: `docs/current/release/**`
- evidence review: `docs/current/evidence-reviews/**`
- HQ 운영 메모리: `/Users/yongtae/Documents/하네스/Persona-Harness/develop/HQ-CURRENT-MEMORY.md`
- 날짜별 진행 기록: `/Users/yongtae/Documents/하네스/Persona-Harness/develop/YYYY-MM-DD-*.md`

## Commit Policy

모든 세션은 작업 단위별 atomic commit을 따른다.

- 기능 변경과 문서 변경이 독립이면 분리한다.
- 테스트-only 보강이 독립이면 분리한다.
- release/version bump는 분리한다.
- smoke report는 분리한다.
- unrelated dirty file은 섞지 않는다.
- push는 HQ/사용자 지시가 있을 때만 한다.

## Session Ownership

| Session | Owns | Must Not Own |
| --- | --- | --- |
| HQ | direction, decisions, dispatch, result synthesis | broad implementation without owner split |
| CLI Workflow | `src/cli/**`, `ph` workflow commands, tickets, reports | runtime injection prose, npm publish |
| Runtime Hooks | `src/runtime/**`, hooks, intent, evidence, continuation | CLI command behavior, release docs |
| Skills Prompting | shared-skills, `.persona/rules`, rail wording | CLI implementation, package publish |
| QA Coverage | unit tests, coverage map, test strategy | feature scope decisions |
| Docs Release | README, CHANGELOG, release notes, external guides, develop logs | runtime/CLI behavior |
| Research Reference | OMO/Codex/reference analysis | product code changes |

## Stop Rules

HQ should stop dispatching and ask the user when:

- a destructive or irreversible action is needed;
- publish/tag/push needs explicit approval;
- the user's desired product behavior is ambiguous and would materially change architecture;
- two sessions report conflicting implementation directions.

