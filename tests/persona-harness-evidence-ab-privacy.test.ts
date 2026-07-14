import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const projects: string[] = []

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-evidence-ab-privacy-"))
  projects.push(projectDir)
  return projectDir
}

function evidenceFiles(projectDir: string): readonly string[] {
  const evidenceDir = join(projectDir, ".persona", "evidence", "ab")
  if (!existsSync(evidenceDir)) {
    return []
  }
  return readdirSync(evidenceDir, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".json"))
    .map((entry) => join(evidenceDir, entry))
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { recursive: true, force: true })
  }
})

describe("A/B evidence privacy", () => {
  it("stores command identity without persisting raw argv", () => {
    const projectDir = createProject()
    const secret = ["sk", "live", "A".repeat(24)].join("-")

    const result = runPersonaCli([
      "evidence",
      "ab-run",
      "--scenario",
      "privacy",
      "--condition",
      "default",
      "--",
      process.execPath,
      "-e",
      "process.exit(0)",
      secret,
    ], { cwd: projectDir, env: {}, invocationName: "ph" })

    const path = evidenceFiles(projectDir)[0]
    if (path === undefined) {
      throw new Error("expected A/B evidence")
    }
    const source = readFileSync(path, "utf8")
    const parsed: unknown = JSON.parse(source)
    const conditions = isRecord(parsed) && Array.isArray(parsed["conditions"])
      ? parsed["conditions"]
      : []
    const runs = isRecord(conditions[0]) && Array.isArray(conditions[0]["runs"])
      ? conditions[0]["runs"]
      : []
    const run = runs[0]
    expect(result.status).toBe(0)
    expect(source.includes(secret)).toBe(false)
    expect(isRecord(run) && run["command"] === undefined && isRecord(run["commandSummary"])).toBe(true)
  })
})
