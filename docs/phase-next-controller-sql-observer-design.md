# Controller SQL Access Observer Design

## Goal

Controller가 `JdbcTemplate` 또는 SQL을 직접 다루는지 report-only로 관찰한다.

이번 설계는 다음 별도 Phase 후보를 좁히기 위한 문서화다. 새 observer 구현, dependency 추가, AST/parser 도입, rule/prompt 보강은 하지 않는다.

## Scope

- Java/Spring backend fixture.
- Controller 파일만 대상.
- `JdbcTemplate`, `NamedParameterJdbcTemplate`, `DataSource`, `java.sql.*` import.
- `JdbcTemplate`, `NamedParameterJdbcTemplate`, `DataSource` field.
- `JdbcTemplate`, `NamedParameterJdbcTemplate`, `DataSource` constructor parameter.
- Controller method body의 `jdbcTemplate.query`, `jdbcTemplate.update`, `queryForObject`, `batchUpdate` 같은 direct call.
- SQL-like string literal은 낮은 confidence evidence로만 관찰.

## Non-Goals

- enforcement gate 아님.
- build/test failure 아님.
- product-quality 보증 아님.
- full Guard/AST/linter 아님.
- 새 dependency 없음.
- AST/parser 재도입 아님.
- profile-aware 확장 아님.
- OMO workflow/skill 각색 아님.
- Controller direct Repository dependency에 대한 Phase 1.2 결론 변경 아님.

## Detection Rules

최소 문자열 기반 관찰 규칙:

- `*Controller.java`가 아니거나 Controller class로 보기 어려우면 `UNKNOWN`.
- Controller가 `JdbcTemplate`, `NamedParameterJdbcTemplate`, `DataSource`, `java.sql.*`를 import하면 `WARN`, confidence `HIGH`.
- Controller field가 `JdbcTemplate`, `NamedParameterJdbcTemplate`, `DataSource` 타입이면 `WARN`, confidence `HIGH`.
- Controller constructor parameter가 `JdbcTemplate`, `NamedParameterJdbcTemplate`, `DataSource` 타입이면 `WARN`, confidence `HIGH`.
- Controller method body에서 typed or strongly named `jdbcTemplate.query`, `jdbcTemplate.update`, `jdbcTemplate.queryForObject`, `jdbcTemplate.batchUpdate`, `namedParameterJdbcTemplate.query`, `namedParameterJdbcTemplate.update`를 직접 호출하면 `WARN`, confidence `HIGH`.
- 타입 근거 없이 `jdbcTemplate` 또는 `namedParameterJdbcTemplate` 변수명 direct call만 보이면 `WARN`, confidence `MEDIUM`.
- Controller method body에 SQL-like string literal이 있으면 `WARN` 또는 `INFO`, confidence `LOW`.
- SQL-like text가 주석에만 있으면 `PASS` 또는 `UNKNOWN` 후보로 두고 `WARN`으로 과장하지 않는다.
- Controller가 Service만 호출하고 JdbcTemplate/DataSource/SQL-like evidence가 없으면 `PASS`.

SQL-like literal 후보:

- `"SELECT ... FROM ..."`
- `"INSERT INTO ..."`
- `"UPDATE ... SET ..."`
- `"DELETE FROM ..."`
- Java text block 안의 같은 SQL keyword sequence.

SQL-like literal 주의:

- SQL-like string은 API 설명, validation message, test fixture label, log message, enum-like text일 수 있다.
- 따라서 literal-only evidence는 `LOW` confidence로만 기록한다.
- literal-only finding은 다음 구현 설계에서 `WARN/LOW`와 `INFO/LOW` 중 하나로 다시 고정한다.
- `LOW` confidence는 rule/prompt 개선 후보로 바로 연결하지 않고 추가 evidence 후보로만 취급한다.

## Confidence Model

`HIGH`:

- import/type/member access가 명확하다.
- 예: `import org.springframework.jdbc.core.JdbcTemplate;`
- 예: `private final JdbcTemplate jdbcTemplate;`
- 예: `ReservationController(JdbcTemplate jdbcTemplate)`
- 예: `jdbcTemplate.update(...)` where the variable is field/constructor evidence로 연결된다.

