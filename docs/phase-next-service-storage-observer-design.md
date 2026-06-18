# Service Storage Ownership Observer Design

## Goal

Service가 저장소 상태나 id sequence를 직접 소유하는지 report-only로 관찰한다.

이번 설계는 `docs/phase1-2-next-observation-decision.md`에서 선택한 다음 후보의 최소 설계다. 새 observer 구현, rule/prompt 보강, enforcement gate, build/test failure 연결은 하지 않는다.

## Scope

- Java/Spring backend fixture.
- `*Service.java` 파일만 대상.
- Service class의 field declaration.
- Service constructor parameter.
- Service method body의 명확한 id sequence mutation 또는 storage mutation 후보.
- 문자열 기반 관찰만 사용한다.

관찰 후보:

- 저장 상태 타입: `Map`, `HashMap`, `ConcurrentHashMap`, `List`, `ArrayList`, `Set`, `HashSet`.
- id sequence 타입: `AtomicLong`, `AtomicInteger`.
- id sequence 이름: `nextId`, `idCounter`, `sequence`, `reservationSequence`, `timeSequence`.
- 저장 상태 이름: `reservations`, `times`, `storage`, `store`, `repositoryData`.
- 직접 mutation call: `put`, `remove`, `clear`, `add`, `set`, `incrementAndGet`, `getAndIncrement`.

## Non-Goals

- enforcement gate 아님.
- product-quality 보증 아님.
- generated Spring app 품질 판정 아님.
- full Guard/AST/linter 아님.
- java-parser/AST 재도입 아님.
- 새 dependency 없음.
- rule/prompt/code 보강 아님.
- Test/Repository/DTO 파일 관찰 아님.
- 정상 `List<ResponseDto>` 반환 타입이나 DTO collection response를 drift로 단정하지 않음.

## Detection Rules

최소 문자열 기반 관찰 규칙:

- `*Service.java`가 아니면 `UNKNOWN`.
- Service class 또는 record declaration을 확인할 수 없으면 `UNKNOWN`.
- Service field가 `Map`, `HashMap`, `ConcurrentHashMap`, `AtomicLong`, `AtomicInteger` 타입이면 `WARN/HIGH`.
- Service field가 `List`, `ArrayList`, `Set`, `HashSet` 타입이고 변수명이 저장 상태 후보이면 `WARN/MEDIUM`.
- Service constructor parameter가 저장 상태 타입 또는 id sequence 타입이면 `WARN/MEDIUM`.
- Service method body에서 Service-owned field로 확인된 변수에 `put`, `remove`, `clear`, `incrementAndGet`, `getAndIncrement`를 호출하면 `WARN/HIGH` 또는 `WARN/MEDIUM`.
- 타입 근거 없이 `nextId`, `idCounter`, `sequence` 변수에 id sequence mutation call이 보이면 `WARN/MEDIUM`.
- Service가 Repository를 호출하고 저장 상태/id sequence evidence가 없으면 `PASS`.
- `List<ResponseDto>`, `List<ReservationResponse>`, `List<TimeResponse>` 같은 반환 타입만 있으면 `PASS`.
- `List` local variable이 Repository 결과나 DTO mapping 결과로만 보이면 `PASS` 또는 `INFO/LOW` 후보로 두고 `WARN`으로 과장하지 않는다.
- 주석에만 storage/id sequence keyword가 있으면 `PASS`.
- 문자열 literal에만 storage/id sequence keyword가 있으면 `INFO/LOW` 또는 `PASS/UNKNOWN`으로 낮게 처리하고 `WARN`으로 과장하지 않는다.

## Confidence Model

`HIGH`:

- Service field type이 명확한 저장 상태 또는 id sequence 타입이다.
- Service-owned field의 mutation call이 보인다.
- 예: `private final Map<Long, Reservation> reservations = new HashMap<>();`
- 예: `private final AtomicLong nextId = new AtomicLong(1);`
- 예: `reservations.put(id, reservation);`

`MEDIUM`:

- 타입 또는 이름이 강하게 암시하지만 storage ownership 확정에는 부족하다.
- 예: `private final List<Reservation> reservations;`
- 예: `idCounter.incrementAndGet();` without field/type evidence.
- 예: constructor parameter `Map<Long, Reservation> reservations`.

`LOW`:

- 이름 또는 local variable만으로 의심되는 경우.
- 예: `List<ReservationResponse> responses = ...`
- 예: `List<Reservation> reservations = repository.findAll();`
- `LOW`는 기본적으로 report limitation에만 남기고 rule/prompt 보강 후보로 쓰지 않는다.

