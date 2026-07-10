# HQ Thread Index

Updated: 2026-07-10

이 문서는 Persona Harness HQ가 작업을 분기할 때 사용하는 재사용 lane 인덱스다. 새 thread를 만들기 전에 이 표를 먼저 확인한다.

2026-07-10 reset: 새 작업은 아래 canonical lane id로만 보낸다. 이전 lane id는
`Archived / Superseded Threads`의 historical/context source로만 사용한다.

## Canonical Lanes

| Lane | Thread id | Title | Owns | Must Not Own |
| --- | --- | --- | --- | --- |
| HQ | `019f498a-4379-7423-9e8a-135467a20beb` | `Persona Harness HQ` | 사용자 대화, 의도 정규화, 우선순위, dispatch, 결과 통합 | 장시간 smoke/A-B 직접 실행 |
| Skills Prompting | `019f498a-54c4-7641-b2b9-9abd633331d5` | `[Persona Harness] Skills Prompting` | `packages/shared-skills/**`, `.persona/rules/**`, rail/rule wording, Java/backend guidance, prompt/claim boundary review | CLI/runtime implementation, release/publish |
| Research Reference | `019f498a-629c-7532-bcbf-e94f6ebeb653` | `[Persona Harness] Research Reference` | archive/measurement/reference analysis, claim-boundary review, OMO/Codex/reference synthesis | product code changes, release/publish |
| QA Coverage | `019f4988-b1ef-7842-963e-8f2609a08acd` | `[Persona Harness] QA Coverage` | exact source/measurement verification, unit/integration/e2e-smoke coverage map, source-vs-package acceptance decisions | feature scope decisions, release/publish |
| CLI Workflow | `019f4988-dc1e-7dc1-b599-e1f342c30837` | `[Persona Harness] CLI Workflow` | `src/cli/**`, `ph workflow`, `ph plan`, ticket/report/check/finish/continue UX | runtime injection, release/publish, external smoke |
| Runtime Injection | `019f498a-6a40-7a21-8c8c-453723183e1f` | `[Persona Harness] Runtime Injection` | `src/runtime/**`, hooks, injection, evidence, intent, continuation, profile summary attribution | CLI UX, release/publish, external smoke |
| External Smoke | `019f4988-c075-7363-a160-82f7cc551948` | `[Persona Harness] External Smoke` | clean install, local/tarball/registry smoke, OpenCode/TUI smoke, A-B/generated output observation | repo code changes, release/publish, product decision 확정 |
| Docs Release | `019f4988-ce67-7253-992d-6a12176b7a71` | `[Persona Harness] Docs Release` | README, CHANGELOG, release notes, external guides, develop/current records, package version release prep | runtime/CLI behavior 구현, OpenCode smoke, publish without approval |

## Routing Rules

- 기능/UX 명령 동작이 `ph workflow`, `ph plan`, ticket, report, check, finish, continue에 닿으면 `CLI Workflow`로 보낸다.
- injection block, hook, evidence JSON, intent routing, profile summary attribution이면 `Runtime Injection`으로 보낸다.
- generated project 검증, clean install, OpenCode/TUI 실행, A-B는 `External Smoke`로 보낸다.
- release note, changelog, README, external guide, develop 기록, version bump는 `Docs Release`로 보낸다.
- 테스트 맵, parser-level/unit/integration/e2e-smoke coverage는 `QA Coverage`로 보낸다.
- shared skill, rule wording, rail wording, Java/backend prompt guidance는 `Skills Prompting`으로 보낸다.
- OMO/Codex/reference/whitepaper 조사와 운영 전략 분석은 `Research Reference`로 보낸다.
- dispatch prompt 자체를 정교화해야 하면 HQ가 정규화하고, wording/rule/prompt 경계는 `Skills Prompting`으로 보낸다. `Prompt Architect` lane은 이번 reset에서 dormant로 내렸다.

## Archived / Superseded Threads

아래 thread는 같은 책임의 canonical lane으로 흡수됐거나 일회성 분석이 끝났으므로 archive 상태로 유지한다.

| Thread id | Reason |
| --- | --- |
| `019ed945-1bd4-7262-a4ff-66563c4cf0aa` | old HQ lane, superseded by `019f498a-4379-7423-9e8a-135467a20beb` |
| `019ef8b8-bfdf-7c72-9e6b-f50424e3993f` | old Prompt Architect lane, folded into HQ/Skills Prompting for the 2026-07-10 reset |
| `019ef8d2-c35c-75b1-bbae-fe66c8343ec3` | old Runtime Injection lane, superseded by `019f498a-6a40-7a21-8c8c-453723183e1f` |
| `019ef8d2-cc51-7c02-bbc3-209a216ca20c` | old CLI Workflow lane, superseded by `019f4988-dc1e-7dc1-b599-e1f342c30837` |
| `019ef8e2-8faa-7983-957e-9453c86f1384` | old Docs Release lane, superseded by `019f4988-ce67-7253-992d-6a12176b7a71` |
| `019ef8c2-d17f-7713-9fa1-79be6a9a2c4b` | old External Smoke lane, superseded by `019f4988-c075-7363-a160-82f7cc551948` |
| `019ef819-3a55-7cd3-aa36-af1017758487` | old QA Coverage lane, superseded by `019f4988-b1ef-7842-963e-8f2609a08acd` |
| `019ef81b-8189-7ea3-ab66-f80a672e4786` | old Skills Prompting lane, superseded by `019f498a-54c4-7641-b2b9-9abd633331d5` |
| `019ef81b-924c-7323-8a42-25d62b039902` | old Research Reference lane, superseded by `019f498a-629c-7532-bcbf-e94f6ebeb653` |
| `019f4984-d0d1-7be2-8c15-f3b894de0466` | failed explicit `gpt-5.6` creation attempt, archived; do not use |
| `019f4984-dead-7c92-86f7-c410f0ded47e` | failed explicit `gpt-5.6` creation attempt, archived; do not use |
| `019f4984-eb19-71b0-b232-bdeb6bb66c65` | failed explicit `gpt-5.6` creation attempt, archived; do not use |
| `019f4984-f31b-74f2-b53b-e26ae07605e6` | failed explicit `gpt-5.6` creation attempt, archived; do not use |
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
2. 이 인덱스의 canonical table에서 담당 lane을 고른다.
3. superseded/archived id에는 새 작업을 보내지 않는다.
4. 해당 canonical lane thread id로 `send_message_to_thread`를 사용한다.
5. 새 thread가 필요하면 이유를 명시하고, 반복 업무가 되면 이 문서에 canonical lane으로 승격한다.
6. 결과는 `[HQ_RESULT] <Lane>: ...` 메시지로 HQ에 돌아와야 한다.
