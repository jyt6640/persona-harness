import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import { loadHarnessConfig, type MultiAgentRole } from "../config/harness-config.js"
import type { CliRunResult } from "./bearshell.js"
import { readWorkflowClosurePayload, type ClosureBlocker, type ClosureTicket } from "./workflow-closure.js"
import type {
  RelayAction,
  RelayBlockerId,
  RelayRoleArtifact,
  RelayRoleCompletionState,
  WorkflowRelayPayload,
} from "./workflow-relay-model.js"
import {
  RELAY_ROLE_ARTIFACT_KIND,
  relayPromptBlock,
  relayPromptLinesFor,
  relayUsage,
} from "./workflow-relay-ui.js"

const ROLE_BLOCKERS: Readonly<Record<MultiAgentRole, RelayBlockerId>> = {
  "test-writer": "role-test-artifact-missing",
  jaeki: "role-implementation-artifact-missing",
  roach: "role-review-artifact-missing",
}

function roleArtifactPath(ticketId: string, role: MultiAgentRole): string {
  return `.persona/workflow/work/${ticketId}/roles/${role}.md`
}

function parseRelayArgs(args: readonly string[]): RelayAction | "help" | undefined {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    return "help"
  }
  if ((args[0] === "status" || args[0] === "next") && args.length === 2 && args[1] === "--json") {
    return args[0]
  }
  return undefined
}

function closureCurrentTicket(projectDir: string): {
  readonly closureBlocker: ClosureBlocker | null
  readonly currentTicket: ClosureTicket | null
} {
  const closure = readWorkflowClosurePayload("next", projectDir)
  return {
    closureBlocker:
      closure.action === "next" && closure.nextStep?.blockerId !== undefined ? closure.state.blockers[0] ?? null : null,
    currentTicket: closure.state.currentTicket,
  }
}

function relayRoleArtifacts(projectDir: string, ticketId: string, roles: readonly MultiAgentRole[]): readonly RelayRoleArtifact[] {
  return roles.map((role) => {
    const path = roleArtifactPath(ticketId, role)
    return {
      path,
      role,
      status: existsSync(join(projectDir, path)) ? "present" : "missing",
    }
  })
}

function firstMissingRoleArtifact(artifacts: readonly RelayRoleArtifact[]): RelayRoleArtifact | undefined {
  return artifacts.find((artifact) => artifact.status === "missing")
}

function roleCompletionState(
  artifacts: readonly RelayRoleArtifact[],
  overall: RelayRoleCompletionState["overall"],
  currentRole: MultiAgentRole | null,
): RelayRoleCompletionState {
  return {
    completedRoles: artifacts.filter((artifact) => artifact.status === "present").map((artifact) => artifact.role),
    currentRole,
    missingRoles: artifacts.filter((artifact) => artifact.status === "missing").map((artifact) => artifact.role),
    nextRole: currentRole,
    overall,
  }
}

function scopedInputs(ticket: ClosureTicket, closureBlocker: ClosureBlocker | null): readonly string[] {
  const inputs = [
    ".persona/workflow/plan.md",
    ticket.path,
    ".persona/workflow/implementation-report.md",
    ".persona/workflow/review-report.md",
  ]
  if (closureBlocker?.source !== undefined && closureBlocker.source.startsWith(".")) {
    inputs.push(closureBlocker.source)
  }
  return Array.from(new Set(inputs))
}

