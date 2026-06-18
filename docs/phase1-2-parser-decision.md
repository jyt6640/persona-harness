# Phase 1.2 Parser Decision

## Goal

java-parser/AST 기반 분석 도입 여부를 판단한다.

이번 loop는 의존성/범위 판단 문서화만 한다. 새 기능, AST 기반 observer, enforcement gate, build/test failure 연결, product-quality 보증은 추가하지 않는다.

## Current Observer Scope

현재 Phase 1.2 observer는 Controller direct Repository dependency 관찰 하나로 제한한다.

현재 문자열 기반 observer의 관찰 대상:

- Java/Spring backend fixture
- `*Controller.java` 파일
- Controller class 또는 record
- Repository import
- Repository field
- Repository constructor parameter
- Controller method body에서 repository 변수 직접 호출

현재 finding:

- `PASS`: recognizable Controller이고 Repository direct dependency evidence가 없음.
- `WARN`: import, field, constructor parameter, method call evidence 중 하나 이상이 있음.
- `UNKNOWN`: Controller target이 아니거나 Controller class를 확인할 수 없음.

현재 report boundary:

- report-only.
- ignored output only.
- quality gate 아님.
- build/test failure 아님.
- product-quality 보증 아님.

## What Transitive Audit Surface Means

이 문서에서 **transitive audit surface**는 외부 parser dependency와 그 하위 dependency가 만드는 검토/유지보수/보안/라이선스 부담을 뜻한다.

예를 들어 parser dependency 하나를 추가해도 실제 검토 대상은 그 package 자체만이 아니다.

- parser package의 release cadence와 maintenance 상태
- parser가 끌고 오는 하위 dependency
- 하위 dependency의 audit finding
- license compatibility 확인
- module format과 TypeScript type compatibility
- parser failure behavior와 partial-source behavior
- security update 또는 downgrade가 observation code에 미치는 영향

이 부담은 report-only prototype에만 제한해도 사라지지 않는다. 특히 Phase 1.2처럼 관찰 대상이 하나뿐이면, dependency가 줄이는 false positive/false negative보다 audit surface가 더 크게 느껴질 수 있다.

## Options

### A. 문자열 기반 observer 유지

현재 observer를 유지하고, Phase 1.2에서는 java-parser/AST 기반 분석을 도입하지 않는다.

장점:

- 현재 목표가 Controller direct Repository dependency 하나라 충분히 작다.
- 기존 테스트가 PASS/WARN/UNKNOWN, import/field/constructor parameter/method call evidence를 이미 고정한다.
- 주석/문자열-only `Repository`를 WARN으로 과장하지 않는 기준도 이미 있다.
- 새 parser traversal, node ownership, parser failure handling, audit surface를 Phase 1.2에 들이지 않는다.

비용:

- unusual Java formatting, nested class, incomplete source에서 false positive/false negative 가능성이 남는다.
- 여러 Java 구조 관찰로 확장하면 문자열 방식의 유지 비용이 커질 수 있다.

### B. java-parser/AST 기반 report-only prototype 도입

`java-parser` 또는 다른 Java parser로 structured parser-backed observation을 만든다.

장점:

- import, field, constructor parameter, method call을 syntax shape로 구분할 수 있다.
- 일부 false positive/false negative를 줄일 수 있다.
- parser failure를 `UNKNOWN` limitation으로 기록할 수 있다.

비용:

- `java-parser`는 true AST가 아니라 CST 기반이다.
- visitor traversal과 node shape 이해가 필요하다.
- compile/import spike에서 `java-parser` transitive audit surface가 확인됐다.
- report-only로 제한해도 dependency maintenance와 audit review가 생긴다.
- Phase 1.2의 좁은 목표에 비해 scope가 커진다.

### C. 직접 가벼운 parser-like heuristic 확장

외부 parser 없이 문자열 observer에 더 많은 parsing-like heuristic을 추가한다.

장점:

- 새 dependency 없이 precision을 조금 높일 수 있다.
- current code path를 유지한다.

비용:

- 직접 parser를 흉내 내기 시작하면 hidden linter/framework가 될 위험이 있다.
- heuristic이 늘수록 false confidence가 커진다.
- 현재 Phase 1.2 목표에는 과하다.

## Decision

선택: **A. 문자열 기반 observer 유지**.

Phase 1.2 observer에는 java-parser/AST 기반 분석을 도입하지 않는다.

이미 수행한 `java-parser` compile/import spike는 "도입 가능성 확인"으로만 취급한다. 그것이 Phase 1.2 observer에 parser-backed analysis를 도입한다는 결정은 아니다.

## Package State

Dependency hygiene decision:

- `java-parser`는 runtime code 또는 Phase 1.2 observer code에서 사용하지 않는다.
- `java-parser` 사용처는 compile/import spike test뿐이었다.
- AST/java-parser 도입을 보류하기로 결정했으므로 spike test와 `java-parser` dev dependency를 제거한다.
- `package.json`과 `package-lock.json`에는 `java-parser` 또는 새 Java AST parser dependency를 남기지 않는다.
- 이 제거는 observer 동작을 바꾸지 않는다.

## Why

- 현재 관찰 목표는 Controller direct Repository dependency 하나뿐이다.
- 문자열 기반 observer는 현재 목표의 evidence를 충분히 구분한다.
- actual generated run에서는 Repository direct dependency WARN 반복이 확인되지 않았다.
- AST parser는 precision을 높일 수 있지만, 지금은 줄일 error보다 추가 범위와 dependency review가 더 크다.
- `java-parser`는 CST 기반이라 "AST 도입"으로 설명하면 과장된다.
- `java-parser` compile/import spike에서 transitive audit surface가 확인됐다.
- report-only prototype에만 제한해도 parser dependency 유지보수와 audit 부담은 남는다.
- Phase 1.2는 build/test failure나 enforcement로 이어지는 단계가 아니다.

## Revisit Conditions

나중에 다음 조건 중 하나가 반복되면 parser-backed observation을 다시 검토한다.

- 문자열 기반 observer false positive가 actual generated run 또는 fixture에서 반복된다.
- 문자열 기반 observer false negative가 actual generated run 또는 fixture에서 반복된다.
- 관찰 대상이 Controller direct Repository dependency 하나를 넘어 여러 Java 구조로 확장된다.
- import, field, constructor parameter, method call 구분을 문자열로 유지하기 어려워진다.
- nested class, record, annotation, Lombok, multiline constructor, wildcard import 같은 Java syntax case가 핵심 evidence가 된다.
- `UNKNOWN`이 많아져 report가 rule/prompt 개선 후보를 식별하지 못한다.
- report-only observation이 아니라 enforcement에 가까운 판단이 필요해진다.
- parser dependency의 transitive audit surface를 수용할 명확한 이유가 생긴다.

## Non-Goals

- enforcement gate 아님.
- build/test failure 연결 아님.
- product-quality 보증 아님.
- full Guard/AST/linter 아님.
- 새 dependency 추가 아님.
- 기존 Phase 1.2 문자열 observer 동작 변경 아님.
- profile-aware backend/frontend/infra 확장 아님.
- OMO workflow/skill 각색 아님.

## Next Loop

추천 다음 loop:

```text
Phase 1.2 parser-backed observer 도입과 spike dependency hygiene은 닫고,
다음 Phase 후보를 actual generated run 추가 관찰 또는 다른 report-only observation 후보 중 하나로 좁힌다.
```

대안 다음 loop:

```text
다른 actual generated run 1회를 추가 관찰해 문자열 observer의 false positive/false negative 반복 여부를 확인한다.
```
