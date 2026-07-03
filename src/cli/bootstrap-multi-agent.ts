import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import {
  DEFAULT_MULTI_AGENT_ROLES,
  deprecatedMultiAgentRoleFor,
  type HarnessMultiAgentConfig,
  type MultiAgentRole,
} from "../config/harness-config.js"
import { isRecord, stripJsonComments } from "../config/jsonc.js"
import type { CliRunResult } from "./bearshell.js"

const HARNESS_CONFIG_PATH = ".persona/harness.jsonc"
const OPENCODE_CONFIG_PATH = ".opencode/opencode.json"

type JsonObject = Record<string, unknown>

type RoleDefinition = {
  readonly description: string
  readonly prompt: string
}

const ROLE_DEFINITIONS: Readonly<Record<MultiAgentRole, RoleDefinition>> = {
  "test-writer": {
    description: "Persona Harness relay preview tester for the current workflow ticket.",
    prompt: [
      "Persona Harness relay preview role: test-writer.",
      "Work only from the current PH ticket and closure handoff.",
      "Read canonical PH test guidance first: .persona/rules/backend/spring-test.md section 'PH Multi-Agent Relay' and the current ticket/scenario contract rule.",
      "Detailed reference, if available in this package: packages/shared-skills/skills/programming/references/java/testing.md section 'Persona Harness relay contract'.",
      "Define the expected failing test, verification test, or verification plan.",
      "Do not implement production code.",
      "Do not weaken, delete, or rewrite existing tests to pass without preserving behavior.",
      "PH relay is a main-session role checklist rail; host subagents are optional workers when available.",
    ].join("\n"),
  },
  implementer: {
    description: "Persona Harness relay preview implementer for one scoped workflow ticket.",
    prompt: [
      "Persona Harness relay preview role: implementer.",
      "Implement or refactor only the scoped current ticket.",
      "Do not broaden the design or start unrelated requirements.",
      "Use the test-writer artifact when it exists and keep PH reports/evidence honest.",
      "PH relay is a main-session role checklist rail; host subagents are optional workers when available.",
    ].join("\n"),
  },
  reviewer: {
    description: "Persona Harness relay preview reviewer for workflow closure pressure.",
    prompt: [
      "Persona Harness relay preview role: reviewer.",
      "Review, QA, and pressure the implementation/review reports for the scoped ticket.",
      "Do not implement features unless explicitly reassigned.",
      "Surface remaining blockers and required verification evidence.",
      "PH relay is a main-session role checklist rail; host subagents are optional workers when available.",
    ].join("\n"),
  },
}

function readJsonObject(path: string, label: string): JsonObject | CliRunResult {
  if (!existsSync(path)) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(stripJsonComments(readFileSync(path, "utf8")))
    if (!isRecord(parsed)) {
      return {
        status: 1,
        stdout: "",
        stderr: `Persona Harness backend bootstrap failed during multi-agent preview.\n\n${label} must contain a JSON object.\n`,
      }
    }
    return parsed
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        status: 1,
        stdout: "",
        stderr: `Persona Harness backend bootstrap failed during multi-agent preview.\n\nFailed to parse ${label}: ${error.message}\n`,
      }
    }
    throw error
  }
}

function isCliRunResult(value: JsonObject | CliRunResult): value is CliRunResult {
  return "status" in value && "stdout" in value && "stderr" in value
}

function roleAgentConfig(role: MultiAgentRole, model: string | undefined, existing: unknown): JsonObject {
  const definition = ROLE_DEFINITIONS[role]
  const base = isRecord(existing) ? existing : {}
  return {
    ...base,
    description: definition.description,
    mode: "subagent",
    prompt: definition.prompt,
    ...(model === undefined ? {} : { model }),
  }
}

function migrateLegacyAgentKeys(existingAgent: JsonObject): JsonObject {
  const nextAgent: JsonObject = { ...existingAgent }
  for (const role of DEFAULT_MULTI_AGENT_ROLES) {
    const legacyRole = deprecatedMultiAgentRoleFor(role)
    if (legacyRole !== undefined && nextAgent[role] === undefined && nextAgent[legacyRole] !== undefined) {
      nextAgent[role] = nextAgent[legacyRole]
      delete nextAgent[legacyRole]
    }
  }
  return nextAgent
}

function modelForRole(
  multiAgent: HarnessMultiAgentConfig,
  existingModels: JsonObject,
  role: MultiAgentRole,
): string | undefined {
  const legacyRole = deprecatedMultiAgentRoleFor(role)
  const model = multiAgent.models[role] ?? existingModels[role] ?? (legacyRole === undefined ? undefined : existingModels[legacyRole])
  return typeof model === "string" && model.trim() !== "" ? model : undefined
}

function writeJsonObject(path: string, value: JsonObject): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function enableHarnessMultiAgent(projectDir: string, multiAgent: HarnessMultiAgentConfig): CliRunResult | undefined {
  const harnessConfigPath = join(projectDir, HARNESS_CONFIG_PATH)
  const parsed = readJsonObject(harnessConfigPath, HARNESS_CONFIG_PATH)
  if (isCliRunResult(parsed)) {
    return parsed
  }
  const existingMultiAgent = isRecord(parsed.multiAgent) ? parsed.multiAgent : {}
  const existingModels = isRecord(existingMultiAgent.models) ? existingMultiAgent.models : {}
  const models: JsonObject = {}
  for (const role of DEFAULT_MULTI_AGENT_ROLES) {
    const model = modelForRole(multiAgent, existingModels, role)
    if (model !== undefined) {
      models[role] = model
    }
  }
  writeJsonObject(harnessConfigPath, {
    ...parsed,
    multiAgent: {
      ...existingMultiAgent,
      enabled: true,
      roles: DEFAULT_MULTI_AGENT_ROLES,
      models,
    },
  })
  return undefined
}

function enableOpenCodeAgents(projectDir: string, multiAgent: HarnessMultiAgentConfig): CliRunResult | undefined {
  const opencodeConfigPath = join(projectDir, OPENCODE_CONFIG_PATH)
  const parsed = readJsonObject(opencodeConfigPath, OPENCODE_CONFIG_PATH)
  if (isCliRunResult(parsed)) {
    return parsed
  }
  const existingAgent = isRecord(parsed.agent) ? parsed.agent : {}
  const nextAgent = migrateLegacyAgentKeys(existingAgent)
  for (const role of DEFAULT_MULTI_AGENT_ROLES) {
    nextAgent[role] = roleAgentConfig(role, multiAgent.models[role], nextAgent[role])
  }
  writeJsonObject(opencodeConfigPath, { ...parsed, agent: nextAgent })
  return undefined
}

export function enableMultiAgentPreview(
  projectDir: string,
  multiAgent: HarnessMultiAgentConfig,
): CliRunResult | undefined {
  const harnessFailure = enableHarnessMultiAgent(projectDir, multiAgent)
  if (harnessFailure !== undefined) {
    return harnessFailure
  }
  return enableOpenCodeAgents(projectDir, multiAgent)
}
