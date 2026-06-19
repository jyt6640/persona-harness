# Phase 1.2 Next Observation Decision

## Context

Controller direct Repository dependency observation은 actual generated run에서 `PASS`였고, WARN 반복이 확인되지 않아 rule/prompt 보강을 보류했다.

Controller SQL Access observation도 single actual generated run에서 `PASS`, confidence `none`이었다. WARN/HIGH 또는 WARN/MEDIUM 반복 evidence가 없으므로 rule/prompt 보강은 보류했고, 다음 report-only 관찰 후보로 이동하기로 결정했다.

이번 loop는 다음 report-only observation 후보를 하나로 좁히는 decision만 한다. 새 기능, observer logic 확장, rule/prompt/code 보강은 하지 않는다.

## Candidates

### A. Service 저장소 상태/id sequence 직접 소유

관찰 후보:

- Service에 `Map`, `List`, `AtomicLong`, `nextId`, `idCounter`, `sequence` 같은 저장 상태 또는 id sequence 신호가 있는지 본다.
- 목적은 Service가 유스케이스 흐름을 넘어 저장소 책임을 갖는 drift를 report-only로 관찰하는 것이다.

장점:

- Phase 0/1 evidence의 Service boundary와 직접 연결된다.
- #2-3 scope는 `List<Reservation>`과 `AtomicLong` 제거, Service가 storage state를 소유하지 않는 책임선을 반복해서 기록한다.
- 문자열 기반으로 명확한 token 후보를 좁게 볼 수 있다.
- 반복되면 Service rule/prompt의 storage ownership 문구 개선 후보로 이어질 수 있다.

리스크:

- `List<ResponseDto>` 같은 정상 반환 타입까지 storage ownership으로 오해할 수 있다.
- `sequence.set(0L)` 같은 test setup 또는 repository reset 맥락을 Service drift로 오인할 수 있다.
- Service 내부 설계를 product-quality gate처럼 읽을 위험이 있다.

구현 난이도:

- 중간. token 자체는 쉽지만 field/constructor/local variable/return type 구분을 문자열 기반으로 조심해야 한다.

### B. DTO 저장소 구현 세부사항

관찰 후보:

- DTO에 `Map`, `List`, `Repository`, `AtomicLong`, mutable storage detail이 있는지 본다.
- 목적은 DTO가 API contract를 넘어 저장소 내부 구조를 노출하는 drift를 관찰하는 것이다.

장점:

- DTO boundary 관찰로 범위를 좁히면 product-quality gate 오해 위험이 비교적 낮다.
- `Repository`, `JdbcTemplate`, `AtomicLong` 같은 명확한 storage detail은 문자열 기반으로 포착하기 쉽다.
- DTO 파일 단위로 1-2 loop 안에서 설계와 smoke 검토가 가능하다.

리스크:

- `List`는 response DTO에서 정상적인 collection field일 수 있어 false positive 위험이 크다.
- 현재 Phase 0/1 evidence에서 DTO storage detail 반복 신호는 Service boundary보다 약하다.
- 실제 반복이 없으면 rule/prompt 개선 후보로 이어지는 힘이 낮다.

구현 난이도:

- 낮음-중간. 파일 역할은 좁지만 `List` 같은 정상 API shape와 storage detail을 분리해야 한다.

### C. Test contract drift

관찰 후보:

- 테스트가 200 OK, body, list size, `timeId`/time object 같은 요구사항 contract를 고정하는지 본다.
- 목적은 생성 테스트가 요구사항을 놓치고 구현을 따라가는 drift를 관찰하는 것이다.

장점:

- Phase 0 evidence의 API contract verification과 연결된다.
- 실제 product-like behavior보다 "test가 contract를 붙잡는가"라는 harness evidence로 해석할 수 있다.
- 반복되면 test prompt/rule의 contract assertion 문구 개선 후보가 될 수 있다.

리스크:

