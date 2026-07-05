---
id: diff-rules.decisions.pending.aggregate-boundary
source: backend-policy
domain: backend
topic: aggregate-boundary
roles:
  - main
  - implementer
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---
# Aggregate Boundary

## 상태

pending

---

## 문제 상황

도메인 객체 간 경계를 어디까지 하나의 Aggregate로 볼지 결정이 필요하다.

특히 아래 상황에서 고민이 발생한다.

- 연관 객체를 어디까지 함께 수정할 것인가
- 하나의 트랜잭션으로 어디까지 묶을 것인가
- 객체 참조를 어디까지 허용할 것인가

---

## 현재 방향

현재는:
- 강한 일관성이 필요한 객체만 하나의 Aggregate로 묶는다.
- 가능한 작은 Aggregate를 유지한다.
- 다른 Aggregate는 ID 참조를 우선 고려한다.

---

## 현재 기준

### 같은 Aggregate로 보는 경우

- 항상 함께 변경된다.
- 강한 일관성이 필요하다.
- 하나의 규칙으로 묶인다.

---

### 분리하는 경우

- 독립 lifecycle을 가진다.
- 변경 시점이 다르다.
- 트랜잭션 경계가 다르다.

---

## 선택 이유

### Aggregate 비대화 방지

너무 큰 Aggregate는:

- 긴 트랜잭션
- 복잡한 연관관계
- 불필요한 로딩
- 변경 영향 증가

문제를 만들 수 있다.

---

### 도메인 경계 명확화

Aggregate는:
- 상태 변경 책임
- 일관성 경계
- 트랜잭션 경계

를 표현한다.

따라서:
- 항상 함께 변경되는가
- 같은 규칙을 공유하는가

를 기준으로 판단한다.

---

### ID 참조 우선

다른 Aggregate는 객체 참조보다
ID 참조를 우선 고려한다.

좋은 예시:

    order.getUserId()

지양하는 예시:

    order.getUser().getProfile().get...

---

## 고민 지점

아래 부분은 아직 명확히 결론 내리지 않았다.

### 조회 모델 최적화

읽기 성능을 위해:
- join
- projection
- query model

최적화가 필요해질 수 있다.

---

### Aggregate 크기 기준

현재 프로젝트 규모에서는:
- 어느 정도까지 묶는 것이 적절한지

명확한 경험 축적이 더 필요하다.

---

## 트레이드오프

### 너무 작은 Aggregate

- 객체 협력 증가
- 트랜잭션 분산
- 조회 복잡도 증가

가능성이 있다.

---

### 너무 큰 Aggregate

- 결합 증가
- 변경 영향 확대
- 성능 비용 증가

가능성이 있다.

---

## 현재 판단

현재 프로젝트는:

- 작은 Aggregate 유지
- 명확한 경계 분리
- 강한 일관성 최소화

를 우선한다.

다만 Aggregate 설계는
프로젝트 규모와 복잡도에 따라 계속 재검토한다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- 하나의 Aggregate가 지나치게 비대해진다.
- 트랜잭션 범위가 계속 커진다.
- 연관 객체 탐색 depth가 깊어진다.
- 변경 영향 범위 예측이 어려워진다.
- 조회 성능 최적화 비용이 증가한다.
