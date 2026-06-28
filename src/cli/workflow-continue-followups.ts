import type { VerificationFailureSummary } from "./verification-failure.js"
import type { WorkflowStatusSummary } from "./workflow-status.js"

type ContinueFollowUpSnapshot = {
  readonly implementationStatus: string
  readonly reviewStatus: string
  readonly workflowStatus: Pick<
    WorkflowStatusSummary,
    "commandDiscipline" | "commandDisciplineBlocking" | "reportCoverage" | "reportCoverageBlocking"
  >
  readonly verificationFailure: VerificationFailureSummary
}

function reviewFollowUpLines(snapshot: ContinueFollowUpSnapshot): readonly string[] {
  if (snapshot.implementationStatus !== "filled" || snapshot.reviewStatus === "filled") {
    return []
  }
  return [
    `Implementation report is filled but review report is ${snapshot.reviewStatus}.`,
    "Next action: fill .persona/workflow/review-report.md after review/manual QA, then run npx ph plan --report-filled review.",
    "Do not claim overall completion until review report is filled and finish passes.",
    "",
  ]
}

function verificationFailureFollowUpLines(snapshot: ContinueFollowUpSnapshot): readonly string[] {
  if (!snapshot.verificationFailure.verificationFailureBlocking) {
    return []
  }
  return [
    `Verification failed: ${snapshot.verificationFailure.verificationFailure}`,
    "Next action: fix the compile/test failure, rerun `./gradlew test` or Windows `gradlew.bat test`, then run `npx ph workflow check`.",
    "Do not claim overall completion while verification failed.",
    "",
  ]
}

function commandDisciplineFollowUpLines(snapshot: ContinueFollowUpSnapshot): readonly string[] {
  if (!snapshot.workflowStatus.commandDisciplineBlocking) {
    return []
  }
  return [
    "Final verification needs bearshell rerun.",
    `Command discipline: ${snapshot.workflowStatus.commandDiscipline}`,
    "Next action: rerun final verification through `npx ph bearshell` for test/build/bootRun, update implementation/review reports, then run `npx ph workflow check`.",
    "Do not claim overall completion until final verification is recorded through bearshell.",
    "",
  ]
}

function reportCoverageFollowUpLines(snapshot: ContinueFollowUpSnapshot): readonly string[] {
  if (!snapshot.workflowStatus.reportCoverageBlocking) {
    return []
  }
  return [
    "Reports say filled but required coverage is missing.",
    `Report coverage: ${snapshot.workflowStatus.reportCoverage}`,
    "Next action: read README/profile/generated Java role files, then update implementation/review reports with actual coverage/checklist evidence.",
    "Do not archive req tickets until review confirms requirements are satisfied.",
    "",
  ]
}

export function workflowContinueFollowUpLines(snapshot: ContinueFollowUpSnapshot): readonly string[] {
  return [
    ...verificationFailureFollowUpLines(snapshot),
    ...commandDisciplineFollowUpLines(snapshot),
    ...reportCoverageFollowUpLines(snapshot),
    ...reviewFollowUpLines(snapshot),
  ]
}
