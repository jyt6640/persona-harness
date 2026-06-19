# Next Observation Candidate

## Context

Phase 1.2 current conclusion stays unchanged:

- actual generated run 기준 Controller direct Repository dependency `WARN` 반복은 확인되지 않았다.
- Candidate B prompt 보강은 보류한다.
- java-parser/AST 도입은 보류한다.
- 현재 observer는 문자열 기반, report-only, ignored output 원칙을 유지한다.

따라서 다음 별도 Phase 후보는 Phase 1.2 결론을 뒤집는 작업이 아니라, 같은 report-only 관찰 패턴을 적용할 다음 후보를 하나로 좁히는 작업이다.

## Candidate Comparison

| Candidate | 후보 | Phase 0/1 evidence와 연결 | 문자열 기반 충분성 | gate 오해 위험 | 1-2 loop 검증 | rule/prompt 개선 연결 | 기존 패턴 재사용 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | Service가 저장소 상태/id sequence를 직접 소유하는지 관찰 | 중간. H2/JdbcTemplate fixture의 storage boundary와 연결되지만 Service 내부 구현 판단이 넓다. | 중간. field 이름, `Map`, `AtomicLong`, `nextId` 등은 잡을 수 있으나 false positive가 높다. | 중간. Service 내부 설계를 품질 판정처럼 읽을 수 있다. | 중간. fixture가 다양하면 기준이 흔들린다. | 가능하지만 rule wording이 쉽게 강해진다. | 일부 재사용 가능. |
| B | Controller가 JdbcTemplate/SQL을 직접 다루는지 관찰 | 높음. #2-3 prompt의 Service-only, storage detail direct access 금지와 인접하다. | 높음. `JdbcTemplate`, `NamedParameterJdbcTemplate`, SQL literal, `.query`, `.update` evidence를 좁게 볼 수 있다. | 낮음-중간. Controller boundary 관찰로 한정하면 report-only 설명이 쉽다. | 높음. Controller 파일 하나와 ignored report로 검증 가능하다. | 높음. Controller prompt/rule의 storage detail 금지 문구로 이어질 수 있다. | 높음. Phase 1.2 Controller observer/report 문서 패턴을 재사용할 수 있다. |
| C | Test가 요구사항 status/body/list size를 고정하는지 관찰 | 높음. Phase 0 evidence의 API contract verification과 연결된다. | 중간. `status().isOk`, `jsonPath`, `hasSize` 등은 가능하지만 test framework variants가 많다. | 중간-높음. test quality gate로 오해될 수 있다. | 중간. fixture별 expected behavior가 필요하다. | 가능하지만 product-quality 판단처럼 번질 위험이 있다. | report format은 재사용 가능하나 target role이 다르다. |
| D | DTO가 저장소 구현 세부사항을 갖는지 관찰 | 낮음-중간. DTO boundary와 연결되지만 반복 evidence가 약하다. | 중간. `JdbcTemplate`, repository type, SQL string은 잡기 쉽지만 actual likelihood가 낮다. | 낮음. DTO boundary 관찰로 좁히면 된다. | 높음. DTO 파일 단위로 가능하다. | 중간. 실제 반복이 없으면 prompt 보강 근거가 약하다. | 일부 재사용 가능. |
| E | Repository clear/reset 같은 fixture-specific 관찰 | 중간. tests/fixture setup과 연결될 수 있다. | 높음. `clear`, `reset`, `deleteAll` 같은 string evidence는 쉽다. | 높음. fixture-specific cleanup을 product/test quality 판단으로 오해하기 쉽다. | 높음. 하지만 너무 fixture-specific이다. | 낮음. prompt 개선보다 fixture convention에 가깝다. | 낮음-중간. |

## Decision

선택: **B. Controller가 JdbcTemplate/SQL을 직접 다루는지 관찰**.

다음 별도 Phase 후보는 Controller direct storage access observation이다. 이름은 아직 구현명으로 고정하지 않고, 최소 설계 loop에서 다시 좁힌다.

## Why

