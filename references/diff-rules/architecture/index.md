# Architecture

이 문서는 프로젝트의 아키텍처 세부 기준을 정리한다.

전체 방향은 루트의 ARCHITECTURE.md를 우선한다.

---

## 핵심 방향

- 레이어의 책임을 명확히 분리한다.
- 의존성은 안쪽 방향으로만 흐른다.
- 흐름과 비즈니스 판단을 분리한다.
- Domain은 기술 구현을 알지 못한다.
- 구조는 단순하게 유지하되, 규모에 따라 점진적으로 분리한다.

---

## Layered Architecture

레이어별 책임과 의존 방향을 정의한다.

- Presentation는 HTTP 입출력을 담당한다.
- Application은 유스케이스 흐름을 조율한다.
- Domain은 핵심 비즈니스 규칙을 가진다.
- Infrastructure는 기술 구현을 담당한다.

→ [layered-architecture.md](layered-architecture.md)

---

## Transactions

트랜잭션 경계와 rollback 기준을 정의한다.

- 트랜잭션 경계는 Service에 둔다.
- 읽기와 쓰기 트랜잭션을 구분한다.
- 검증 책임과 트랜잭션 책임을 분리한다.

→ [transactions.md](transactions.md)

---

## Repository Pattern

Repository 계층의 역할과 포트/어댑터 구조를 정의한다.

- Repository 인터페이스는 Domain에 둔다.
- 구현체는 Infrastructure에 둔다.
- Domain은 저장 기술을 알지 못한다.

→ [repository-pattern.md](repository-pattern.md)

---

## Domain Boundary

도메인 책임과 협력 기준을 정의한다.

- 객체는 자기 상태를 스스로 검증한다.
- Getter보다 행위를 우선한다.
- 저장소 조회 기반 검증은 Validator에 둔다.

→ [domain-boundary.md](domain-boundary.md)

---

## Package Structure

도메인 중심 패키지 구조 기준을 정의한다.

- 도메인 우선 패키지 구조를 사용한다.
- 레이어는 도메인 하위에서 분리한다.
- global은 횡단 관심사만 관리한다.

→ [package-structure.md](package-structure.md)

---

## 판단 기준

아키텍처 판단이 헷갈리면 아래 질문으로 판단한다.

- 책임이 자연스럽게 분리되어 있는가?
- 의존성이 안쪽 방향으로 흐르는가?
- 흐름과 판단이 섞여 있지 않은가?
- Domain이 기술 구현을 모르고 있는가?

하나라도 NO라면 구조를 다시 검토한다.
