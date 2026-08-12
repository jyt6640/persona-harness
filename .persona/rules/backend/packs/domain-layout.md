---
id: backend.pack.domain-layout
source: backend-policy
domain: backend
topic: domain-layout-pack
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "**/*.java"
  - "README.md"
  - "**/README.md"
  - "requirements.md"
  - "**/requirements.md"
  - "**/build.gradle"
  - "**/build.gradle.kts"
severity: should
enforcement: inject_only
---

# Explicit Domain Layout Pack

- 이 pack을 명시적으로 선택한 경우에만 root/global/domain과 presentation/application/domain/infrastructure 구조를 기본 제안으로 사용한다.
- 도메인 내부에 Controller/Service/Repository/DTO 역할을 드러내는 package와 request/response·command/result DTO 경계를 둘지 계획으로 명시한다.
- 기존 코드, README, project profile이 다른 구조를 요구하면 그 사실을 우선하고 구조 차이를 계획에 기록한다.
