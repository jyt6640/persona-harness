# Phase 1.2 Observer Design

## Goal

Controller가 Repository를 직접 의존하는지 관찰하는 최소 observer를 설계한다.

Phase 1.2의 목표는 generated Java/Spring fixture에서 한 가지 경계만 report-only로 관찰하는 것이다. 이 설계는 Phase 0 MVP 종료 판단이나 좁은 Phase 1.1 종료 판단을 바꾸지 않는다.

## Decision

문자열 기반 관찰로 시작한다.

AST 기반 관찰은 이번 단계에서 선택하지 않는다.

## Why

| 기준 | 문자열 기반 관찰 | AST 기반 관찰 |
| --- | --- | --- |
| 구현 난이도 | 낮다. `*Controller.java` 파일을 읽고 import, field, constructor parameter, method call 패턴을 관찰하면 된다. | 높다. Java parser 선택, dependency 추가, parser failure 처리, AST node 해석 규칙이 필요하다. |
| false positive/false negative 가능성 | 주석/문자열/복잡한 formatting에서 false positive가 가능하다. 단, 주석/문자열을 먼저 제거하고 Repository 타입 후보를 추적하면 이번 fixture에서는 완화 가능하다. | 더 낮지만 parser 설정과 fixture 코드 스타일에 의존한다. Lombok, annotation, incomplete file에서 UNKNOWN 처리가 늘 수 있다. |
| Java/Spring fixture에 충분한지 | 충분하다. 대상이 Controller 파일, Repository import, field, constructor parameter, method body 직접 호출로 좁다. | 충분하지만 과하다. 이번 관찰 대상보다 도구 결정 비용이 크다. |
| 1-2 loop 안에 검증 가능한지 | 가능하다. fixture 문자열 입력과 report output을 단위 테스트로 고정할 수 있다. | 불확실하다. parser dependency와 실패 케이스를 함께 고정해야 해서 loop가 커진다. |
| Phase 1.2 report-only 목표와 맞는지 | 잘 맞는다. 관찰 결과를 WARN/PASS/UNKNOWN으로만 남기고 빌드나 테스트 실패와 연결하지 않기 쉽다. | report-only로 쓸 수는 있지만 full Guard/AST/linter로 오해될 가능성이 크다. |

냉정한 선택 이유:

- 이번 Phase 1.2는 enforcement gate가 아니라 ignored output에 남기는 observer다.
- 관찰 대상은 Java/Spring backend fixture의 Controller direct Repository dependency 하나다.
- 문자열 기반 관찰은 1-2 loop 안에서 테스트 기준까지 고정하기 쉽다.
- AST 기반 관찰은 precision은 좋지만 지금 선택하면 broad AST framework로 번질 위험이 있다.
- 문자열 기반으로 시작하되, 판단 불가한 파일은 UNKNOWN으로 남기고 품질 보증처럼 설명하지 않는다.

## Scope

- Java/Spring backend fixture
- Controller 파일
- Repository import
- Repository field
- Repository constructor parameter
- Controller method body에서 repository 직접 호출

## Non-Goals

- enforcement gate 아님
- build/test failure 아님
- full Guard/AST/linter 아님
- product-quality 보증 아님
- profile-aware 확장 아님
- OMO workflow/skill 각색 아님
- backend/frontend/infra 확장 아님
- Controller direct Repository dependency 외 규칙 관찰 아님

## Detection Rules

최소 관찰 규칙:

- `*Controller.java`가 아니거나 Controller class로 보기 어려우면 UNKNOWN.
- Controller 파일에서 `Repository` 타입 import가 있으면 WARN.
- Controller class field에 `Repository` 타입이 있으면 WARN.
- Controller constructor parameter에 `Repository` 타입이 있으면 WARN.
- Controller method body에서 repository 변수의 method call이 있으면 WARN.
- Controller가 Service만 의존하면 PASS 후보.
- `Repository`라는 단어가 주석이나 문자열에만 있으면 가능하면 WARN으로 과장하지 않음.
- 관찰 규칙이 서로 충돌하거나 Java 파일이 부분적으로 깨져 있으면 UNKNOWN.

