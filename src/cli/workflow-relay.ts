import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import { loadHarnessConfig, type MultiAgentRole } from "../config/harness-config.js"
import type { CliRunResult } from "./bearshell.js"
import { readWorkflowClosurePayload, type ClosureBlocker, type ClosureTicket } from "./workflow-closure.js"

type RelayAction = "next" | "status"

type RelayBlockerId =
  | "multi-agent-disabled"
  | "no-current-ticket"
  | "role-implementation-artifact-missing"
  | "role-review-artifact-missing"
  | "role-test-artifact-missing"

type RelayBlocker = {
  readonly id: RelayBlockerId
  readonly reason: string
  readonly source: string
}

type RelayRoleArtifact = {
  readonly path: string
  readonly role: MultiAgentRole
  readonly status: "missing" | "present"
}

type WorkflowRelayPayload = {
  readonly action: RelayAction
  readonly blockers: readonly RelayBlocker[]
  readonly closureBlocker: ClosureBlocker | null
  readonly currentTicket: ClosureTicket | null
  readonly enabled: boolean
  readonly gateCommand: string
  readonly nextRole: MultiAgentRole | null
  readonly promptLines: readonly string[]
  readonly requiredArtifact: string | null
  readonly roleArtifacts: readonly RelayRoleArtifact[]
  readonly roleOrder: readonly MultiAgentRole[]
  readonly scopedInputs: readonly string[]
}

const ROLE_BLOCKERS: Readonly<Record<MultiAgentRole, RelayBlockerId>> = {
  "test-writer": "role-test-artifact-missing",
  jaeki: "role-implementation-artifact-missing",
  roach: "role-review-artifact-missing",
}

const ROLE_KIND: Readonly<Record<MultiAgentRole, string>> = {
  "test-writer": "test/verification artifact",
  jaeki: "implementation artifact",
  roach: "review artifact",
}

function roleArtifactPath(ticketId: string, role: MultiAgentRole): string {
  return `.persona/workflow/work/${ticketId}/roles/${role}.md`
}

function relayUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} workflow relay <status|next> --json`,
    "",
    "Prints the read-only multi-agent relay preview state.",
    "",
    "Scope:",
    "- requires multiAgent.enabled: true in .persona/harness.jsonc",
    "- does not dispatch native subtasks",
    "- does not auto-fill reports or auto-archive tickets",
    "- finish/check/archive remain the workflow gates",
  ].join("\n")
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

function promptLinesFor(role: MultiAgentRole, ticket: ClosureTicket, artifactPath: string): readonly string[] {
  const common = [
    "PH closure/workflow state is the orchestrator/gate; OpenCode subagents are workers.",
    `Current ticket: ${ticket.id} - ${ticket.title}`,
    `Scoped inputs are paths only; read only what is needed from those files.`,
  ]
  if (role === "test-writer") {
    return [
      ...common,
      "Role: test-writer.",
      "Write the expected failing test, verification test, or verification plan for this ticket.",
      "Do not implement production code.",
      `Record the role artifact at ${artifactPath}.`,
      "Then rerun `npx ph workflow relay next --json`.",
    ]
  }
  if (role === "jaeki") {
    return [
      ...common,
      "Role: jaeki.",
      "Implement or refactor only this scoped ticket; avoid broad redesign.",
      "Use the test-writer artifact if present and keep workflow reports/evidence honest.",
      `Record the role artifact at ${artifactPath}.`,
      "Then rerun `npx ph workflow relay next --json`.",
    ]
  }
  return [
    ...common,
    "Role: roach.",
    "Review/QA the scoped ticket and pressure implementation/review reports.",
    "Do not implement features unless explicitly reassigned.",
    `Record the role artifact at ${artifactPath}.`,
    "Then rerun `npx ph workflow relay next --json`.",
  ]
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
      currentTicket,
      enabled: false,
      gateCommand,
      nextRole: null,
      promptLines: [],
      requiredArtifact: null,
      roleArtifacts: [],
      roleOrder,
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
      currentTicket,
      enabled: true,
      gateCommand,
      nextRole: null,
      promptLines: [],
      requiredArtifact: null,
      roleArtifacts: [],
      roleOrder,
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
      currentTicket,
      enabled: true,
      gateCommand: "npx ph workflow closure next --json",
      nextRole: null,
      promptLines: [
        "Relay preview role artifacts are present.",
        "Run `npx ph workflow closure next --json` and continue through PH closure/check/finish gates.",
      ],
      requiredArtifact: null,
      roleArtifacts,
      roleOrder,
      scopedInputs: scopedInputs(currentTicket, closureBlocker),
    }
  }
  return {
    action,
    blockers: [
      {
        id: ROLE_BLOCKERS[missingArtifact.role],
        reason: `${missingArtifact.role} ${ROLE_KIND[missingArtifact.role]} is missing for ${currentTicket.id}.`,
        source: missingArtifact.path,
      },
    ],
    closureBlocker,
    currentTicket,
    enabled: true,
    gateCommand,
    nextRole: missingArtifact.role,
    promptLines: promptLinesFor(missingArtifact.role, currentTicket, missingArtifact.path),
    requiredArtifact: missingArtifact.path,
    roleArtifacts,
    roleOrder,
    scopedInputs: scopedInputs(currentTicket, closureBlocker),
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
