---
id: diff-rules.decisions.pending.security-auth-pattern
source: backend-policy
domain: backend
topic: security-auth-pattern
roles:
  - main
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---
# Security Auth Pattern

## 상태

pending

---

## 문제 상황

인증과 권한 처리를 어떤 구조로 가져갈지 결정이 필요하다.

특히 아래 선택지가 존재한다.

- Interceptor 기반 인증
- ArgumentResolver 기반 인증
- Spring Security 기반 인증
- JWT 기반 인증
- OAuth 기반 인증
- Role 기반 권한 처리

---

## 현재 방향

현재는 프로젝트 요구사항에 맞는 단순한 인증/권한 구조를 사용한다.

복잡한 보안 구조는 명확한 요구사항이 생겼을 때 도입한다.

---

## 현재 보류 이유

인증/권한 영역은 프로젝트마다 요구사항 차이가 크다.

아래 요소에 따라 구조가 달라진다.

- 로그인 방식
- 세션 유지 방식
- 토큰 사용 여부
- 관리자/사용자 권한 구분
- 외부 OAuth 제공자 사용 여부
- API 보안 수준

따라서 현재 시점에서 고정 원칙으로 박지 않는다.

---

## 고려 가능한 방향

### Interceptor 기반

장점:
- 단순함
- 구현 비용 낮음
- 미션/작은 프로젝트에 적합

단점:
- 복잡한 권한 처리에 약함
- 인증/인가 흐름이 커지면 관리 어려움

---

### Spring Security 기반

장점:
- 인증/인가 표준 구조 제공
- 필터 체인 기반 확장 가능
- 실무 프로젝트에 적합

단점:
- 초기 학습 비용 있음
- 작은 프로젝트에서는 과할 수 있음
- 설정 복잡도 증가 가능

---

### JWT 기반

장점:
- Stateless 인증 가능
- 모바일/API 서버 구조에 적합
- 서버 확장에 유리

단점:
- 토큰 탈취 대응 필요
- refresh token 관리 필요
- 로그아웃/만료 처리 복잡

---

## 현재 판단

현재 프로젝트는:

- 단순성
- 요구사항 충족
- 과도한 선제 설계 방지

를 우선한다.

따라서 인증/권한 구조는 pending으로 두고,
프로젝트 요구사항이 명확해질 때 결정한다.

---

## 재검토 신호

아래 상황이면 구조를 다시 검토한다.

- 사용자 권한 종류가 증가한다.
- 관리자/사용자 권한 분리가 복잡해진다.
- JWT 또는 OAuth 요구사항이 생긴다.
- API 보안 요구사항이 강화된다.
- 인증 실패/권한 실패 응답 정책이 복잡해진다.
