---
id: backend.package-structure
source: backend-policy
domain: backend
topic: package-structure
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
---

# Package Structure Policy

- 패키지는 기능과 책임을 찾기 쉽게 구성한다.
- Spring Boot main application class는 root package에 하나만 두고, feature/domain package 아래에 추가 `*Application.java`를 만들지 않는다.
- root package 바로 아래에 `global`과 도메인 package를 같은 depth로 두고, `feature/features/module/modules` 같은 wrapper package를 추가하지 않는다.
- 도메인 package 내부는 presentation/application/domain/infrastructure와 presentation/application DTO 파일 경계를 드러낸다.
- 프로젝트가 커지면 `controller`, `service`, `repository` 같은 기술 계층 중심보다 도메인 기능 중심 구성을 우선 검토한다.
- `global`이나 `common`은 예외 처리, 설정, 공통 인프라처럼 실제로 여러 기능이 공유하는 것만 둔다.
- 테스트 패키지는 가능하면 production 패키지 구조를 따라가서 대상 코드를 찾기 쉽게 한다.
- 단순한 초기 단계에서는 과한 패키지 분리보다 역할이 드러나는 이름과 작은 책임을 우선한다.
