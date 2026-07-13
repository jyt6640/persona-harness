import type { ClosureBlocker } from "./workflow-closure.js"

export const TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID = "trusted-authority-required"

export type WorkflowFinishAuthority = {
  readonly blocker: ClosureBlocker
  readonly status: "blocked"
}

const AUTHORITY_REQUIRED_REASON = [
  "No trusted Persona Harness or external authority receipt is available.",
  "Unsigned project-local bearshell output, JUnit XML, TDD JSON, generatedBy markers, self-computed digests, arbitrary command/head/exit values, and stale attempt IDs are diagnostic only.",
  "P3-3/P3-4 must provide the trusted authority path before finish can pass.",
].join(" ")

export function readWorkflowFinishAuthority(_projectDir: string): WorkflowFinishAuthority {
  return {
    blocker: {
      id: TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID,
      reason: AUTHORITY_REQUIRED_REASON,
      source: ".persona/evidence (diagnostic only)",
    },
    status: "blocked",
  }
}
