# Persona Harness Workflow Transition Test Map

## Purpose

이 문서는 Persona Harness workflow의 단계 전환 테스트 커버리지를 QA Coverage 관점에서 정리한다.
범위는 테스트/커버리지/검증 전략이며, Runtime/CLI/Skills/Release 구현 결정은 포함하지 않는다.

## Test Classification

| 성격 | 기준 | 현재 대표 테스트 |
| --- | --- | --- |
| Unit | 순수 라우터, 포맷터, parser, observer처럼 단일 모듈의 반환값을 검증한다. 파일 시스템을 쓰더라도 fixture 범위가 작고 CLI 전체 흐름을 통과하지 않는다. | `phase0-top-level-intent-router.test.ts`, `phase0-workflow-skill-loader.test.ts`, `phase0-drift-detector.test.ts`, `phase1-*-observer.test.ts` |
| Integration | `runPersonaCli` 또는 hook surface를 통해 여러 CLI/runtime 모듈과 임시 프로젝트 파일 시스템을 함께 검증한다. 실제 npm package 실행은 아니지만 사용자 workflow 상태 전환을 관찰한다. | `persona-harness-workflow-ticket.test.ts`, `persona-harness-workflow-check.test.ts`, `persona-harness-plan-next-resume.test.ts`, `phase0-hooks.test.ts`, `phase0-rail-compliance.test.ts` |
| E2E/Smoke | 빌드 산출물, demo script, maintenance script, packaged CLI에 가까운 외부 표면을 검증한다. | `maintenance-scripts.test.ts`, `persona-harness-bearshell.test.ts`, `scripts/verify-*.mjs` 계열 npm scripts |

## Transition Coverage

| Transition | 현재 커버 | 대표 테스트 | Gap / 다음 보강 |
| --- | --- | --- | --- |
| capture -> draft | Covered | `persona-harness-prompt-workflow-transition.test.ts` | capture 결과가 draft로 자동 승격되는 의미는 아니다. capture와 draft가 같은 prompt-only requirements 저장소를 안전하게 다루는지만 보장한다. |
| draft -> approve | Covered | `persona-harness-workflow-ticket.test.ts` | draft artifacts 3종의 `Status: accepted` 전환은 확인한다. |
| approve -> split | Covered | `persona-harness-workflow-ticket.test.ts` | split source가 draft backlog일 때 task card와 backlog 생성까지 확인한다. |
| split -> next | Covered | `persona-harness-workflow-ticket.test.ts` | 첫 pending ticket 출력과 task card path 확인. |
| next -> implement guard | Covered | `persona-harness-workflow-check.test.ts` | accepted plan/profile/report artifact 조건을 중심으로 guard PASS/WARN을 확인한다. |
| report-filled -> check | Covered | `persona-harness-plan-report-status.test.ts`, `persona-harness-workflow-check.test.ts` | report status parser 단위테스트는 별도 보강 후보다. |
| check -> finish | Covered | `persona-harness-workflow-check.test.ts` | PASS/WARN 상태와 finish block/pass를 함께 확인한다. |
| pending ticket -> continue | Covered | `persona-harness-plan-next-resume.test.ts`, `phase0-continuation-hook.test.ts` | pending ticket이 있는 완료 주장에 continuation guidance가 붙는 hook-level coverage가 있다. |
| profile missing -> bootstrap/intake guidance | Covered | `persona-harness-workflow-check.test.ts` | implement guard가 bootstrap/intake guidance를 출력한다. |
| profile ready + wrong stack -> mismatch | Covered | `persona-harness-workflow-check.test.ts` | `STACK_MISMATCH`가 report/check/finish를 막는지 확인한다. |

## Prompt-Only Requirements Core Path

핵심 prompt-only transition은 다음 순서로 검증한다.

1. `ph workflow capture --stdin`으로 prompt requirements를 `.persona/workflow/requirements/latest.md`에 저장한다.
2. `ph workflow draft --stdin`으로 prompt-only product idea에서 draft backlog/questions/assumptions를 생성한다.
3. `ph workflow approve requirements`로 draft artifacts를 accepted 상태로 전환한다.
4. `ph workflow split .persona/workflow/requirements/backlog.md`로 implementation tickets를 만든다.
5. `ph workflow next`로 첫 pending ticket과 task card path를 출력한다.
6. workflow reports/evidence가 채워졌더라도 pending tickets가 남아 있으면 `ph workflow finish implement`가 block한다.

이 흐름은 production behavior를 바꾸지 않고 `runPersonaCli` integration surface에서 관찰한다.

## Code Quality Policy

Java backend code quality는 injection guidance와 report-only review로 다룬다.
Generated app quality를 AST/linter/enforcement gate로 강제하는 테스트나 analyzer는 추가하지 않는다.
Workflow는 gate/test로 강하게 검증하되, generated Java code quality는 사용자와 HQ가 해석할 수 있는 보고 표면으로 유지한다.

## Handoff Candidates

- `Docs Release`: 배포 문서와 package metadata 사이 version 표기가 어긋나면 release 문서/버전 정합성 작업으로 분리한다.
- `Runtime Hooks`: pending-ticket continuation guidance의 문구나 hook 정책 변경이 필요하면 QA Coverage에서 직접 수정하지 않는다.
- `CLI Workflow`: workflow command behavior 자체 변경이 필요하면 QA Coverage에서 테스트 실패 증거만 보고하고 구현은 넘긴다.
