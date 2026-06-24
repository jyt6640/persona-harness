# HQ Thread Index

Updated: 2026-06-24

이 문서는 Persona Harness HQ가 작업을 분기할 때 사용하는 재사용 lane 인덱스다. 새 thread를 만들기 전에 이 표를 먼저 확인한다.

## Canonical Lanes

| Lane | Thread id | Title | Owns | Must Not Own |
| --- | --- | --- | --- | --- |
| HQ | `019ed945-1bd4-7262-a4ff-66563c4cf0aa` | `Persona Harness HQ` | 사용자 대화, 의도 정규화, 우선순위, dispatch, 결과 통합 | 장시간 smoke/A-B 직접 실행 |
| Prompt Architect | `019ef8b8-bfdf-7c72-9e6b-f50424e3993f` | `[Persona Harness] Prompt Architect` | HQ 목표를 전담 lane dispatch prompt로 정규화 | 코드 수정, 테스트 실행, release, OpenCode smoke |
| Runtime Injection | `019ef8d2-c35c-75b1-bbae-fe66c8343ec3` | `[Persona Harness] Runtime Injection` | `src/runtime/**`, hooks, injection, evidence, intent, continuation, profile summary attribution | CLI UX, release/publish, external smoke |
| CLI Workflow | `019ef8d2-cc51-7c02-bbc3-209a216ca20c` | `[Persona Harness] CLI Workflow` | `src/cli/**`, `ph workflow`, `ph plan`, ticket/report/check/finish/continue UX | runtime injection, release/publish, external smoke |
| Docs Release | `019ef8e2-8faa-7983-957e-9453c86f1384` | `[Persona Harness] Docs Release` | README, CHANGELOG, release notes, external guides, develop records, package version release prep | runtime/CLI behavior 구현, OpenCode smoke, publish without approval |
| External Smoke | `019ef8c2-d17f-7713-9fa1-79be6a9a2c4b` | `[Persona Harness] External Smoke` | clean install, local/tarball smoke, OpenCode/TUI smoke, A-B/generated output observation | repo code changes, release/publish, product decision 확정 |
| QA Coverage | `019ef819-3a55-7cd3-aa36-af1017758487` | `[Persona Harness] QA Coverage` | unit/integration/e2e-smoke coverage map, parser/transition tests, test strategy | feature scope decisions, release/publish |
| Skills Prompting | `019ef81b-8189-7ea3-ab66-f80a672e4786` | `[Persona Harness] Skills Prompting` | `packages/shared-skills/**`, `.persona/rules/**`, rail wording, Java/backend guidance | CLI/runtime implementation, release/publish |
| Research Reference | `019ef81b-924c-7323-8a42-25d62b039902` | `[Persona Harness] Research Reference` | OMO/Codex/reference analysis, whitepaper synthesis, session strategy | product code changes, release/publish |

## Routing Rules

- 기능/UX 명령 동작이 `ph workflow`, `ph plan`, ticket, report, check, finish, continue에 닿으면 `CLI Workflow`로 보낸다.
- injection block, hook, evidence JSON, intent routing, profile summary attribution이면 `Runtime Injection`으로 보낸다.
- generated project 검증, clean install, OpenCode/TUI 실행, A-B는 `External Smoke`로 보낸다.
- release note, changelog, README, external guide, develop 기록, version bump는 `Docs Release`로 보낸다.
- 테스트 맵, parser-level/unit/integration/e2e-smoke coverage는 `QA Coverage`로 보낸다.
- shared skill, rule wording, rail wording, Java/backend prompt guidance는 `Skills Prompting`으로 보낸다.
- OMO/Codex/reference/whitepaper 조사와 운영 전략 분석은 `Research Reference`로 보낸다.
- dispatch prompt 자체를 정교화해야 하면 먼저 `Prompt Architect`로 보낸다.

## Archived / Superseded Threads

아래 thread는 같은 책임의 canonical lane으로 흡수됐거나 일회성 분석이 끝났으므로 archive 상태로 유지한다.

| Thread id | Reason |
| --- | --- |
| `019ef81b-7945-7513-b71e-359ca45e43a3` | old CLI Workflow duplicate, superseded by `019ef8d2-cc51-7c02-bbc3-209a216ca20c` |
| `019ef81b-89ec-75f3-b8c7-a139f4cb54d5` | old Docs Release duplicate, superseded by `019ef8e2-8faa-7983-957e-9453c86f1384` |
| `019ef81b-712c-7611-8e4f-a1589c334e75` | old Runtime Hooks duplicate, superseded by Runtime Injection lane |
| `019ed8a0-2280-77a0-84c2-850d1d4fe0b4` | historical Phase 1.2 observer design thread |
| `019ed923-9ef8-7182-942b-dd732e5b009e` | historical implementation/test check thread |
| `019ed857-607f-7273-a5eb-32a5d00d54ce` | historical Phase 1.1 design thread |
| `019ed4d0-4bb3-7992-a8c3-ecd3df1f76d1` | historical Controller role cleanup thread |
| `019ed57a-6298-7470-bad9-1ab0a0b50d15` | historical Phase 0 evidence evaluation thread |
| `019ed560-0f4e-7d51-b02d-72df479ce178` | historical response wording thread |
| `019ed4a2-cc6e-78e3-9f94-579672e0dbb5` | historical multi-work planning thread |

## Dispatch Checklist

1. 사용자 목표를 HQ가 정규화한다.
2. 이 인덱스에서 담당 lane을 고른다.
3. 해당 lane thread id로 `send_message_to_thread`를 사용한다.
4. 새 thread가 필요하면 이유를 명시하고, 반복 업무가 되면 이 문서에 canonical lane으로 승격한다.
5. 결과는 `[HQ_RESULT] <Lane>: ...` 메시지로 HQ에 돌아와야 한다.