- 가장 product-quality gate처럼 오해되기 쉽다.
- `status().isOk`, `jsonPath`, `hasSize` 등은 framework variant와 assertion style에 영향을 많이 받는다.
- fixture별 요구사항 context가 필요해 문자열 기반 observer로 좁게 보기 어렵다.

구현 난이도:

- 중간-높음. target role은 Test로 좁힐 수 있지만, contract drift 판단은 requirement context와 assertion semantics가 필요하다.

## Comparison

| Candidate | Phase 0/1 evidence 연결 | 문자열 기반 충분성 | false positive 위험 | rule/prompt 개선 연결 | 1-2 loop 가능성 | gate 오해 위험 |
| --- | --- | --- | --- | --- | --- | --- |
| A. Service storage/id ownership | 높음. Service는 storage state/id sequence를 소유하지 않는다는 경계가 반복 기록됐다. | 중간-높음. `AtomicLong`, `idCounter`, `nextId`, field-level `Map/List`는 좁게 볼 수 있다. | 중간. 반환 타입/DTO list와 storage field를 구분해야 한다. | 높음. 반복되면 Service rule/prompt storage ownership 문구 후보가 된다. | 높음. 설계, smoke fixture, actual report review를 작은 loop로 나눌 수 있다. | 중간. Service 내부 품질 판정처럼 보이지 않게 report-only로 제한해야 한다. |
| B. DTO storage detail | 중간. DTO boundary와 연결되지만 반복 evidence는 약하다. | 중간. 명확한 storage type은 쉽지만 `List`는 애매하다. | 중간-높음. 정상 API collection과 storage detail이 섞일 수 있다. | 중간. 실제 반복이 없으면 보강 근거가 약하다. | 높음. DTO 파일 단위라 좁게 시작 가능하다. | 낮음-중간. DTO boundary로 좁히면 설명하기 쉽다. |
| C. Test contract drift | 중간-높음. API contract verification과 연결된다. | 낮음-중간. assertion style과 requirement context가 필요하다. | 높음. 정상 테스트 다양성을 drift로 볼 수 있다. | 중간. 반복되면 test rule 후보가 되지만 과장 위험이 크다. | 중간. 먼저 contract matrix가 필요할 수 있다. | 높음. product-quality/test-quality gate로 오해될 위험이 크다. |

## Decision

선택: **A. Service 저장소 상태/id sequence 직접 소유 관찰**

## Why

- Phase 0/1 문서에서 Service boundary, storage state, id sequence ownership이 반복적으로 등장했다.
- #2-3 fixture는 `List<Reservation>`과 `AtomicLong` 제거, H2/JdbcTemplate Repository ownership, Service use-case coordination을 명확히 요구한다.
- `AtomicLong`, `idCounter`, `nextId`, `sequence`, field-level `Map/List` 같은 문자열 evidence는 첫 report-only observer 후보로 비교적 좁게 설계할 수 있다.
- DTO 후보는 현재 반복 evidence가 약하고, Test contract drift는 product-quality gate로 오해될 위험이 더 높다.
- A도 false positive 위험은 있지만, 최소 설계 loop에서 field-level ownership과 local/return type을 구분하는 limitation을 명확히 적으면 1-2 loop 안에서 다룰 수 있다.

## Non-Goals

- enforcement gate 아님.
- product-quality 보증 아님.
- full Guard/AST/linter 아님.
- 새 dependency 없음.
- observer logic 확장 아님.
- rule/prompt/code 보강 아님.
- profile-aware backend/frontend/infra 확장 아님.
- OMO workflow/skill 각색 아님.

## Follow-Up

선택 후보의 최소 설계는 `docs/phases/phase-next/phase-next-service-storage-observer-design.md`에 문서화했다.

```text
Service Storage Ownership observer의 최소 구현과 단위 테스트를 추가한다.
```

다음 loop에서도 rule/prompt 보강, enforcement gate, build/test failure 연결, product-quality 보증으로 확장하지 않는다.
