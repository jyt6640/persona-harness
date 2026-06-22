export function createPlanOnlyPrompt(): string {
  return [
    "README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.md를 읽고 구현하지 말고 architecture/technology plan만 완성해줘.",
    "",
    "node_modules, .opencode, .persona/rules, .persona/evidence 경로는 읽지 마. package/vendor/setup 문서를 계획 컨텍스트로 읽지 마.",
    ".persona/rules를 직접 열어 규칙 원문을 읽지 마. 필요한 규칙은 Persona Harness injection summary와 accepted plan에 이미 요약된다.",
    "",
    "긴 README.md나 plan은 한 번에 다 읽었다고 가정하지 말고, Read 출력이 잘리면 `npx ph bearshell --shell 'sed -n \"1,220p\" README.md'`, `npx ph bearshell --shell 'sed -n \"221,440p\" README.md'`처럼 범위를 나눠 끝까지 읽어줘.",
    "",
    "계획에는 요구사항 요약, Java/Spring Gradle 기술 선택, package/layer 구조, storage/persistence 선택, repository boundary, DTO boundary, domain behavior 기준을 포함해줘.",
    "",
    "계획이 불확실하면 구현하지 말고 질문이나 가정을 .persona/workflow/plan.md에 명확히 남겨줘.",
    "",
    "만약 사용자가 '플랜 보고 구현해줘', '계획대로 해줘', 'README 보고 구현해줘', '이제 구현해줘'처럼 짧은 구현 지시를 하면 바로 구현하지 말고 `npx ph workflow guard implement`와 `npx ph plan --implement`를 먼저 실행해줘.",
    "",
    "명령 실행이 필요하면 `npx ph bearshell`을 우선 사용하고, Persona Harness CLI는 글로벌 `ph`가 아니라 `npx ph`로 실행해줘.",
  ].join("\n")
}

export function createImplementationPrompt(): string {
  return [
    "구현을 시작하기 전에 `npx ph workflow guard implement`와 `npx ph plan --implement`를 먼저 실행하고, README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.md를 읽은 뒤 accepted plan 기준으로 구현해줘.",
    "",
    "node_modules, .opencode, .persona/rules, .persona/evidence 경로는 읽지 마. package/vendor/setup 문서를 구현 컨텍스트로 읽지 마.",
    ".persona/rules를 직접 열어 규칙 원문을 읽지 마. 필요한 규칙은 Persona Harness injection summary와 accepted plan에 이미 요약된다.",
    "",
    "긴 README.md나 plan은 한 번에 다 읽었다고 가정하지 말고, Read 출력이 잘리면 `npx ph bearshell --shell 'sed -n \"1,220p\" README.md'`, `npx ph bearshell --shell 'sed -n \"221,440p\" README.md'`처럼 범위를 나눠 끝까지 읽어줘.",
    "구현 보고서의 Read Coverage에는 체크만 하지 말고 `README read method`, `README ranges read`, `Plan read method`, `Plan ranges read`, `Unread ranges`를 실제 실행 증거 기준으로 적어줘.",
    "",
    "구현 중에는 Java/Spring Gradle backend Clean Code 범위를 유지하고, plan에 없는 frontend/infra/desktop 범위로 확장하지 마.",
    "실행 가능한 Spring Boot 앱이면 `bootJar`를 비활성화하지 마. `gradle build` 출력에 `:bootJar SKIPPED`가 나오면 build 통과로 기록하지 말고, Spring Boot plugin / Gradle wrapper / JDK toolchain 호환성을 맞춰 다시 검증해줘.",
    "",
    "구현 후 .persona/workflow/implementation-report.md를 채우고 `npx ph plan --report-filled implementation`을 실행해줘.",
    "",
    "중간에 멈추면 .persona/workflow/implementation-report.md의 Continuation에 마지막 완료 범위, 남은 README/plan 범위, 남은 구현 범위, 다음 작업을 남기고 완료했다고 말하지 마.",
    "",
    "최종 답변 전에 리뷰와 manual QA 결과를 .persona/workflow/review-report.md에 채우고 `npx ph plan --report-filled review`를 실행한 뒤 `npx ph workflow guard final`을 실행해줘. 이 단계가 남아 있거나 guard가 실패하면 완료했다고 말하지 마.",
    "",
    "명령 실행이 필요하면 `npx ph bearshell`을 우선 사용하고, Persona Harness CLI는 글로벌 `ph`가 아니라 `npx ph`로 실행해줘.",
  ].join("\n")
}