function readWorkflowRelayPayload(action: RelayAction, projectDir: string): WorkflowRelayPayload {
  const config = loadHarnessConfig(projectDir)
  const roleOrder = config.multiAgent.roles
  const { closureBlocker, currentTicket } = closureCurrentTicket(projectDir)
  const gateCommand = "npx ph workflow relay next --json"
  if (!config.multiAgent.enabled) {
    return {
      action,
      blockers: [
        {
          id: "multi-agent-disabled",
          reason: "multiAgent.enabled is false; run `npx ph bootstrap backend --multi-agent-preview` to opt in.",
          source: ".persona/harness.jsonc",
        },
      ],
      closureBlocker,
      currentRole: null,
      currentTicket,
      enabled: false,
      gateCommand,
      nextRole: null,
      promptBlock: "",
      promptLines: [],
      requiredArtifact: null,
      requiredOutputArtifact: null,
      roleArtifacts: [],
      roleCompletionState: roleCompletionState([], "disabled", null),
      roleOrder,
      scopedInputFiles: currentTicket === null ? [] : scopedInputs(currentTicket, closureBlocker),
      scopedInputs: currentTicket === null ? [] : scopedInputs(currentTicket, closureBlocker),
    }
  }
  if (currentTicket === null) {
    return {
      action,
      blockers: [
        {
          id: "no-current-ticket",
          reason: "No current pending ticket is available for relay handoff.",
          source: closureBlocker?.source ?? ".persona/workflow/backlog.md",
        },
      ],
      closureBlocker,
      currentRole: null,
      currentTicket,
      enabled: true,
      gateCommand,
      nextRole: null,
      promptBlock: "",
      promptLines: [],
      requiredArtifact: null,
      requiredOutputArtifact: null,
      roleArtifacts: [],
      roleCompletionState: roleCompletionState([], "no-current-ticket", null),
      roleOrder,
      scopedInputFiles: [],
      scopedInputs: [],
    }
  }
  const roleArtifacts = relayRoleArtifacts(projectDir, currentTicket.id, roleOrder)
  const missingArtifact = firstMissingRoleArtifact(roleArtifacts)
  if (missingArtifact === undefined) {
    return {
      action,
      blockers: [],
      closureBlocker,
      currentRole: null,
      currentTicket,
      enabled: true,
      gateCommand: "npx ph workflow closure next --json",
      nextRole: null,
      promptBlock: relayPromptBlock([
        "Relay preview role artifacts are present.",
        "Run `npx ph workflow closure next --json` and continue through PH closure/check/finish gates.",
      ]),
      promptLines: [
        "Relay preview role artifacts are present.",
        "Run `npx ph workflow closure next --json` and continue through PH closure/check/finish gates.",
      ],
      requiredArtifact: null,
      requiredOutputArtifact: null,
      roleArtifacts,
      roleCompletionState: roleCompletionState(roleArtifacts, "complete", null),
      roleOrder,
      scopedInputFiles: scopedInputs(currentTicket, closureBlocker),
      scopedInputs: scopedInputs(currentTicket, closureBlocker),
    }
  }
  const promptLines = relayPromptLinesFor(missingArtifact.role, currentTicket, missingArtifact.path)
  const scopedInputFiles = scopedInputs(currentTicket, closureBlocker)
  return {
    action,
    blockers: [
      {
        id: ROLE_BLOCKERS[missingArtifact.role],
        reason: `${missingArtifact.role} ${RELAY_ROLE_ARTIFACT_KIND[missingArtifact.role]} is missing for ${currentTicket.id}.`,
        source: missingArtifact.path,
      },
    ],
    closureBlocker,
    currentRole: missingArtifact.role,
    currentTicket,
    enabled: true,
    gateCommand,
    nextRole: missingArtifact.role,
    promptBlock: relayPromptBlock(promptLines),
    promptLines,
    requiredArtifact: missingArtifact.path,
    requiredOutputArtifact: missingArtifact.path,
    roleArtifacts,
    roleCompletionState: roleCompletionState(roleArtifacts, "blocked", missingArtifact.role),
    roleOrder,
    scopedInputFiles,
    scopedInputs: scopedInputFiles,
  }
}

export function runWorkflowRelayCommand(
  args: readonly string[],
  options: { readonly projectDir?: string } = {},
  invocationName = "ph",
): CliRunResult {
  const parsed = parseRelayArgs(args)
  if (parsed === "help") {
    return { status: 0, stdout: `${relayUsage(invocationName)}\n`, stderr: "" }
  }
  if (parsed === undefined) {
    return { status: 1, stdout: "", stderr: `workflow relay requires status --json or next --json.\n\n${relayUsage(invocationName)}\n` }
  }
  const projectDir = resolve(options.projectDir ?? process.cwd())
  return {
    status: 0,
    stdout: `${JSON.stringify(readWorkflowRelayPayload(parsed, projectDir), null, 2)}\n`,
    stderr: "",
  }
}
