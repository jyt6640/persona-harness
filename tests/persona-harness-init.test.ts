import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { formatInitNonInteractiveInterviewMessage, formatInitResult, initializePersonaHarness } from "../src/cli/init.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-init-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function readOpencodeConfig(projectDir: string): unknown {
  return JSON.parse(readFileSync(join(projectDir, ".opencode", "opencode.json"), "utf8"))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("persona-harness init", () => {
  it("installs the Persona template and OpenCode plugin config without copying evidence", () => {
    const projectDir = createTempProject()

    const result = initializePersonaHarness({ projectDir, packageRoot: process.cwd() })

    expect(existsSync(join(projectDir, ".persona", "harness.jsonc"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "conventions", "controller-persistence-import.yml"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "rules", "backend", "java-common.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "rules", "diff-rules"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "rules", "backend", "step1-api-contract.md"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "rules", "backend", "step2-3-api-contract.md"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "project-profile.jsonc"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "evidence"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "workflow", "plan.md"))).toBe(false)
    expect(existsSync(join(projectDir, ".opencode", "opencode.json"))).toBe(true)
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(false)
    expect(readFileSync(join(projectDir, ".gitignore"), "utf8")).toContain("node_modules/")
    expect(readFileSync(join(projectDir, ".gitignore"), "utf8")).toContain(".opencode/node_modules/")
    expect(readFileSync(join(projectDir, ".gitignore"), "utf8")).toContain(".persona/rules/")
    expect(readFileSync(join(projectDir, ".gitignore"), "utf8")).toContain(".persona/evidence/")
    expect(result.installed).toEqual(
      expect.arrayContaining([
        ".persona/harness.jsonc",
        ".persona/conventions/",
        ".persona/rules/",
        ".opencode/opencode.json",
        ".gitignore",
      ]),
    )
    expect(result.evidenceCopied).toBe(false)

    const config = readOpencodeConfig(projectDir)
    expect(isRecord(config)).toBe(true)
    if (!isRecord(config)) {
      return
    }
    expect(config.plugin).toEqual([join(process.cwd(), "dist", "index.js")])
  })

  it("preserves an existing OpenCode config while adding the Persona plugin path once", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".opencode"), { recursive: true })
    writeFileSync(
      join(projectDir, ".opencode", "opencode.json"),
      `${JSON.stringify({ model: "openai/gpt-5.4-mini-fast", plugin: ["/tmp/existing-plugin.js"] }, null, 2)}\n`,
    )

    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })
    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })

    const config = readOpencodeConfig(projectDir)
    expect(isRecord(config)).toBe(true)
    if (!isRecord(config)) {
      return
    }
    expect(config.model).toBe("openai/gpt-5.4-mini-fast")
    expect(config.plugin).toEqual(["/tmp/existing-plugin.js", join(process.cwd(), "dist", "index.js")])
    expect(existsSync(join(projectDir, ".persona", "evidence"))).toBe(false)
  })

  it("preserves existing gitignore entries and does not duplicate noise guard entries", () => {
    const projectDir = createTempProject()
    writeFileSync(join(projectDir, ".gitignore"), "custom-output/\nnode_modules/\n")

    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })
    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })

    const gitignore = readFileSync(join(projectDir, ".gitignore"), "utf8")
    const lines = gitignore.split(/\r?\n/)
    expect(gitignore).toContain("custom-output/")
    expect(lines.filter((line) => line === "node_modules/")).toHaveLength(1)
    expect(lines.filter((line) => line === ".opencode/node_modules/")).toHaveLength(1)
    expect(lines.filter((line) => line === ".persona/rules/")).toHaveLength(1)
    expect(lines.filter((line) => line === ".persona/evidence/")).toHaveLength(1)
  })

  it("prints an init-only next flow that matches the files it creates", () => {
    const result = formatInitResult({
      projectDir: "/tmp/project",
      packageRoot: process.cwd(),
      pluginPath: join(process.cwd(), "dist", "index.js"),
      installed: [".persona/harness.jsonc", ".persona/conventions/", ".persona/rules/", ".opencode/opencode.json"],
      backups: [],
      evidenceCopied: false,
    })

    expect(result).toContain("`ph init` installs Persona Harness config/conventions/rules and OpenCode plugin config only.")
    expect(result).toContain("It does not create `AGENTS.md`, `.persona/project-profile.jsonc`, or workflow plan/report templates.")
    expect(result).toContain("Do not enter implementation before the backend project profile exists.")
    expect(result).toContain("npx ph bootstrap backend")
    expect(result).toContain("npx ph intake --interactive")
    expect(result).toContain("npx ph intake --default backend")
    expect(result).toContain("npx ph policy init")
    expect(result).toContain("npx ph plan --auto-accept")
    expect(result).toContain("opencode")
    expect(result).toContain("TUI")
    expect(result).toContain("$(npx ph plan --prompt)")
    expect(result).not.toContain("starts the backend profile interview")
    expect(result).not.toContain("요구사항 전체를 Gradle 기반 Spring 백엔드로 구현해줘")
  })

  it("explains the AI/non-TTY bootstrap path without creating a default profile", () => {
    const result = formatInitNonInteractiveInterviewMessage("ph")

    expect(result).toContain("interactive terminal")
    expect(result).toContain("npx ph init")
    expect(result).toContain("npx ph bootstrap backend")
    expect(result).toContain("No default profile was created")
  })
})
