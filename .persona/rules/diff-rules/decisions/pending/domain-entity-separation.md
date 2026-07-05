---
id: diff-rules.decisions.pending.domain-entity-separation
source: backend-policy
domain: backend
topic: domain-entity-separation
roles:
  - implementer
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---
# Domain Entity Separation

## 상태

pending

---

## 문제 상황

Domain 객체와 영속화 Entity를 분리할지 결정이 필요하다.

선택지는 아래 두 가지다.

### 통합 구조

하나의 객체가:
- Domain 규칙
- 상태
- 영속화에 필요한 값

을 함께 가진다.

예시:

    class Order

---

### 분리 구조

Domain Model과 Persistence Entity를 분리한다.

예시:

    Order
    OrderEntity

---

## 현재 방향

현재는 통합 구조를 유지한다.

이 결정은 Domain과 Persistence Entity를 별도 클래스로 나눌지에 대한 보류다.
Domain이 JPA 어노테이션이나 저장 기술에 의존해도 된다는 뜻은 아니다.
현재 통합 구조는 기술 의존 없는 Domain 객체를 Repository 구현체가 저장 가능한 형태로 변환/복원하는 방식으로 해석한다.

즉:
- Domain 규칙
- 상태
- 영속화에 필요한 값

을 하나의 객체에서 관리한다.

---

## 선택 이유

### 구조 단순성

현재 프로젝트 규모에서는:
- 객체 수 증가
- 매핑 비용
- 변환 복잡도

보다 단순성이 더 중요하다.

---

### 과도한 추상화 방지

초기부터 Domain / Entity 분리를 도입하면:
- Mapper 증가
- 변환 코드 증가
- 흐름 복잡화

가 발생하기 쉽다.

---

### 현재 문제 크기와 균형

현재는:
- 복잡한 도메인 모델
- 다중 영속화 전략
- 복잡한 Aggregate

수준까지는 도달하지 않았다고 판단한다.

---

## 고민 지점

하지만 아래 장점도 존재한다.

### Domain 순수성 증가

Domain이:
- JPA
- ORM
- 영속화 기술

의 영향을 덜 받게 된다.

---

### 테스트 독립성 증가

순수 Domain 객체 기반 테스트가 쉬워질 수 있다.

---

### 영속화 전략 변경 유연성

Persistence Layer 변경 영향 감소 가능성이 있다.

---

## 현재 판단

현재 프로젝트는:

- 구조 단순성
- 구현 속도
- 유지 비용 균형

을 우선한다.

따라서 현재는 통합 구조를 유지하지만,
명확한 신호가 나타나면 분리를 다시 검토한다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- JPA 어노테이션 영향이 커진다.
- Domain 규칙보다 ORM 제약이 우선되기 시작한다.
- Entity가 지나치게 비대해진다.
- 복잡한 Aggregate 설계가 증가한다.
- 영속화 전략 변경 요구가 커진다.
