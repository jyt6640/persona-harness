import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { AssistantMessage } from "@opencode-ai/sdk"
import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { appendRoleBoundaryObservation } from "../src/runtime/role-boundary-evidence.js"
import { RuntimeSessionRegistry } from "../src/runtime/session-registry.js"
import { writeCompactionAttempt } from "../src/runtime/token-compaction-evidence.js"
import { TokenTelemetryRecorder } from "../src/runtime/token-telemetry.js"

const projects: string[] = []

function assistantMessage(sessionID: string): AssistantMessage {
  return {
    id: "message-privacy",
    sessionID,
    role: "assistant",
    time: { created: 1, completed: 2 },
    parentID: "parent-privacy",
    modelID: "gpt-test",
    providerID: "openai",
    mode: "primary",
    path: { cwd: process.cwd(), root: process.cwd() },
    cost: 0,
    tokens: {
      input: 1,
      output: 1,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
  }
}

function evidenceFiles(projectDir: string): readonly string[] {
  const evidenceRoot = join(projectDir, ".persona", "evidence")
  if (!existsSync(evidenceRoot)) {
    return []
  }
  return readdirSync(evidenceRoot, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".json"))
    .map((entry) => join(evidenceRoot, entry))
    .sort()
}

afterEach(() => {
  for (const project of projects.splice(0)) {
    rmSync(project, { recursive: true, force: true })
  }
})

describe("evidence filename privacy", () => {
  it("does not expose a token-shaped caller identifier in any affected writer path or A/B output", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "persona-evidence-filename-privacy-"))
    projects.push(projectDir)
    const token = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"

    appendRoleBoundaryObservation(projectDir, {
      currentTicketId: "ticket-privacy",
      path: "src/main/java/App.java",
      policy: "role policy",
      role: "implementer",
      sessionID: token,
    })

    const sessionRegistry = new RuntimeSessionRegistry({
      multiAgentEnabled: true,
      projectDir,
      runtimeInjectionEnabled: true,
    })
    expect(sessionRegistry.allowsMainSession(token, "model-input")).toBe(false)

    const telemetry = new TokenTelemetryRecorder(projectDir)
    const telemetryResult = telemetry.recordMessage(assistantMessage(token))
    expect(telemetryResult.kind).toBe("written")

    writeCompactionAttempt(projectDir, token, {
      afterMeasurement: { measured: false, reason: "unmeasured" },
      beforeMeasurement: { aggregate: { cacheRead: 0, cacheWrite: 0, input: 1, output: 1, reasoning: 0, total: 2 }, measured: false, reason: "ratio unavailable" },
      reason: "privacy test",
      status: "skipped",
      timestamp: "2026-07-15T12:00:00.000Z",
    })

    const ab = runPersonaCli([
      "evidence",
      "ab-run",
      "--scenario",
      token,
      "--condition",
      token,
      "--run-id",
      token,
      "--",
      process.execPath,
      "-e",
      "process.exit(0)",
    ], { cwd: projectDir, env: {}, invocationName: "ph" })

    const files = evidenceFiles(projectDir)
    const source = files.map((path) => readFileSync(path, "utf8")).join("\n")
    const paths = [
      ...(telemetryResult.kind === "written" ? [telemetryResult.path] : []),
      ...files,
    ].join("\n")

    expect(ab.status).toBe(0)
    expect(ab.stdout).not.toContain(token)
    expect(ab.stderr).not.toContain(token)
    expect(paths).not.toContain(token)
    expect(source).not.toContain(token)
    expect(files.some((path) => path.includes(token))).toBe(false)
  })
})
