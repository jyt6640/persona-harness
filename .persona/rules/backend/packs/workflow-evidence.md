---
id: backend.pack.workflow-evidence
source: backend-policy
domain: backend
topic: workflow-evidence-pack
roles:
  - main
  - test-writer
  - implementer
  - reviewer
globs:
  - "README.md"
  - "**/README.md"
  - "requirements.md"
  - "**/requirements.md"
  - "**/*Test.java"
severity: should
enforcement: inject_only
---

# Explicit Workflow Evidence Pack

- report/evidence/finish 산출물은 public workflow boundary가 실제로 바뀌는 작업에서만 선택한다.
- 단순 Java/Spring product implementation이나 guidance-only 변경에 workflow report, evidence, finish 절차를 자동으로 추가하지 않는다.
- workflow boundary를 바꾸는 경우에만 기존 workflow contract와 승인·fail-closed gate를 먼저 읽고 필요한 보고 범위를 계획한다.