`MEDIUM`:

- 변수명 또는 method call이 강하게 암시하지만 타입 근거가 없다.
- 예: `jdbcTemplate.query(...)`가 보이지만 import/field/constructor evidence가 없다.
- 예: `namedParameterJdbcTemplate.update(...)`가 보이지만 타입 evidence가 없다.
- `MEDIUM`은 추가 evidence를 요구하는 개선 후보로만 본다.

`LOW`:

- SQL-like literal 등 오탐 가능성이 크다.
- 예: `"SELECT * FROM reservations"`만 있고 JdbcTemplate/DataSource evidence가 없다.
- 예: Java text block에 SQL-like keyword가 있지만 호출 위치가 불명확하다.
- `LOW`는 false positive 가능성을 report limitation에 반드시 기록한다.

Finding과 confidence 관계:

- `PASS`: direct storage access evidence 없음.
- `WARN/HIGH`: import, field, constructor parameter, typed direct call evidence.
- `WARN/MEDIUM`: strong variable-name direct call evidence without type evidence.
- `WARN/LOW` 또는 `INFO/LOW`: SQL-like literal-only evidence. 다음 구현 설계에서 하나로 고정한다.
- `UNKNOWN`: Controller target 또는 source shape 판단 불가.

## Report Format

기존 Phase 1.2 observer report format을 재사용하되, `Confidence` field를 추가한다.

```md
# Controller SQL Access Observer Report

## Target

- run: {run-id-or-timestamp}
- file: {observed-controller-file}

## Finding

PASS / WARN / UNKNOWN

## Confidence

HIGH / MEDIUM / LOW

## Evidence

- import: {matched import or none}
- field: {matched field or none}
- constructor parameter: {matched parameter or none}
- method call: {matched direct JdbcTemplate/DataSource call or none}
- sql literal: {matched SQL-like literal or none}

## Limitations

- 문자열 기반 관찰이다.
- SQL-like literal은 false positive 가능성이 크다.
- 주석/문자열/formatting/nested class/incomplete Java source에서 false positive 또는 false negative가 가능하다.
- 이 결과는 product-quality 보증이 아니다.

## Decision

- quality gate: no
- build/test failure: no
- next rule/prompt improvement candidate: yes/no
```

Report output은 ignored path에만 남긴다.

후보:

- `experiments/phase0-runs/{timestamp}/controller-sql-observer-report.md`
- `.persona/evidence/phase-next/controller-sql-observer-report.md`

## Test Criteria

다음 구현 loop에서 먼저 고정할 테스트 기준:

- Controller가 Service만 의존하면 `PASS`.
- Controller가 `JdbcTemplate`을 import하면 `WARN/HIGH`.
- Controller field가 `JdbcTemplate` 타입이면 `WARN/HIGH`.
- Controller constructor parameter가 `JdbcTemplate` 타입이면 `WARN/HIGH`.
- Controller method에서 typed `jdbcTemplate.update` 또는 `jdbcTemplate.query`를 호출하면 `WARN/HIGH`.
- Controller method에서 타입 근거 없이 `jdbcTemplate.update` 또는 `jdbcTemplate.query`를 호출하면 `WARN/MEDIUM`.
- Controller에 SQL-like literal만 있으면 `WARN/LOW` 또는 `INFO/LOW`로 과장하지 않는다.
- SQL-like text가 주석에만 있으면 `PASS` 또는 `UNKNOWN`.
- Controller가 아닌 파일은 `UNKNOWN`.
- WARN은 report finding으로만 남기고 build/test failure로 연결하지 않는다.

## Next Loop

추천 next loop:

```text
Controller SQL Access observer의 최소 구현과 단위 테스트를 추가한다.
```

구현 loop 조건:

- 문자열 기반 observer만 사용한다.
- 새 dependency를 추가하지 않는다.
- report-only로 유지한다.
- ignored output에만 report를 쓴다.
- SQL-like literal-only finding을 `WARN/LOW`로 둘지 `INFO/LOW`로 둘지 먼저 고정한다.
