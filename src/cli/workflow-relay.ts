import { resolve } from "node:path"
import process from "node:process"

import { loadHarnessConfig, type MultiAgentRole } from "../config/harness-config.js"
import type { CliRunResult } from "./bearshell.js"
import { readWorkflowClosurePayload, type ClosureBlocker, type ClosureTicket } from "./workflow-closure.js"
import { readRelayRoleArtifact } from "./workflow-relay-artifacts.js"
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
  relayValidateText,
  relayUsage,
} from "./workflow-relay-ui.js"

const ROLE_MISSING_BLOCKERS: Readonly<Record<MultiAgentRole, RelayBlockerId>> = {
  "test-writer": "role-test-artifact-missing",
  implementer: "role-implementation-artifact-missing",
  reviewer: "role-review-artifact-missing",
}

const ROLE_INCOMPLETE_BLOCKERS: Readonly<Record<MultiAgentRole, RelayBlockerId>> = {
  "test-writer": "role-test-artifact-incomplete",
  implementer: "role-implementation-artifact-incomplete",
  reviewer: "role-review-artifact-incomplete",
}

function parseRelayArgs(args: readonly string[]): RelayAction | "help" | "validate-text" | undefined {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    return "help"
  }
  if (
    (args[0] === "status" || args[0] === "next" || args[0] === "validate") &&
    args.length === 2 &&
    args[1] === "--json"
  ) {
    return args[0]
  }
  if (args[0] === "validate" && args.length === 1) {
    return "validate-text"
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
  return roles.map((role) => readRelayRoleArtifact(projectDir, ticketId, role))
}

function firstBlockedRoleArtifact(artifacts: readonly RelayRoleArtifact[]): RelayRoleArtifact | undefined {
  return artifacts.find((artifact) => artifact.readiness !== "complete")
}

function roleCompletionState(
  artifacts: readonly RelayRoleArtifact[],
  overall: RelayRoleCompletionState["overall"],
  currentRole: MultiAgentRole | null,
): RelayRoleCompletionState {
  return {
    completedRoles: artifacts.filter((artifact) => artifact.readiness === "complete").map((artifact) => artifact.role),
    currentRole,
    incompleteRoles: artifacts.filter((artifact) => artifact.readiness === "incomplete").map((artifact) => artifact.role),
    missingRoles: artifacts.filter((artifact) => artifact.status === "missing").map((artifact) => artifact.role),
    nextRole: currentRole,
    overall,
  }
}

function roleArtifactBlockerId(artifact: RelayRoleArtifact): RelayBlockerId {
  return artifact.readiness === "missing" ? ROLE_MISSING_BLOCKERS[artifact.role] : ROLE_INCOMPLETE_BLOCKERS[artifact.role]
}

function roleArtifactBlockerReason(artifact: RelayRoleArtifact, ticketId: string): string {
  if (artifact.readiness === "missing") {
    return `${artifact.role} ${RELAY_ROLE_ARTIFACT_KIND[artifact.role]} is missing for ${ticketId}.`
  }
  return `${artifact.role} ${RELAY_ROLE_ARTIFACT_KIND[artifact.role]} is incomplete for ${ticketId}: ${artifact.reason ?? "Update the role artifact."}`
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

export function readWorkflowRelayPayload(action: RelayAction, projectDir: string): WorkflowRelayPayload {
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
  const blockedArtifact = firstBlockedRoleArtifact(roleArtifacts)
  if (blockedArtifact === undefined) {
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
  const promptLines = relayPromptLinesFor(blockedArtifact.role, currentTicket, blockedArtifact.path)
  const scopedInputFiles = scopedInputs(currentTicket, closureBlocker)
  return {
    action,
    blockers: [
      {
        id: roleArtifactBlockerId(blockedArtifact),
        reason: roleArtifactBlockerReason(blockedArtifact, currentTicket.id),
        source: blockedArtifact.path,
      },
    ],
    closureBlocker,
    currentRole: blockedArtifact.role,
    currentTicket,
    enabled: true,
    gateCommand,
    nextRole: blockedArtifact.role,
    promptBlock: relayPromptBlock(promptLines),
    promptLines,
    requiredArtifact: blockedArtifact.path,
    requiredOutputArtifact: blockedArtifact.path,
    roleArtifacts,
    roleCompletionState: roleCompletionState(roleArtifacts, "blocked", blockedArtifact.role),
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
    return {
      status: 1,
      stdout: "",
      stderr: `workflow relay requires status --json, next --json, or validate --json.\n\n${relayUsage(invocationName)}\n`,
    }
  }
  const projectDir = resolve(options.projectDir ?? process.cwd())
  if (parsed === "validate-text") {
    return {
      status: 0,
      stdout: relayValidateText(readWorkflowRelayPayload("validate", projectDir)),
      stderr: "",
    }
  }
  return {
    status: 0,
    stdout: `${JSON.stringify(readWorkflowRelayPayload(parsed, projectDir), null, 2)}\n`,
    stderr: "",
  }
}
