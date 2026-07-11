import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-doctor-reachability-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeProjectFile(projectDir: string, relativePath: string, content: string): void {
  const filePath = join(projectDir, relativePath)
  mkdirSync(join(filePath, ".."), { recursive: true })
  writeFileSync(filePath, content)
}

function writeHarnessConfig(projectDir: string, executeVerification: boolean): void {
  writeProjectFile(
    projectDir,
    ".persona/harness.jsonc",
    `${JSON.stringify({ enforce: { executeVerification } }, null, 2)}\n`,
  )
}

function writePluginConfig(projectDir: string): void {
  writeProjectFile(
    projectDir,
    ".opencode/opencode.json",
    `${JSON.stringify({ plugin: ["node_modules/persona-harness/dist/index.js"] }, null, 2)}\n`,
  )
}

function writeManagedAgents(projectDir: string): void {
  writeProjectFile(
    projectDir,
    "AGENTS.md",
    [
      "<!-- persona-harness:agents:start schema=persona-harness.agents.v1 -->",
      "# Persona Harness Agent Instructions",
      "",
      "- Run `npx ph workflow implement` before implementation.",
      "- Run `npx ph workflow finish implement` before claiming completion.",
      "<!-- persona-harness:agents:end -->",
      "",
    ].join("\n"),
  )
}

function doctor(projectDir: string) {
  return runPersonaCli(["doctor"], {
    cwd: projectDir,
    env: {
      PH_DOCTOR_OPENCODE_VERSION: "1.0.0-test",
      PH_DOCTOR_REGISTRY_DIST_TAGS: JSON.stringify({ latest: "0.6.0" }),
    },
    invocationName: "ph",
  })
}

function lineCount(output: string, prefix: string): number {
  return output.split("\n").filter((line) => line.startsWith(prefix)).length
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph doctor session reachability", () => {
  it("blocks with one actionable command when AGENTS.md is missing", () => {
    const projectDir = createTempProject()
    writePluginConfig(projectDir)
    writeHarnessConfig(projectDir, true)

    const result = doctor(projectDir)

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("Session reachability: BLOCK")
    expect(result.stdout).toContain("AGENTS.md steering: missing")
    expect(lineCount(result.stdout, "Next action:")).toBe(1)
    expect(lineCount(result.stdout, "Next command:")).toBe(1)
    expect(result.stdout).toContain("Next command: npx ph bootstrap backend")
  })

  it("reports the markerless bootstrap body as legacy observed", () => {
    const projectDir = createTempProject()
    writePluginConfig(projectDir)
    writeHarnessConfig(projectDir, true)
    writeProjectFile(
      projectDir,
      "AGENTS.md",
      [
        "# Persona Harness Agent Instructions",
        "",
        "Before implementation:",
        "- Run `npx ph workflow implement` and follow the single AI-facing rail.",
        "",
        "After implementation:",
        "- Run `npx ph workflow finish implement` before claiming completion.",
        "",
      ].join("\n"),
    )

    const result = doctor(projectDir)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Session reachability: WARN")
    expect(result.stdout).toContain("AGENTS.md steering: legacy observed")
    expect(lineCount(result.stdout, "Next action:")).toBe(0)
    expect(lineCount(result.stdout, "Next command:")).toBe(0)
  })

  it("blocks honestly when project-local plugin registration is not observed", () => {
    const projectDir = createTempProject()
    writeManagedAgents(projectDir)
    writeHarnessConfig(projectDir, true)
    writeProjectFile(projectDir, ".opencode/opencode.json", `${JSON.stringify({ plugin: [] }, null, 2)}\n`)

    const result = doctor(projectDir)

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("Session reachability: BLOCK")
    expect(result.stdout).toContain("Project-local OpenCode plugin registration: not observed")
    expect(result.stdout).not.toContain("OpenCode plugin is unregistered")
    expect(lineCount(result.stdout, "Next action:")).toBe(1)
    expect(lineCount(result.stdout, "Next command:")).toBe(1)
    expect(result.stdout).toContain("after completing the action, run npx ph doctor")
  })

  it("warns without unsafe remediation when PH-run verification is off", () => {
    const projectDir = createTempProject()
    writeManagedAgents(projectDir)
    writePluginConfig(projectDir)
    writeHarnessConfig(projectDir, false)

    const result = doctor(projectDir)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Session reachability: WARN")
    expect(result.stdout).toContain("PH-run verification OFF — evidence-only mode, TDD rail advisory")
    expect(result.stdout).not.toContain("--strict")
    expect(lineCount(result.stdout, "Next action:")).toBe(0)
    expect(lineCount(result.stdout, "Next command:")).toBe(0)
  })

  it("prioritizes one follow-up when multiple reachability blockers exist", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir, false)
    writeProjectFile(projectDir, ".opencode/opencode.json", `${JSON.stringify({ plugin: [] }, null, 2)}\n`)

    const result = doctor(projectDir)

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("AGENTS.md steering: missing")
    expect(result.stdout).toContain("Project-local OpenCode plugin registration: not observed")
    expect(result.stdout).toContain("PH-run verification OFF — evidence-only mode, TDD rail advisory")
    expect(lineCount(result.stdout, "Next action:")).toBe(1)
    expect(lineCount(result.stdout, "Next command:")).toBe(1)
    expect(result.stdout).toContain("Next command: npx ph bootstrap backend")
  })

  it("blocks a managed document that also contains a partial marker", () => {
    const projectDir = createTempProject()
    writePluginConfig(projectDir)
    writeHarnessConfig(projectDir, true)
    writeManagedAgents(projectDir)
    const agentsPath = join(projectDir, "AGENTS.md")
    writeFileSync(
      agentsPath,
      `${readFileSync(agentsPath, "utf8")}<!-- persona-harness:agents:start schema=persona-harness.agents.v2 -->\n`,
    )

    const result = doctor(projectDir)

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("AGENTS.md steering: corrupt")
    expect(lineCount(result.stdout, "Next action:")).toBe(1)
    expect(lineCount(result.stdout, "Next command:")).toBe(1)
  })
})
