import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

type AbRunMetric = {
  readonly elapsedMs?: number
  readonly mcpCalls?: number
  readonly providerTokenTotal?: number
  readonly readChars?: number
  readonly toolCalls?: number
}

type AbScenarioFixture = {
  readonly baseline: AbRunMetric
  readonly candidate: AbRunMetric
  readonly id: string
  readonly surface?: {
    readonly defaultState: "default" | "opt-in" | "unknown"
    readonly id: string
    readonly label: string
  }
}

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-evidence-pminus-status-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function evidenceFiles(projectDir: string): readonly string[] {
  const evidenceDir = join(projectDir, ".persona", "evidence")
  if (!existsSync(evidenceDir)) {
    return []
  }
  return readdirSync(evidenceDir, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".json"))
    .sort()
}

function tokenEvidence(metric: AbRunMetric): { readonly total: number } | null {
  return metric.providerTokenTotal === undefined ? null : { total: metric.providerTokenTotal }
}

function writeScenario(projectDir: string, fixture: AbScenarioFixture): void {
  const filePath = join(projectDir, ".persona", "evidence", "ab", fixture.id, "measurement.json")
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        schemaVersion: "persona-ab-measurement.1",
        scenarioId: fixture.id,
        surface: fixture.surface,
        conditions: [
          {
            id: "off",
            label: "OFF",
            runs: [
              {
                id: "off-1",
                elapsedMs: fixture.baseline.elapsedMs ?? null,
                finishStatus: "pass",
                mcpCalls: fixture.baseline.mcpCalls ?? null,
                providerTokens: tokenEvidence(fixture.baseline),
                readChars: fixture.baseline.readChars ?? null,
                toolCalls: fixture.baseline.toolCalls ?? null,
              },
            ],
          },
          {
            id: "on",
            label: "ON",
            runs: [
              {
                id: "on-1",
                elapsedMs: fixture.candidate.elapsedMs ?? null,
                finishStatus: "pass",
                mcpCalls: fixture.candidate.mcpCalls ?? null,
                providerTokens: tokenEvidence(fixture.candidate),
                readChars: fixture.candidate.readChars ?? null,
                toolCalls: fixture.candidate.toolCalls ?? null,
              },
            ],
          },
        ],
      },
      null,
      2,
    )}\n`,
  )
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph evidence pminus-status", () => {
  it("aggregates local P-minus scenario decisions by surface without writing files", () => {
    const projectDir = createTempProject()
    writeScenario(projectDir, {
      id: "codegraph-navigation",
      surface: { defaultState: "default", id: "codegraph", label: "CodeGraph" },
      baseline: { elapsedMs: 100, mcpCalls: 0, readChars: 200, toolCalls: 4 },
      candidate: { elapsedMs: 180, mcpCalls: 2, readChars: 400, toolCalls: 8 },
    })
    writeScenario(projectDir, {
      id: "codegraph-cache",
      surface: { defaultState: "default", id: "codegraph", label: "CodeGraph" },
      baseline: { providerTokenTotal: 300 },
      candidate: { providerTokenTotal: 200 },
    })
    writeScenario(projectDir, {
      id: "lsp-symbols",
      surface: { defaultState: "opt-in", id: "lsp", label: "LSP MCP" },
      baseline: { providerTokenTotal: 100 },
      candidate: { providerTokenTotal: 100 },
    })
    writeScenario(projectDir, {
      id: "unknown-surface",
      baseline: {},
      candidate: {},
    })
    const before = evidenceFiles(projectDir)

    const jsonResult = runPersonaCli(["evidence", "pminus-status", "--json"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const textResult = runPersonaCli(["evidence", "pminus-status"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(jsonResult.status).toBe(0)
    expect(textResult.status).toBe(0)
    expect(evidenceFiles(projectDir)).toEqual(before)
    expect(existsSync(join(projectDir, ".persona", "workflow"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "harness.jsonc"))).toBe(false)
    expect(textResult.stdout).toContain("# Persona P-minus Surface Status")
    expect(textResult.stdout).toContain("recommended next action: downgrade candidate")

    const status = JSON.parse(jsonResult.stdout)
    expect(status).toMatchObject({
      schemaVersion: "evidence-pminus-status.1",
      limitations: expect.arrayContaining([
        expect.stringContaining("read-only decision support"),
        expect.stringContaining("not automatic downgrade"),
      ]),
    })
    expect(status.surfaces.find((surface: { readonly id: string }) => surface.id === "codegraph")).toMatchObject({
      defaultState: "default",
      outcomeCounts: { improved: 1, worse: 1 },
      providerTelemetry: { available: 1, missing: 1, state: "partial" },
      recommendedNextAction: "downgrade candidate",
      scenarioCount: 2,
      surfaceDecisionHints: { downgrade: 1, keep: 1 },
    })
    expect(status.surfaces.find((surface: { readonly id: string }) => surface.id === "lsp")).toMatchObject({
      defaultState: "opt-in",
      outcomeCounts: { "no-improvement": 1 },
      providerTelemetry: { available: 1, state: "available" },
      recommendedNextAction: "keep opt-in",
    })
    expect(status.surfaces.find((surface: { readonly id: string }) => surface.id === "unknown-surface")).toMatchObject({
      defaultState: "unknown",
      outcomeCounts: { inconclusive: 1 },
      providerTelemetry: { missing: 1, state: "missing" },
      recommendedNextAction: "no-claim",
    })
  })
})
