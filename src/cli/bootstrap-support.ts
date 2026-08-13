import { rulePackContentHash } from "../rules/rule-delivery.js"
import { emptyRalphLoopState, readRalphLoopStateSnapshot, writeRalphLoopState } from "../runtime/ralph-loop-state.js"
import {
  reserveBootstrapWriteBoundary,
  type BootstrapWriteBoundary,
} from "../io/bootstrap-write-boundary.js"
import type { CliRunResult } from "./bearshell.js"
import {
  BOOTSTRAP_PERSONA_FILES,
  BOOTSTRAP_WORKFLOW_FILES,
  ROOT_AGENT_INSTRUCTIONS_PATH,
} from "./bootstrap-contract.js"
import { backendAgentInstructions } from "./agents-contract.js"
import {
  readWorkflowLoopStateSnapshot,
  WORKFLOW_LOOP_STATE_SCHEMA_VERSION,
  writeWorkflowLoopState,
} from "./workflow-loop-state.js"

const ROLE_CHECKLIST_RELAY_SECTION_TITLE = "## Persona Harness Role Checklist Relay Preview"
const LEGACY_MULTI_AGENT_RELAY_SECTION_TITLE = "## Persona Harness Multi-Agent Relay Preview"

function failStep(step: string, result: CliRunResult): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      `Persona Harness backend bootstrap failed during ${step}.`,
      "",
      result.stderr.trim().length > 0 ? result.stderr.trim() : result.stdout.trim(),
      "",
    ].join("\n"),
  }
}

export function runAndRecord(
  actions: string[],
  step: string,
  result: CliRunResult,
  successMessage: string,
): CliRunResult | undefined {
  if (result.status !== 0) return failStep(step, result)
  actions.push(successMessage)
  return undefined
}

function multiAgentRelayProcedureGuidance(): readonly string[] {
  return [
    ROLE_CHECKLIST_RELAY_SECTION_TITLE,
    "",
    "This section is present only when `ph bootstrap backend --multi-agent-preview` is used.",
    "`--multi-agent-preview` is the compatibility flag/config name for the Role Checklist Relay preview.",
    "Relay is a main-session role checklist rail through role lenses: `test-writer`, `implementer`, and `reviewer`.",
    "Hosts may expose subagent/task invocation, but Persona Harness does not guarantee or enforce host subagent invocation.",
    "",
    "At the start of each active ticket:",
    "- Run `npx ph workflow relay next --json` to identify the current role and required role artifact.",
    "- If the host exposes subagent/task invocation, use the matching OpenCode subagent: `test-writer`, `implementer`, or `reviewer`.",
    "- If subagent invocation is unavailable or not taken, complete the current role checklist in the main session.",
    "- In every role artifact, record whether subagent invocation was used or unavailable.",
    "- After the role artifact is complete, run `npx ph workflow closure next --json` to connect the next gate step.",
    "",
  ]
}

function bootstrapAgentInstructions(includeMultiAgentRelayGuidance: boolean): string {
  const lines = backendAgentInstructions().trimEnd().split("\n")
  lines.push("")
  if (includeMultiAgentRelayGuidance) lines.push(...multiAgentRelayProcedureGuidance())
  return lines.join("\n")
}

export function writeBackendAgentInstructions(
  bootstrapWriteBoundary: BootstrapWriteBoundary,
  skipped: string[],
  force: boolean,
  includeMultiAgentRelayGuidance: boolean,
): string | undefined {
  const currentBytes = bootstrapWriteBoundary.readProjectFile(ROOT_AGENT_INSTRUCTIONS_PATH)
  if (currentBytes !== undefined && !force) {
    if (includeMultiAgentRelayGuidance) {
      const current = currentBytes.toString("utf8")
      if (
        current.includes(ROLE_CHECKLIST_RELAY_SECTION_TITLE)
        || current.includes(LEGACY_MULTI_AGENT_RELAY_SECTION_TITLE)
      ) {
        skipped.push(`${ROOT_AGENT_INSTRUCTIONS_PATH} role checklist relay guidance already exists`)
        return undefined
      }
      bootstrapWriteBoundary.writeProjectFileAtomically(
        ROOT_AGENT_INSTRUCTIONS_PATH,
        `${current.trimEnd()}\n\n${multiAgentRelayProcedureGuidance().join("\n")}`,
      )
      return `updated ${ROOT_AGENT_INSTRUCTIONS_PATH} with role checklist relay procedure guidance`
    }
    skipped.push(`${ROOT_AGENT_INSTRUCTIONS_PATH} already exists`)
    return undefined
  }
  bootstrapWriteBoundary.writeProjectFileAtomically(
    ROOT_AGENT_INSTRUCTIONS_PATH,
    bootstrapAgentInstructions(includeMultiAgentRelayGuidance),
  )
  return `created ${ROOT_AGENT_INSTRUCTIONS_PATH} AI bootstrap instructions`
}

function lifecycleInitializationFailure(): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: "Persona Harness backend bootstrap failed during workflow lifecycle initialization. Review the existing workflow state before retrying.\n",
  }
}

export function initializeWorkflowLifecycleStates(projectDir: string, actions: string[]): CliRunResult | undefined {
  const workflowSnapshot = readWorkflowLoopStateSnapshot(projectDir)
  const ralphSnapshot = readRalphLoopStateSnapshot(projectDir)
  const now = new Date().toISOString()
  if (workflowSnapshot.integrity === "unsafe" || ralphSnapshot.integrity === "unsafe") {
    return lifecycleInitializationFailure()
  }

  try {
    if (workflowSnapshot.integrity === "absent") {
      writeWorkflowLoopState(
        projectDir,
        {
          finalDecision: "not-run",
          iterations: [],
          rulePackHash: rulePackContentHash(projectDir),
          schemaVersion: WORKFLOW_LOOP_STATE_SCHEMA_VERSION,
          startedAt: now,
        },
        workflowSnapshot.token,
      )
      actions.push("initialized empty workflow-loop state")
    }
    if (ralphSnapshot.integrity === "absent") {
      if (!writeRalphLoopState(projectDir, emptyRalphLoopState(now), ralphSnapshot.token)) {
        return lifecycleInitializationFailure()
      }
      actions.push("initialized empty ralph-loop state")
    }
  } catch {
    return lifecycleInitializationFailure()
  }
  return undefined
}

export function bootstrapWriteBoundaryFailure(): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: "Persona Harness backend bootstrap failed during bootstrap workspace intake. Review the existing bootstrap workspace before retrying.\n",
  }
}

export function reserveBootstrapWriteBoundaryFor(projectDir: string): BootstrapWriteBoundary | undefined {
  try {
    const boundary = reserveBootstrapWriteBoundary(projectDir)
    for (const path of BOOTSTRAP_PERSONA_FILES) boundary.assertSafePersonaFile(path)
    for (const name of BOOTSTRAP_WORKFLOW_FILES) boundary.assertSafeWorkflowFile(name)
    return boundary
  } catch {
    return undefined
  }
}