- 기존 Phase 1.2의 Controller boundary 관찰과 가장 인접하다.
- Phase 0/1 #2-3 evidence의 Service-only, storage detail separation 문구와 직접 연결된다.
- `JdbcTemplate`, `NamedParameterJdbcTemplate`, `DataSource`, SQL literal, `.query`, `.update` 같은 evidence가 문자열 기반으로 비교적 좁다.
- report-only로 유지하기 쉽고, build/test failure나 enforcement gate로 연결할 필요가 없다.
- WARN이 반복될 경우 Controller rule/prompt의 "Repository/JdbcTemplate/SQL 직접 접근 금지" 후보로 이어질 수 있다.
- actual run에서 WARN이 없더라도 "Controller boundary storage access 반복 없음"으로 해석 가능하다.

## Non-Goals

- enforcement gate 아님.
- build/test failure 연결 아님.
- product-quality 보증 아님.
- full Guard/AST/linter 아님.
- 새 dependency 없음.
- observer logic 확장 아님.
- java-parser/AST 재도입 아님.
- profile-aware backend/frontend/infra 확장 아님.
- OMO workflow/skill 각색 아님.

## Minimal Detection Shape

다음 설계 loop에서 고정할 최소 문자열 기반 관찰 후보:

- Java/Spring backend fixture의 `*Controller.java`만 대상으로 한다.
- Controller import에 `JdbcTemplate`, `NamedParameterJdbcTemplate`, `DataSource`, `java.sql.*`가 있으면 `WARN` 후보로 본다.
- Controller field 또는 constructor parameter에 `JdbcTemplate`, `NamedParameterJdbcTemplate`, `DataSource` 타입이 있으면 `WARN` 후보로 본다.
- Controller method body에서 `jdbcTemplate.query`, `jdbcTemplate.update`, `namedParameterJdbcTemplate.query`, `namedParameterJdbcTemplate.update` 같은 direct call이 있으면 `WARN` 후보로 본다.
- Controller method body에 SQL keyword literal `SELECT`, `INSERT`, `UPDATE`, `DELETE`가 있으면 storage detail direct access evidence 후보로 본다.
- Service dependency만 있고 SQL/JdbcTemplate/DataSource evidence가 없으면 `PASS` 후보로 본다.
- target이 Controller가 아니거나 Controller class를 확인할 수 없으면 `UNKNOWN` 후보로 본다.

주의:

- SQL keyword가 API field name, enum, comment, string-only fixture label로만 등장하는 case는 과장하지 않아야 한다.
- 문자열 기반 observer 한계는 report limitation에 남긴다.
- SQL literal detection은 false positive 위험이 있으므로 import/field/constructor/method-call evidence보다 낮은 confidence로 다룬다.

## Report Format

기존 Phase 1.2 report format을 재사용한다.

필수 section:

- `Target`: run id와 file path.
- `Finding`: `PASS` / `WARN` / `UNKNOWN`.
- `Evidence`: import, field, constructor parameter, method call, SQL literal 후보.
- `Limitations`: 문자열 기반 한계와 false positive/false negative 가능성.
- `Decision`: quality gate가 아니며, build/test failure가 아니며, 다음 rule/prompt 개선 후보인지 여부.

Report output은 ignored path에만 남긴다.

## Observer Test Cleanup Note

다음 cleanup 후보:

- `tests/phase1-controller-repository-observer.test.ts`는 기능상 통과하지만 observer test가 커지는 방향이다.
- 다음 정리 loop에서 behavior cluster별로 나누는 방식을 검토한다.
- 후보 cluster:
  - `PASS` / `UNKNOWN`
  - `WARN import` / `field` / `constructor`
  - `WARN method call`과 comment/string non-WARN
  - 공통 fixture helper

이번 loop에서는 테스트 파일을 수정하지 않는다.

## Next Loop

추천 next loop:

```text
Controller JdbcTemplate/SQL direct access observation의 최소 설계를 문서화한다.
```

조건:

- 구현하지 않는다.
- 새 dependency를 추가하지 않는다.
- Phase 1.2 Controller direct Repository 결론을 바꾸지 않는다.
- report-only, ignored output, Java/Spring backend Controller 파일 범위로 제한한다.
