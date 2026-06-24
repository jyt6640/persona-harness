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

HQ는 새 thread를 기본값으로 만들지 않는다. 담당 영역별 공용 lane을 먼저 재사용한다.

- 같은 담당 영역의 thread가 이미 있으면 `send_message_to_thread`로 이어서 보낸다.
- 새 thread는 해당 담당 영역의 공용 lane이 없거나, 기존 lane이 archive/blocked 상태이거나, 독립 worktree가 반드시 필요한 경우에만 만든다.
- 새로 만든 thread가 반복적으로 필요해지면 disposable task thread가 아니라 담당 영역 공용 lane으로 승격하고, thread id를 HQ memory에 기록한다.
- 장시간 OpenCode smoke, A/B, external validation은 공용 External Smoke lane으로 보낸다. HQ가 직접 실행하지 않는다.

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

담당 세션은 작업이 끝나면 HQ가 polling할 때까지 기다리지 않는다. 가능하면 thread 도구로 HQ 세션에 결과를 직접 전송한다.

현재 HQ thread id:

```text
019ed945-1bd4-7262-a4ff-66563c4cf0aa
```

담당 세션의 completion rule:

1. 자기 thread의 final answer에 정규화된 결과를 남긴다.
2. `send_message_to_thread` 또는 동등한 thread tool이 있으면 HQ thread로 같은 결과를 보낸다.
3. HQ로 보낼 때 제목은 `[HQ_RESULT] <세션명>: <짧은 결과>` 형식을 사용한다.
4. thread tool이 없거나 실패하면 final answer의 `Handoff`에 “HQ 직접 전송 실패”를 명시한다.

HQ는 담당 세션 결과를 받거나 읽은 뒤 다음을 확인한다.

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

## Result Return Message

담당 세션이 HQ로 보내는 메시지는 아래 구조를 따른다.

```md
[HQ_RESULT] <Session>: <Result summary>

## Result
...

## Changed Files
...

## Behavior
...

## Tests
...

## Verification
...

## Commit
...

## Handoff
...

## Risks
...

## Next
...
```

이 규칙의 목적은 HQ의 polling 비용을 줄이고, 사용자에게 결과가 자연스럽게 모이도록 만드는 것이다.

## Commit Policy

모든 세션은 작업 단위별 atomic commit을 따른다.

- 기능 변경과 문서 변경이 독립이면 분리한다.
- 테스트-only 보강이 독립이면 분리한다.
- release/version bump는 분리한다.
- smoke report는 분리한다.
- unrelated dirty file은 섞지 않는다.
- push는 HQ/사용자 지시가 있을 때만 한다.

## Permanent Lane Roles

HQ는 담당 thread를 임시 작업자가 아니라 재사용 가능한 lane으로 다룬다. lane 이름은 작업명이 아니라 장기 책임을 드러내야 한다.

이름 규칙:

- `Persona Harness HQ`: 사용자와 대화하며 의도, 우선순위, dispatch, 통합 판단을 맡는다.
- `Prompt Architect`: HQ가 정한 목표를 전담 lane에 보낼 dispatch prompt로 정규화한다.
- `Runtime Injection`: runtime hooks, injection, evidence, intent, profile summary attribution을 맡는다.
- `CLI Workflow`: `ph workflow`, `ph plan`, ticket/report/check/finish/continue UX를 맡는다.
- `Docs Release`: README, CHANGELOG, release notes, external guide, develop 기록, version prep을 맡는다.
- `External Smoke`: clean install, OpenCode/TUI smoke, A/B/generated output 관찰을 맡는다.
- `QA Coverage`: unit/integration/e2e-smoke coverage map과 테스트 보강을 맡는다.
- `Skills Prompting`: shared-skills, rail wording, `.persona/rules` prompt surface를 맡는다.
- `Research Reference`: OMO/Codex/reference 조사와 해석을 맡는다.

새 thread를 만들 때 제목은 `[Persona Harness] <Lane Name>` 형식을 사용한다. 이미 만들어진 thread도 가능한 한 이 이름으로 rename한다.

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
| External Smoke | clean install, OpenCode/TUI smoke, A/B/generated output review | product code changes, release/publish decisions |

현재 재사용 lane:

| Lane Name | Thread id | Reuse For |
| --- | --- | --- |
| Prompt Architect | `019ef8b8-bfdf-7c72-9e6b-f50424e3993f` | dispatch prompt design and normalization |
| Runtime Injection | `019ef8d2-c35c-75b1-bbae-fe66c8343ec3` | runtime injection, profile summary attribution, evidence/intent hook behavior |
| CLI Workflow | `019ef8d2-cc51-7c02-bbc3-209a216ca20c` | workflow tickets, `ph workflow`, `ph plan`, check/finish/continue behavior |
| Docs Release | `019ef8e2-8faa-7983-957e-9453c86f1384` | README, CHANGELOG, release notes, external guides, develop records |
| External Smoke | `019ef8c2-d17f-7713-9fa1-79be6a9a2c4b` | clean install, OpenCode/TUI smoke, A/B/generated output review |

## Stop Rules

HQ should stop dispatching and ask the user when:

- a destructive or irreversible action is needed;
- publish/tag/push needs explicit approval;
- the user's desired product behavior is ambiguous and would materially change architecture;
- two sessions report conflicting implementation directions.
