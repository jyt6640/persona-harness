import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it } from "vitest"

import { RailComplianceTracker } from "../src/runtime/rail-compliance.js"
import type { TopLevelIntent } from "../src/runtime/top-level-intent-router.js"

const fixtureWorkspace = join(process.cwd(), ".persona-rail-compliance-unit-fixtures")

beforeEach(() => {
  rmSync(fixtureWorkspace, { recursive: true, force: true })
  mkdirSync(join(fixtureWorkspace, ".persona", "workflow"), { recursive: true })
  writeFileSync(
    join(fixtureWorkspace, ".persona", "harness.jsonc"),
    `${JSON.stringify({ enabledDomains: ["backend", "programming", "workflow"] }, null, 2)}\n`,
  )
})

function intent(
  primary: TopLevelIntent["primary"],
  secondary: readonly TopLevelIntent["primary"][] = [],
): TopLevelIntent {
  return {
    primary,
    secondary,
    reason: `${primary} rail under test.`,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function railCompliancePayloads(): readonly Record<string, unknown>[] {
  const evidenceDir = join(fixtureWorkspace, ".persona", "evidence", "phase0")
  if (!existsSync(evidenceDir)) {
    return []
  }

  return readdirSync(evidenceDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => {
      const parsed: unknown = JSON.parse(readFileSync(join(evidenceDir, fileName), "utf8"))
      if (!isRecord(parsed)) {
        throw new Error(`expected evidence payload object: ${fileName}`)
      }
      return parsed
    })
    .filter((payload) => payload.schemaVersion === "phase0.rail-compliance.1")
}

function startTracker(
  sessionID: string,
  railIntent: TopLevelIntent,
  railMarker = "[Persona Harness Test Workflow]",
): RailComplianceTracker {
  const tracker = new RailComplianceTracker()
  tracker.startRail(sessionID, "user prompt", railIntent, railMarker)
  return tracker
}

describe("RailComplianceTracker direct unit behavior", () => {
  it("records report-only evidence when requirements rail mutates before split or next", () => {
    const sessionID = "requirements-direct-mutation"
    const tracker = startTracker(sessionID, intent("requirements", ["programming"]))

    tracker.observeTool(fixtureWorkspace, {
      tool: "write",
      sessionID,
      callID: "call-write",
      args: { filePath: "src/main/java/App.java" },
    })

    expect(railCompliancePayloads()).toContainEqual(
      expect.objectContaining({
        schemaVersion: "phase0.rail-compliance.1",
        hook: "tool.execute.after",
        sessionID,
        callID: "call-write",
        injectedInto: "rail-compliance",
        finding: "WARN",
        confidence: "HIGH",
        code: "requirements-rail-direct-implementation",
        primaryIntent: "requirements",
        secondaryIntents: ["programming"],
        reportOnly: true,
        observedAction: "write modified a file before ticket workflow evidence",
        expectedAction: "Run `npx ph workflow split` and `npx ph workflow next` before implementation.",
      }),
    )
  })

  it("records expected action when programming rail finishes without required workflow reports", () => {
    const sessionID = "programming-missing-reports"
    const tracker = startTracker(sessionID, intent("programming"), "[Persona Harness Programming Workflow]")

    tracker.observeTool(fixtureWorkspace, {
      tool: "shell",
      sessionID,
      callID: "call-finish",
      args: { cmd: "npx ph workflow finish implement" },
    })

    expect(railCompliancePayloads()).toContainEqual(
      expect.objectContaining({
        code: "workflow-report-missing",
        primaryIntent: "programming",
        observedAction: "npx ph workflow finish implement",
        expectedAction: "Fill implementation and review reports before finishing the workflow.",
        reportOnly: true,
      }),
    )
  })

  it("does not exaggerate bearshell verification as raw verification mismatch", () => {
    const sessionID = "programming-bearshell-finish"
    const tracker = startTracker(sessionID, intent("programming"), "[Persona Harness Programming Workflow]")

    tracker.observeTool(fixtureWorkspace, {
      tool: "shell",
      sessionID,
      callID: "call-bearshell",
      args: { cmd: "npx ph bearshell --shell './gradlew test'" },
    })
    tracker.observeTool(fixtureWorkspace, {
      tool: "shell",
      sessionID,
      callID: "call-finish",
      args: { cmd: "npx ph workflow finish implement" },
    })

    const findingCodes = railCompliancePayloads().map((payload) => payload.code)
    expect(findingCodes).not.toContain("raw-final-verification-without-bearshell")
    expect(findingCodes).toContain("workflow-report-missing")
  })

  it("does not record findings for ticketed requirements edits", () => {
    const sessionID = "requirements-ticketed-edit"
    const tracker = startTracker(sessionID, intent("requirements", ["programming"]))

    tracker.observeTool(fixtureWorkspace, {
      tool: "shell",
      sessionID,
      callID: "call-split",
      args: { cmd: "npx ph workflow split README.md" },
    })
    tracker.observeTool(fixtureWorkspace, {
      tool: "shell",
      sessionID,
      callID: "call-next",
      args: { cmd: "npx ph workflow next" },
    })
    tracker.observeTool(fixtureWorkspace, {
      tool: "edit",
      sessionID,
      callID: "call-edit",
      args: { filePath: "src/main/java/App.java" },
    })

    expect(railCompliancePayloads()).toEqual([])
  })
})