Finding과 confidence 관계:

- `PASS`: Service storage/id sequence ownership evidence 없음.
- `WARN/HIGH`: field-level storage/id sequence ownership 또는 confirmed field mutation evidence.
- `WARN/MEDIUM`: strong name/type evidence without full ownership confirmation.
- `INFO/LOW`: local/return-type ambiguity처럼 false positive 위험이 큰 약한 evidence.
- `UNKNOWN`: Service target 또는 source shape 판단 불가.

## Evidence Fields

Report evidence field:

- `storage field`: Service-owned storage field declaration.
- `sequence field`: Service-owned id sequence field declaration.
- `constructor parameter`: storage/id sequence constructor parameter.
- `mutation call`: Service-owned storage/id sequence mutation call.
- `literal-only`: literal evidence that is intentionally low confidence.

Evidence에는 source code 전체나 diff를 저장하지 않는다. matched snippet만 최소로 남긴다.

## False Positive Limitations

다음 케이스는 반드시 limitation에 기록한다.

- 정상 반환 타입 `List<ResponseDto>` 또는 `List<ReservationResponse>`를 storage ownership으로 오인할 수 있다.
- Repository 결과를 DTO로 mapping하기 위한 local `List`를 storage state로 오인할 수 있다.
- Test setup이나 Repository reset 맥락의 `sequence`/`clear`를 Service drift로 오인할 수 있다.
- 문자열 literal-only evidence는 diagnostic label, log message, 문서화 문자열을 storage ownership으로 과장할 수 있다.
- 문자열 기반 관찰이므로 nested class, unusual formatting, generics wrapping, incomplete Java source에서 false positive/false negative가 가능하다.
- 이 report는 product-quality 보증이 아니라 다음 rule/prompt 개선 후보를 고르기 위한 ignored observation이다.

## Report Format

```md
# Service Storage Ownership Observer Report

## Target

- run: {run-id-or-timestamp}
- file: {observed-service-file}

## Finding

PASS / INFO / WARN / UNKNOWN

## Confidence

HIGH / MEDIUM / LOW / none

## Evidence

- storage field: {matched field or none}
- sequence field: {matched field or none}
- constructor parameter: {matched parameter or none}
- mutation call: {matched mutation or none}
- literal-only: {matched literal or none}

## Limitations

- 문자열 기반 관찰이다.
- 정상 DTO list return/local mapping을 storage ownership으로 오인할 수 있다.
- test/repository reset 맥락의 sequence keyword를 Service drift로 오인할 수 있다.
- 이 결과는 product-quality 보증이 아니다.

## Decision

- quality gate: no
- build/test failure: no
- next generated run candidate: yes/no
```

Report output은 ignored path에만 남긴다.

후보:

- `experiments/phase0-runs/{timestamp}/service-storage-observer-report.md`
- `.persona/evidence/phase-next/service-storage-observer-report.md`

## Test Criteria

다음 구현 loop에서 먼저 고정할 테스트 기준:

- Service가 Repository만 의존하고 storage/id sequence field가 없으면 `PASS`.
- Service field가 `Map` 또는 `HashMap`이면 `WARN/HIGH`.
- Service field가 `AtomicLong nextId`이면 `WARN/HIGH`.
- Service-owned field에 `put`, `remove`, `clear`, `incrementAndGet`, `getAndIncrement`를 호출하면 `WARN/HIGH`.
- Constructor parameter가 `Map` 또는 `AtomicLong`이면 `WARN/MEDIUM`.
- 타입 근거 없이 `idCounter.incrementAndGet()`만 보이면 `WARN/MEDIUM`.
- `List<ResponseDto>` 반환 타입만 있으면 `PASS`.
- Repository 결과를 local `List`로 받아 DTO mapping만 하면 `PASS` 또는 `INFO/LOW`.
- 주석에만 `nextId`, `sequence`, `Map`이 있으면 `PASS`.
- 문자열 literal에만 `nextId`, `sequence`, `Map`이 있으면 `INFO/LOW` 또는 `PASS/UNKNOWN`으로 낮게 처리한다.
- Service가 아닌 파일은 `UNKNOWN`.
- WARN은 report finding으로만 남기고 build/test failure로 연결하지 않는다.

## Next Loop

추천 next loop:

```text
Service Storage Ownership observer의 최소 구현과 단위 테스트를 추가한다.
```

조건:

- 문자열 기반 observer만 사용한다.
- 새 dependency를 추가하지 않는다.
- report-only로 유지한다.
- ignored output에만 report를 쓴다.
- 정상 DTO collection return/local mapping을 WARN으로 과장하지 않는다.
