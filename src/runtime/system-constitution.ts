import type { HarnessConfig } from "../config/harness-config.js"
import type { TransformSystemOutput } from "./types.js"

export const SYSTEM_CONSTITUTION_MARKER = "[Persona Harness System Constitution]"

export function createSystemConstitutionBlock(config: HarnessConfig): string {
  return [
    SYSTEM_CONSTITUTION_MARKER,
    "",
    "Scope: PH workflow guidance is project-local and prerelease; it is not generated app quality certification.",
    "System prompt text is still prose and may be ignored; PH finish/archive gates remain the authoritative checks.",
    "Turn-local intent reset: classify the current user message first. Do not continue implementation mode only because a previous turn was implementation.",
    "Context-completion gate: implement only when the current message asks for implementation, the scope is concrete, the accepted plan is present, and `.persona/project-profile.jsonc` has been read when it exists.",
    "If the request is still an idea, requirement draft, approval, review, refactor, debug, or git task, use the matching PH rail before implementation.",
    "Finish guard: before claiming done, fill `.persona/workflow/implementation-report.md` and `.persona/workflow/review-report.md`, then run `npx ph workflow finish implement`.",
    "If `npx ph workflow finish implement` fails, do not claim done. Report the blocker and continue with `npx ph workflow continue` or the first blocker from `npx ph workflow closure next --json`.",
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
