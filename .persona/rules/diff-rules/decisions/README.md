---
id: diff-rules.decisions.README
source: backend-policy
domain: backend
topic: decision-maintenance
roles:
  - main
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---
# Decisions

이 디렉토리는 프로젝트의 설계 결정과 고민 과정을 기록한다.

결정은 고정된 정답이 아니라,
현재 프로젝트 상황에서 선택한 기준으로 본다.

---

## 목적

- 왜 이 구조를 선택했는지 기록한다.
- 다시 같은 고민을 반복하지 않도록 한다.
- 결정 당시의 트레이드오프를 남긴다.
- 시간이 지나 코드와 맞지 않으면 다시 검토한다.

---

## 디렉토리 구조

    decisions/
    ├── accepted/
    ├── rejected/
    └── pending/

---

## accepted

현재 프로젝트에서 채택한 결정이다.

예시:

- [accepted/domain-first-package-structure.md](domain-first-package-structure.md)
- [accepted/service-orchestration-only.md](service-orchestration-only.md)
- [accepted/repository-interface-in-domain.md](repository-interface-in-domain.md)

---

## rejected

검토했지만 현재는 채택하지 않은 결정이다.

예시:

- [rejected/anemic-domain-model.md](anemic-domain-model.md)
- [rejected/common-util-package.md](common-util-package.md)
- [rejected/service-layer-business-logic.md](service-layer-business-logic.md)

---

## pending

아직 결론 내리지 않은 결정이다.

예시:

- [pending/domain-entity-separation.md](domain-entity-separation.md)
- [pending/security-auth-pattern.md](security-auth-pattern.md)
- [pending/event-driven-boundary.md](event-driven-boundary.md)

---

## 기록 기준

아래 상황이면 decision 문서를 추가한다.

- 같은 고민이 반복된다.
- 선택지가 2개 이상 존재한다.
- 트레이드오프가 명확하다.
- 나중에 다시 검토할 가능성이 높다.
- 코드 구조에 큰 영향을 준다.

---

## 문서 형식

각 decision 문서는 아래 구조를 따른다.

1. 상태
2. 문제 상황
3. 선택한 방향
4. 선택 이유
5. 트레이드오프
6. 현재 판단
7. 재검토 신호

---

## 상태 기준

### accepted

현재 프로젝트 기준으로 채택한 결정이다.

### rejected

현재 프로젝트 기준으로 채택하지 않은 결정이다.

### pending

아직 결론 내리지 않고 보류한 결정이다.

---

## 핵심 원칙

문서는 코드를 고정하기 위한 규칙이 아니다.

코드와 문서가 충돌하면:

1. 코드가 잘못된 것인지 확인한다.
2. 문서가 현재 코드와 맞지 않는지 확인한다.
3. 필요하면 문서를 수정한다.
4. 필요하면 구조를 수정한다.

결정은 경험을 통해 계속 갱신한다.

---

## 적용 강도

- accepted: 현재 작업에 기본 적용한다.
- rejected: 현재는 선택하지 않는 방향으로 본다.
- pending: 판단 보류 상태이며, 참고만 한다.
- pending 문서는 accepted decision과 충돌할 수 없으며, 충돌처럼 보이면 accepted를 우선한다.
