import type { WorkflowStatusSummary } from "./workflow-status.js"

export function stackAlignmentReason(summary: WorkflowStatusSummary): string | undefined {
  if (summary.stackAlignmentFinding !== "WARN") {
    return undefined
  }
  return [
    `Project profile and generated stack mismatch: ${summary.stackAlignment}`,
    "This is a workflow/profile alignment gate, not generated app product-quality certification.",
    "Required next actions:",
    "- Re-read `.persona/project-profile.jsonc`.",
    "- Change the generated project to Spring Boot/Gradle/JPA/database structure.",
    "- Remove fake `gradle-shim.js`/Node shim files.",
    "- Re-run `npx ph workflow check`.",
  ].join("\n")
}

export function javaRoleReadCoverageReason(summary: WorkflowStatusSummary): string | undefined {
  if (!summary.javaRoleReadCoverageBlocking) {
    return undefined
  }
  return [
    `Java role read coverage missing: ${summary.javaRoleReadCoverage}`,
    "This is workflow evidence/read coverage missing, not generated app product-quality certification.",
    "Required next actions:",
    "- Read generated Controller/Service/Repository/Domain/DTO files.",
    "- Run role read follow-up if needed.",
    "- Re-run `npx ph workflow check`.",
  ].join("\n")
}

export function verificationFailureReason(summary: WorkflowStatusSummary): string | undefined {
  if (!summary.verificationFailureBlocking) {
    return undefined
  }
  return [
    `Verification failed: ${summary.verificationFailure}`,
    "This is workflow verification failure evidence, not generated app product-quality certification.",
    "Do not claim overall completion while verification failed.",
    "Required next actions:",
    "- Fix the compile/test failure.",
    "- Re-run `./gradlew test` or Windows `gradlew.bat test` through `npx ph bearshell`.",
    "- Re-run `npx ph workflow check`.",
  ].join("\n")
}
