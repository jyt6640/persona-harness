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
- Spring Boot main application class의 위치와 추가 application class 여부는 기존 프로젝트와 요구사항을 확인한다.
- root/global/domain depth, wrapper package, 별도 DTO 디렉터리, 테스트 패키지 미러링은 project profile과 규모에 맞춰 선택한다.
- 프로젝트가 커지면 기술 계층과 도메인 기능 중심 구성의 trade-off를 검토하되 특정 구조를 보편적인 정답으로 만들지 않는다.
- `global`이나 `common`은 실제로 여러 기능이 공유하는 경우에만 둔다.
- 단순한 초기 단계에서는 과한 패키지 분리보다 역할이 드러나는 이름과 작은 책임을 우선한다.