문자열 기반 구현 후보:

- Java block/line comment와 string literal을 제거한 normalized text를 관찰 대상으로 삼는다.
- import rule은 `import ...Repository;` 또는 `import ...RepositoryName;` 형태를 Repository import evidence로 기록한다.
- field rule은 class body에서 `private final ReservationRepository reservationRepository;` 같은 타입-변수 선언을 찾는다.
- constructor parameter rule은 Controller 이름과 같은 constructor signature 안에서 `ReservationRepository reservationRepository` 같은 parameter를 찾는다.
- method call rule은 field/constructor parameter에서 수집한 repository 변수명에 대해 `reservationRepository.` 호출을 찾는다.
- Service 타입 또는 `service.` 호출만 보이면 직접 Repository 의존으로 보지 않는다.

## Report Format

ignored output에만 report를 남긴다.

```md
# Phase 1.2 Observer Report

## Target

- run: {run-id-or-timestamp}
- file: {observed-controller-file}

## Finding

PASS / WARN / UNKNOWN

## Evidence

- import: {matched import or none}
- field: {matched field or none}
- constructor parameter: {matched parameter or none}
- method call: {matched direct repository call or none}

## Limitations

- 문자열 기반 관찰이다.
- 주석/문자열 제거 후에도 formatting, nested class, incomplete Java source에서 false positive/false negative가 가능하다.
- 이 결과는 generated Spring product-quality 보증이 아니다.

## Decision

- quality gate: no
- build/test failure: no
- next rule/prompt improvement candidate: yes/no
```

## Test Criteria

다음 구현 loop 전에 고정할 필수 테스트 기준:

- Controller가 Service만 의존하면 PASS.
- Controller가 Repository를 import하면 WARN.
- Controller field가 Repository 타입이면 WARN.
- Controller constructor parameter가 Repository 타입이면 WARN.
- Controller method body에서 repository를 직접 호출하면 WARN.
- `Repository`라는 단어가 주석이나 문자열에만 있으면 가능하면 WARN으로 과장하지 않음.
- 판단 불가 파일은 UNKNOWN.
- WARN은 report finding으로만 남기고 test/build failure로 연결하지 않음.

## Output Location

report는 ignored experiment/fixture output에만 남긴다.

후보:

- `experiments/phase0-runs/{timestamp}/observer-report.md`
- `.persona/evidence/phase1-2/observer-report.md`

선택 기준:

- fixture run과 함께 해석해야 하면 `experiments/phase0-runs/{timestamp}/observer-report.md`를 우선한다.
- hook/runtime evidence와 함께 모을 필요가 있으면 `.persona/evidence/phase1-2/observer-report.md`를 후보로 둔다.
- 두 위치 모두 `.gitignore` 대상이어야 하며, observer report를 tracked docs에 자동 기록하지 않는다.

## Next Implementation Loop

다음 loop에서 구현할 최소 파일/테스트:

- `src/phase1/observer/controller-repository-observer.ts` 또는 기존 phase 구조에 맞는 최소 observer module.
- `tests/phase1/controller-repository-observer.test.ts` 또는 기존 test naming에 맞춘 단위 테스트.
- ignored Java/Spring fixture 문자열 샘플은 test fixture로만 사용하고 `.persona-test-fixtures/`는 Git에 추적하지 않는다.
- report writer는 ignored output path로만 쓰며, WARN/PASS/UNKNOWN을 빌드나 테스트 실패로 연결하지 않는다.

다음 loop의 종료 기준:

- 위 Test Criteria가 단위 테스트로 고정된다.
- observer는 report-only로 동작한다.
- generated app 품질 보증, enforcement gate, full AST/linter 확장으로 설명하지 않는다.
