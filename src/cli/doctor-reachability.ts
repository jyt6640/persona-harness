import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { isRecord, stripJsonComments } from "../config/jsonc.js"
import { loadHarnessConfig } from "../config/harness-config.js"
import {
  workflowFinishFollowUpLines,
  type WorkflowFinishFollowUp,
} from "./workflow-finish-follow-up.js"

const AGENTS_START_MARKER =
  "<!-- persona-harness:agents:start schema=persona-harness.agents.v1 -->"
const AGENTS_END_MARKER = "<!-- persona-harness:agents:end -->"
const LEGACY_AGENTS_TITLE = "# Persona Harness Agent Instructions"
const LEGACY_IMPLEMENT_COMMAND = "npx ph workflow implement"
const LEGACY_FINISH_COMMAND = "npx ph workflow finish implement"

export type DoctorReachabilityLevel = "BLOCK" | "NOT ATTACHED" | "PASS" | "WARN"
export type DoctorAgentsState =
  | "corrupt"
  | "current"
  | "legacy observed"
  | "missing"
  | "unrecognized"
export type DoctorProjectPluginState = "configured" | "not observed" | "unreadable"

type DoctorReachabilityFinding = {
  readonly action?: string
  readonly command?: WorkflowFinishFollowUp["command"]
  readonly id: string
  readonly level: Exclude<DoctorReachabilityLevel, "PASS">
  readonly message: string
  readonly priority: number
}

export type DoctorReachabilitySummary = {
  readonly agentsState: DoctorAgentsState
  readonly executeVerification: boolean
  readonly findings: readonly DoctorReachabilityFinding[]
  readonly followUpLines: readonly string[]
  readonly level: DoctorReachabilityLevel
  readonly projectPluginState: DoctorProjectPluginState
}

function occurrences(content: string, token: string): number {
  return content.split(token).length - 1
}

function inspectAgents(projectDir: string): DoctorAgentsState {
  const agentsPath = join(projectDir, "AGENTS.md")
  if (!existsSync(agentsPath)) {
    return "missing"
  }

  let content: string
  try {
    content = readFileSync(agentsPath, "utf8")
  } catch {
    return "corrupt"
  }

  const startCount = occurrences(content, AGENTS_START_MARKER)
  const endCount = occurrences(content, AGENTS_END_MARKER)
  const startIndex = content.indexOf(AGENTS_START_MARKER)
  const endIndex = content.indexOf(AGENTS_END_MARKER)
  const managedMarkerCount = occurrences(content, "persona-harness:agents:")
  const hasManagedMarker = content.includes("persona-harness:agents:")

  if (
    startCount === 1 &&
    endCount === 1 &&
    managedMarkerCount === 2 &&
    startIndex < endIndex
  ) {
    return "current"
  }
  if (hasManagedMarker) {
    return "corrupt"
  }
  if (
    content.includes(LEGACY_AGENTS_TITLE) &&
    content.includes(LEGACY_IMPLEMENT_COMMAND) &&
    content.includes(LEGACY_FINISH_COMMAND)
  ) {
    return "legacy observed"
  }
  return "unrecognized"
}

function pluginEntries(parsed: unknown): readonly string[] {
  if (!isRecord(parsed)) {
    return []
  }
  const plugin = parsed.plugin
  if (typeof plugin === "string") {
    return [plugin]
  }
  if (!Array.isArray(plugin)) {
    return []
  }
  return plugin.filter((entry): entry is string => typeof entry === "string")
}

function inspectProjectPlugin(projectDir: string): DoctorProjectPluginState {
  const configPath = join(projectDir, ".opencode", "opencode.json")
  if (!existsSync(configPath)) {
    return "not observed"
  }
  try {
    const parsed: unknown = JSON.parse(stripJsonComments(readFileSync(configPath, "utf8")))
    return pluginEntries(parsed).some(
      (entry) => entry.includes("persona-harness") || entry.includes("dist/index.js"),
    )
      ? "configured"
      : "not observed"
  } catch {
    return "unreadable"
  }
}

function agentsFinding(state: DoctorAgentsState): DoctorReachabilityFinding | undefined {
  if (state === "current") {
    return undefined
  }
  if (state === "legacy observed") {
    return {
      id: "agents-legacy",
      level: "WARN",
      message: "AGENTS.md steering uses the recognized markerless legacy body.",
      priority: 30,
    }
  }
  if (state === "missing") {
    return {
      action: "Install the Persona Harness AGENTS.md steering instructions.",
      command: { phase: "now", value: "npx ph bootstrap backend" },
      id: "agents-missing",
      level: "BLOCK",
      message: "AGENTS.md steering is missing, so session entry instructions are not reachable.",
      priority: 10,
    }
  }
  return {
    action:
      "Review AGENTS.md and preserve user-authored content while restoring one valid Persona Harness managed block.",
    command: { phase: "after-action", value: "npx ph doctor" },
    id: `agents-${state}`,
    level: "BLOCK",
    message: `AGENTS.md steering is ${state}; Persona Harness will not rewrite it automatically.`,
    priority: 10,
  }
}

function pluginFinding(state: DoctorProjectPluginState): DoctorReachabilityFinding | undefined {
  if (state === "configured") {
    return undefined
  }
  return {
    action:
      "Review .opencode/opencode.json and add the Persona Harness plugin entry without overwriting other project configuration.",
    command: { phase: "after-action", value: "npx ph doctor" },
    id: `project-plugin-${state}`,
    level: "BLOCK",
    message:
      state === "unreadable"
        ? "Project-local OpenCode plugin registration is unreadable."
        : "Project-local OpenCode plugin registration is not observed; global registration remains unknown.",
    priority: 20,
  }
}

function enforcementFinding(executeVerification: boolean): DoctorReachabilityFinding | undefined {
  return executeVerification
    ? undefined
    : {
        id: "verification-evidence-only",
        level: "WARN",
        message: "PH-run verification OFF — evidence-only mode, TDD rail advisory",
        priority: 40,
      }
}

function followUpLines(findings: readonly DoctorReachabilityFinding[]): readonly string[] {
  const finding = findings.find((item) => item.action !== undefined)
  if (finding?.action === undefined) {
    return []
  }
  return workflowFinishFollowUpLines({
    action: finding.action,
    blockerId: finding.id,
    ...(finding.command === undefined ? {} : { command: finding.command }),
  })
}

export function readDoctorReachability(projectDir: string): DoctorReachabilitySummary {
  const agentsState = inspectAgents(projectDir)
  const projectPluginState = inspectProjectPlugin(projectDir)
  const attached = existsSync(join(projectDir, ".persona", "harness.jsonc"))
  const executeVerification = loadHarnessConfig(projectDir).enforce.executeVerification
  if (!attached) {
    return {
      agentsState,
      executeVerification,
      findings: [],
      followUpLines: [],
      level: "NOT ATTACHED",
      projectPluginState,
    }
  }
  const findings = [
    agentsFinding(agentsState),
    pluginFinding(projectPluginState),
    enforcementFinding(executeVerification),
  ]
    .filter((finding): finding is DoctorReachabilityFinding => finding !== undefined)
    .sort((left, right) => left.priority - right.priority)
  const level = findings.some((finding) => finding.level === "BLOCK")
    ? "BLOCK"
    : findings.length > 0
      ? "WARN"
      : "PASS"

  return {
    agentsState,
    executeVerification,
    findings,
    followUpLines: followUpLines(findings),
    level,
    projectPluginState,
  }
}
