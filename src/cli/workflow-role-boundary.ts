import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import { loadHarnessConfig } from "../config/harness-config.js"
import type { MultiAgentRole } from "../config/harness-config.js"
import type { CliRunResult } from "./bearshell.js"
import { readWorkflowClosurePayload } from "./workflow-closure.js"
import type { ClosureTicket } from "./workflow-closure.js"
import {
  relayRoleArtifactBoundaryFindings,
  relayRoleArtifactFiles,
  roleArtifactPath,
} from "./workflow-relay-artifacts.js"
import type { RelayRoleArtifactFile, RelayRoleBoundaryFinding } from "./workflow-relay-artifacts.js"

type RoleBoundaryBlockMode = {
  readonly available: false
  readonly reason: string
}

type RoleBoundarySummary = {
  readonly compatibilityNotes: readonly string[]
  readonly currentTicket: ClosureTicket | null
  readonly enabled: boolean
  readonly findingCount: number
  readonly mode: "report-only"
}

type WorkflowRoleBoundaryPayload = {
  readonly blockMode: RoleBoundaryBlockMode
  readonly boundaries: readonly string[]
  readonly findings: readonly RelayRoleBoundaryFinding[]
  readonly roleArtifactFiles: readonly RelayRoleArtifactFile[]
  readonly roleOrder: readonly MultiAgentRole[]
  readonly schemaVersion: "workflow-role-boundary-report.1"
  readonly stableSessionRoleIdentity: "unavailable"
  readonly summary: RoleBoundarySummary
}

type RoleBoundaryOptions = {
  readonly json: boolean
  readonly projectDir?: string
}

const BLOCK_MODE_REASON =
  "Stable per-session agent/role identity is not available at PH runtime boundaries; Stage 1A only confirmed Session.parentID subagent classification."

function compatibilityNotes(files: readonly RelayRoleArtifactFile[]): readonly string[] {
  const notes: string[] = []
  for (const file of files) {
    if (file.compatibility === "legacy") {
      notes.push(`${file.path} uses a legacy role artifact path; PH reads it for compatibility but writes current role names.`)
    } else if (file.compatibility === "unknown") {
      notes.push(`${file.path} is not owned by a configured relay role.`)
    }
  }
  return notes
}

function unknownPathFindings(files: readonly RelayRoleArtifactFile[]): readonly RelayRoleBoundaryFinding[] {
  return files
    .filter((file) => file.compatibility === "unknown")
    .map((file) => ({
      id: "unknown-role-artifact-path",
      message: "Role artifact path is not owned by test-writer, implementer, reviewer, or a supported legacy alias.",
      path: file.path,
      role: "unknown",
      severity: "warning",
    }))
}

function roleArtifactFindings(
  projectDir: string,
  files: readonly RelayRoleArtifactFile[],
): readonly RelayRoleBoundaryFinding[] {
  const findings: RelayRoleBoundaryFinding[] = []
  for (const file of files) {
    if (file.role === "unknown") {
      continue
    }
    const path = file.path
    const absolutePath = join(projectDir, path)
    if (existsSync(absolutePath)) {
      findings.push(...relayRoleArtifactBoundaryFindings(file.role, path, readFileSync(absolutePath, "utf8")))
    }
  }
  return findings
}

function readWorkflowRoleBoundaryPayload(projectDir: string): WorkflowRoleBoundaryPayload {
  const config = loadHarnessConfig(projectDir)
  const roleOrder = config.multiAgent.roles
  const closure = readWorkflowClosurePayload("next", projectDir)
  const currentTicket = closure.state.currentTicket
  const roleArtifactFiles = currentTicket === null ? [] : relayRoleArtifactFiles(projectDir, currentTicket.id, roleOrder)
  const findings = currentTicket === null
    ? []
    : [
        ...roleArtifactFindings(projectDir, roleArtifactFiles),
        ...unknownPathFindings(roleArtifactFiles),
      ]
  return {
    blockMode: {
      available: false,
      reason: BLOCK_MODE_REASON,
    },
    boundaries: [
      "report-only role-boundary observation; no writes are blocked",
      "findings use relay artifacts and artifact path ownership only",
      "no deterministic write enforcement is claimed without stable session-role identity",
      "PH closure/check/archive/finish gates remain authoritative",
    ],
    findings,
    roleArtifactFiles,
    roleOrder,
    schemaVersion: "workflow-role-boundary-report.1",
    stableSessionRoleIdentity: "unavailable",
    summary: {
      compatibilityNotes: compatibilityNotes(roleArtifactFiles),
      currentTicket,
      enabled: config.multiAgent.enabled,
      findingCount: findings.length,
      mode: "report-only",
    },
  }
}

function formatRoleBoundaryText(payload: WorkflowRoleBoundaryPayload): string {
  const ticket = payload.summary.currentTicket === null
    ? "none"
    : `${payload.summary.currentTicket.id} - ${payload.summary.currentTicket.title}`
  const lines = [
    "Persona Harness role-boundary report",
    "Mode: report-only; no writes are blocked and no workflow state is mutated.",
    `Multi-agent enabled: ${payload.summary.enabled ? "true" : "false"}`,
    `Current ticket: ${ticket}`,
    `Stable session role identity: ${payload.stableSessionRoleIdentity}`,
    `Block mode: unavailable - ${payload.blockMode.reason}`,
    `Findings: ${payload.summary.findingCount}`,
  ]
  if (payload.findings.length > 0) {
    lines.push("Role-boundary findings:")
    for (const finding of payload.findings) {
      lines.push(`- ${finding.severity}: ${finding.id} (${finding.role}) ${finding.path} - ${finding.message}`)
    }
  } else {
    lines.push("Role-boundary findings: none")
  }
  if (payload.summary.compatibilityNotes.length > 0) {
    lines.push("Compatibility notes:", ...payload.summary.compatibilityNotes.map((note) => `- ${note}`))
  }
  lines.push("Boundaries:", ...payload.boundaries.map((boundary) => `- ${boundary}`))
  return `${lines.join("\n")}\n`
}

export function runWorkflowRoleBoundaryCommand(options: RoleBoundaryOptions): CliRunResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const payload = readWorkflowRoleBoundaryPayload(projectDir)
  if (options.json) {
    return { status: 0, stdout: `${JSON.stringify(payload, null, 2)}\n`, stderr: "" }
  }
  return { status: 0, stdout: formatRoleBoundaryText(payload), stderr: "" }
}
