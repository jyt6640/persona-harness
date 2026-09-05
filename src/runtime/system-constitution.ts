import type { HarnessConfig } from "../config/harness-config.js"
import type { TransformSystemOutput } from "./types.js"
import { PERSONA_COMPACT_EXECUTION_GUIDANCE } from "./skill-execution-guidance.js"

export const SYSTEM_CONSTITUTION_MARKER = "[Persona Harness System Constitution]"

export function createSystemConstitutionBlock(config: HarnessConfig): string {
  return [
    SYSTEM_CONSTITUTION_MARKER,
    "",
    "Scope: PH workflow guidance is project-local; it is not generated app quality certification.",
    "System prompt text is still prose and may be ignored; PH finish/archive gates remain the authoritative checks.",
    PERSONA_COMPACT_EXECUTION_GUIDANCE,
    "Interpret the latest message in the active task's context. Preserve the original goal and accepted decisions through status questions or corrections; follow explicit changes of scope and cancellation immediately.",
    "Read `.persona/project-profile.jsonc` when it exists. A small concrete change needs relevant code and focused verification. Require an accepted plan only when the selected project workflow requires it.",
    "For a materially ambiguous product request, ask one understandable discovery question. For clear implementation, debug, refactor, review, or Git work, follow that request without restarting a product interview.",
    "Finish guard: before claiming done, use the project's explicit Finish policy only after implementation and review evidence are complete.",
    "If the Finish policy blocks, do not claim done. Diagnose and fix the cause within the existing authorization, then perform the checks required by the changed evidence. A one-shot external observation must not be retried as a debugger.",
    "The host adapter does not run a workflow command, create workflow state, or advance a workflow automatically.",
    config.enforce.executeVerification
      ? "Strict verification is enabled: finish/closure may run the project verification command directly and use that result as authoritative."
      : "Direct execution verification is not enabled unless project config opts in; report prose remains non-authoritative for strict verification.",
    "Write-deny is a no-op in this runtime: the OpenCode `permission.ask` API does not expose proposed write content, so PH cannot block a write mid-flight based on its content. Enforcement is closure-time (finish gate + ast-grep conventions), not write-time.",
    config.enforce.idleContinuation
      ? "Idle continuation is enabled: PH may send a bounded follow-up prompt when closure blockers remain after session idle."
      : "Idle continuation is off by default.",
  ].join("\n")
}

export function injectSystemConstitution(output: TransformSystemOutput, config: HarnessConfig): boolean {
  if (!config.enabled || !config.enforce.systemConstitution) {
    return false
  }
  if (output.system.some((entry) => entry.includes(SYSTEM_CONSTITUTION_MARKER))) {
    return false
  }
  output.system.push(createSystemConstitutionBlock(config))
  return true
}
