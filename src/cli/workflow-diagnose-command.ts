import type { CliRunResult } from "./bearshell.js"
import {
  readWorkflowDiagnosis,
  type WorkflowDiagnosis,
} from "./workflow-diagnostics.js"

function nextAction(diagnosis: WorkflowDiagnosis): string {
  switch (diagnosis.workspaceIntake) {
    case "absent":
      return "Run this command from the intended project directory."
    case "clean-uninitialized":
      return "Initialize the clean workspace with the displayed command."
    case "owned-ready":
      return "Inspect the active workflow artifacts; this diagnostic does not grant Finish authority."
    case "foreign-stale-unsafe":
      return "Preserve existing state; manual ownership review is required before repair."
    case "invalid":
      return "Preserve the ownership manifest; a deliberate recovery decision is required."
  }
}

export function formatWorkflowDiagnosis(diagnosis: WorkflowDiagnosis): string {
  return [
    "Persona Harness Workflow Diagnose",
    "",
    `Workspace intake: ${diagnosis.workspaceIntake}`,
    `Active plan: ${diagnosis.activePlan}`,
    `Implementation report: ${diagnosis.implementationReport}`,
    `Review report: ${diagnosis.reviewReport}`,
    `Workflow history archives: ${diagnosis.workflowHistoryArchives}`,
    `Active workflow lifecycle: ${diagnosis.activeWorkflowLifecycle}`,
    `Finish authority: ${diagnosis.finishAuthority}`,
    `Source-read prerequisite: ${diagnosis.sourceReadPrerequisite}`,
    `Next action: ${nextAction(diagnosis)}`,
    ...(diagnosis.nextCommand === undefined
      ? []
      : ["", `Next command: ${diagnosis.nextCommand}`]),
    "",
    "Scope:",
    "- Read-only: no bootstrap, repair, history archive, or workflow state was written.",
    "- Historical reports and archives remain diagnostic-only; they do not grant Finish authority.",
    "",
  ].join("\n")
}

export function runWorkflowDiagnoseCommand(
  options: { readonly projectDir?: string } = {},
): CliRunResult {
  return {
    status: 0,
    stdout: formatWorkflowDiagnosis(readWorkflowDiagnosis(options.projectDir)),
    stderr: "",
  }
}
