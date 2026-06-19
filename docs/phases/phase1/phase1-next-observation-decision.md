# Phase 1 Next Observation Decision

## Context

Service Storage Ownership observer는 두 actual generated run에 적용했다.

- `experiments/phase0-runs/2026-06-18T02-10-18-110Z`: `ReservationService.java`, `PASS`, confidence `none`.
- `experiments/phase0-runs/2026-06-18T01-02-20-056Z`: `ReservationService.java`, `PASS`, confidence `none`.

두 report 모두 storage field, id sequence field, constructor parameter, mutation call, literal-only evidence가 없었다. 이 결과는 Service storage ownership WARN이 반복되지 않았다는 report-only 관찰이지 product-quality 보증이 아니다.

## Service Storage Decision

Service Storage Ownership rule/prompt 보강은 보류한다.

근거:

- 두 actual generated run에서 `PASS/none`이 반복됐다.
- `WARN/HIGH` 또는 `WARN/MEDIUM` 반복 evidence가 없다.
- 현재 evidence만으로 `Service는 Map/List/AtomicLong/nextId/idCounter 같은 저장소 상태나 id sequence를 직접 소유하지 않는다` 문구를 rule/prompt에 추가할 근거가 부족하다.
- 문자열 기반 observer의 false positive/false negative 한계와 small sample 한계는 유지한다.

## Candidates

### A. DTO 저장소 구현 세부사항

관찰 후보:

- DTO에 `Map`, `List`, `Repository`, `AtomicLong`, mutable storage detail이 있는지 본다.

장점:

- DTO 파일 단위로 좁게 시작할 수 있다.
- `Repository`, `JdbcTemplate`, `AtomicLong` 같은 명확한 storage detail token은 문자열 기반으로 관찰 가능하다.

리스크:

- DTO field의 `List`는 합법적인 response shape일 수 있다.
- 정상 API collection을 storage detail로 오인할 false positive 위험이 높다.
- 현재 Phase 0/1 evidence에서 반복 약점으로 드러난 정도가 약하다.

구현 난이도:

- 낮음-중간. 명확한 storage token은 쉽지만, `List`는 반드시 낮은 confidence 또는 제외 기준이 필요하다.

### B. Test contract drift

관찰 후보:

- 테스트가 요구사항 anchor를 붙잡는지 본다.
- 예: 200 OK status, response body assertion, list size, `timeId`, time object 같은 API contract 관련 assertion presence.

장점:

- Phase 0에서 실제로 "테스트가 구현을 따라가고 요구사항을 놓치는 drift"가 반복된 축과 직접 연결된다.
- 반복 evidence가 나오면 test rule/prompt의 contract assertion 문구 개선 후보로 이어질 수 있다.
- Test 파일과 assertion keyword presence로 report-only 관찰을 작게 시작할 수 있다.

리스크:

- 문자열 기반으로 "충분히 검증한다"를 판단하기 어렵다.
- test framework와 assertion style variation 때문에 false negative가 가능하다.
- product-quality gate나 test-quality gate로 오해될 위험이 가장 크다.

구현 난이도:

- 중간. 구현 전 설계 loop에서 "contract sufficiency 판정"이 아니라 "requirements anchor presence observation"으로 좁혀야 한다.

### C. Repository SQL responsibility

관찰 후보:

- Repository/DAO가 SQL/JdbcTemplate을 담당하는지, Controller/Service가 아닌 곳에 있는지 본다.

장점:

- Controller Repository/SQL observer와 역할 분리 관찰 흐름이 이어진다.
- `Repository`, `JdbcTemplate`, SQL literal, `query/update` 같은 문자열 evidence를 좁게 잡을 수 있다.

리스크:

- 이미 Controller SQL observer와 일부 겹친다.
- Repository가 SQL을 갖는 것은 정상일 수 있어, 관찰 목표를 "SQL이 있어야 한다"로 읽으면 product design 판단으로 번질 수 있다.
- rule/prompt 개선 후보로 이어지는 힘은 Controller/Service drift보다 약하다.

구현 난이도:

- 중간. Repository target으로 제한하면 가능하지만, 정상 책임과 drift를 구분하는 report wording이 필요하다.

## Comparison

| Candidate | Phase 0/1 evidence 연결 | 문자열 기반 충분성 | false positive 위험 | rule/prompt 개선 연결 | product-quality gate 오해 위험 | 1-2 loop 가능성 |
| --- | --- | --- | --- | --- | --- | --- |
| A. DTO storage detail | 중간. DTO boundary와 연결되지만 반복 evidence는 약하다. | 중간. 명확한 storage token은 쉽지만 `List`가 애매하다. | 중간-높음. 정상 response list를 오인할 수 있다. | 중간. 반복이 없으면 보강 근거가 약하다. | 낮음-중간. DTO boundary로 좁히면 설명은 쉽다. | 높음. DTO 파일 단위로 작게 가능하다. |
| B. Test contract drift | 높음. Phase 0에서 반복된 drift 축과 직접 연결된다. | 중간. assertion anchor token은 볼 수 있지만 충분성 판단은 피해야 한다. | 중간-높음. assertion style variation이 크다. | 높음. 반복되면 test rule/prompt contract anchor 후보가 된다. | 높음. 반드시 report-only anchor presence로 제한해야 한다. | 중간. 먼저 최소 설계 문서화가 필요하다. |
| C. Repository SQL responsibility | 중간. 역할 분리 흐름과 이어진다. | 중간-높음. SQL/JdbcTemplate token은 좁게 볼 수 있다. | 중간. 정상 Repository responsibility를 drift처럼 읽을 수 있다. | 중간. Controller SQL observer와 겹친다. | 중간. Repository design 판단으로 번질 수 있다. | 중간-높음. 기존 SQL observer 패턴 일부 재사용 가능하다. |

## Decision

선택: **B. Test contract drift 관찰**

## Why

- Phase 0에서 실제로 반복된 약점과 가장 직접 연결된다.
- Service Storage observer는 두 actual generated run에서 `PASS/none`이 반복되어 보강 보류가 타당하다.
- DTO 후보는 `List` false positive 위험이 크고 반복 evidence가 약하다.
- Repository SQL responsibility 후보는 기존 Controller SQL observer와 일부 겹친다.
- Test contract drift는 위험이 크지만, 구현 전 설계를 "요구사항 anchor presence observation"으로 좁히면 report-only 후보로 가치가 있다.

다음 설계 loop에서는 다음을 명확히 해야 한다.

- 테스트가 충분한지 판정하지 않는다.
- product-quality 보증으로 설명하지 않는다.
- requirement-specific anchor token presence만 report한다.
- WARN wording도 build/test failure가 아니라 다음 rule/prompt 검토 후보로만 둔다.

## Non-Goals

- enforcement gate 아님.
- product-quality 보증 아님.
- test-quality certification 아님.
- build/test failure 연결 아님.
- full Guard/AST/linter 아님.
- 새 dependency 없음.
- observer logic 확장 아님.
- rule/prompt/code 보강 아님.
- profile-aware backend/frontend/infra 확장 아님.
- OMO workflow/skill 각색 아님.

## Next Loop

선택 후보의 최소 설계를 문서화한다.

```text
Test contract drift observation을 "requirements anchor presence" report-only 관찰로 최소 설계한다.
대상, PASS/WARN/INFO/UNKNOWN 기준, evidence field, false positive/false negative limitation, ignored report 위치를 정한다.
```
