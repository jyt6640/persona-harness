import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-evidence-summary-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeEvidence(projectDir: string, filename: string, content: unknown): void {
  const evidenceDir = join(projectDir, ".persona", "evidence", "phase0")
  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(join(evidenceDir, filename), `${JSON.stringify(content, null, 2)}\n`)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph evidence summary", () => {
  it("writes a human-readable evidence summary with role, target, rule, and skill counts", () => {
    const projectDir = createTempProject()
    writeEvidence(projectDir, "controller.json", {
      targetFile: "/demo/src/main/java/com/example/book/presentation/BookController.java",
      fileRole: "controller",
      selectedRules: ["backend/spring-controller.md", "backend/java-common.md"],
      selectedSharedSkills: [{ name: "programming", domain: "programming" }],
    })
    writeEvidence(projectDir, "service.json", {
      targetFile: "/demo/src/main/java/com/example/book/application/BookService.java",
      fileRole: "service",
      selectedRules: ["backend/spring-service.md"],
      selectedSharedSkills: [{ name: "programming", domain: "programming" }],
    })

    const result = runPersonaCli(["evidence", "summary"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Evidence summary written")
    expect(result.stdout).toContain(`Evidence directory: ${join(projectDir, ".persona", "evidence")}`)
    const summary = readFileSync(join(projectDir, ".persona", "evidence", "summary.md"), "utf8")
    expect(summary).toContain("# Persona Evidence Summary")
    expect(summary).toContain("Total evidence files: 2")
    expect(summary).toContain("- controller: 1")
    expect(summary).toContain("- service: 1")
    expect(summary).toContain("- backend/java-common.md: 1")
    expect(summary).toContain("- programming: 2")
    expect(summary).toContain("BookController.java")
    expect(summary).toContain("BookService.java")
  })

  it("does not fail when evidence is missing or unreadable", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "bad.json"), "{ nope\n")

    const result = runPersonaCli(["evidence", "summary"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const summaryPath = join(projectDir, ".persona", "evidence", "summary.md")
    expect(existsSync(summaryPath)).toBe(true)
    const summary = readFileSync(summaryPath, "utf8")
    expect(summary).toContain("Unreadable evidence files: 1")
    expect(summary).toContain("bad.json")
  })

  it("prints read-only evidence metrics as JSON from structured token, tool, MCP, and finish evidence", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".persona", "evidence", "token-usage"), { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "evidence", "token-usage", "session-a.json"),
      `${JSON.stringify(
        {
          schemaVersion: "token-usage.1",
          sessionID: "session-a",
          providerID: "openai",
          modelID: "gpt-test",
          modelLimit: 1000,
          ratio: 0.15,
          aggregate: {
            cacheRead: 30,
            cacheWrite: 5,
            input: 100,
            output: 20,
            reasoning: 10,
            total: 160,
          },
        },
        null,
        2,
      )}\n`,
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "logs"), { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "evidence", "logs", "events.jsonl"),
      [
        JSON.stringify({ type: "tool_use", name: "codegraph_explore", readChars: 120 }),
        JSON.stringify({ event: "tool_call", toolName: "context7_get-library-docs" }),
        JSON.stringify({ kind: "mcp_tool_call", tool_name: "grep_app_search" }),
        JSON.stringify({ type: "tool_use", name: "persona-harness-code-nav_search_text" }),
      ].join("\n"),
    )
    writeEvidence(projectDir, "finish-pass.json", {
      command: "npx ph workflow finish implement",
      status: 0,
    })
    writeEvidence(projectDir, "finish-fail.json", {
      command: "npx ph workflow finish implement",
      exitCode: 1,
    })
    writeFileSync(join(projectDir, ".persona", "evidence", "logs", "bad.json"), "{ nope\n")

    const result = runPersonaCli(["evidence", "metrics", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const metrics = JSON.parse(result.stdout)

    expect(result.status).toBe(0)
    expect(metrics.schemaVersion).toBe("evidence-metrics.1")
    expect(metrics.filesScanned).toBe(5)
    expect(metrics.unreadableFiles).toHaveLength(1)
    expect(metrics.tokenUsage.sessions).toHaveLength(1)
    expect(metrics.tokenUsage.aggregate).toMatchObject({
      cacheRead: 30,
      input: 100,
      total: 160,
    })
    expect(metrics.toolCalls.total).toBe(4)
    expect(metrics.mcp.byFamily).toMatchObject({
      codegraph: 1,
      context7: 1,
      grep_app: 1,
      "persona-harness-code-nav": 1,
    })
    expect(metrics.readChars.total).toBe(120)
    expect(metrics.finish).toMatchObject({ fail: 1, pass: 1, unknown: 0 })
    expect(metrics.limitations.join("\n")).toContain("not an effectiveness or token-saving claim")
  })

  it("prints human evidence metrics without writing dashboard files", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["evidence", "metrics"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("# Persona Evidence Metrics")
    expect(result.stdout).toContain(`Evidence directory: \`${join(projectDir, ".persona", "evidence")}\``)
    expect(result.stdout).toContain("Structured read chars unavailable")
    expect(existsSync(join(projectDir, ".persona", "evidence", "metrics.md"))).toBe(false)
  })

  it("prints read-only A/B reports as JSON from structured matched-scenario evidence", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".persona", "evidence", "ab"), { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "evidence", "ab", "tdd-ab.json"),
      `${JSON.stringify(
        {
          schemaVersion: "persona-ab-measurement.1",
          scenarioId: "tdd-rail-completion-integrity",
          scenarioLabel: "TDD rail completion integrity",
          source: "local-fixture",
          conditions: [
            {
              id: "tdd-off",
              label: "TDD OFF",
              runs: [
                {
                  id: "off-1",
                  outcome: "green-only-finished",
                  finishStatus: "pass",
                  blockedInvalidCompletion: false,
                  elapsedMs: 100,
                  providerTokens: { total: 1000, input: 700, output: 200, reasoning: 100 },
                  readChars: 50,
                  toolCalls: 2,
                  mcpCalls: 0,
                },
              ],
            },
            {
              id: "tdd-on",
              label: "TDD ON",
              runs: [
                {
                  id: "on-1",
                  outcome: "green-only-blocked",
                  finishStatus: "blocked",
                  blockedInvalidCompletion: true,
                  elapsedMs: 120,
                  providerTokens: null,
                  readChars: null,
                  toolCalls: 3,
                  mcpCalls: 0,
                },
              ],
            },
          ],
        },
        null,
        2,
      )}\n`,
    )

    const result = runPersonaCli(["evidence", "ab-report", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const report = JSON.parse(result.stdout)

    expect(result.status).toBe(0)
    expect(report.schemaVersion).toBe("evidence-ab-report.1")
    expect(report.scenarios).toHaveLength(1)
    expect(report.scenarios[0].id).toBe("tdd-rail-completion-integrity")
    expect(report.scenarios[0].conditions).toHaveLength(2)
    expect(report.scenarios[0].conditions[0]).toMatchObject({
      id: "tdd-off",
      finish: { pass: 1, blocked: 0 },
      metrics: {
        providerTokenTotal: { samples: 1, total: 1000, unavailable: 0 },
        readChars: { samples: 1, total: 50, unavailable: 0 },
      },
    })
    expect(report.scenarios[0].conditions[1]).toMatchObject({
      id: "tdd-on",
      blockedInvalidCompletion: 1,
      finish: { pass: 0, blocked: 1 },
      metrics: {
        providerTokenTotal: { samples: 0, total: null, unavailable: 1 },
        readChars: { samples: 0, total: null, unavailable: 1 },
      },
    })
    expect(report.limitations.join("\n")).toContain("not token-saving or product-efficacy claims")
  })

  it("prints human A/B reports without writing dashboard files", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["evidence", "ab-report"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("# Persona A/B Evidence Report")
    expect(result.stdout).toContain("A/B reports aggregate local structured evidence only")
    expect(result.stdout).toContain("- none")
    expect(existsSync(join(projectDir, ".persona", "evidence", "ab-report.md"))).toBe(false)
  })
})
