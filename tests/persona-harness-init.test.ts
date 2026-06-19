import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { initializePersonaHarness } from "../src/cli/init.js"

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
    expect(existsSync(join(projectDir, ".persona", "rules", "backend", "java-common.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "evidence"))).toBe(false)
    expect(existsSync(join(projectDir, ".opencode", "opencode.json"))).toBe(true)
    expect(result.installed).toEqual(
      expect.arrayContaining([".persona/harness.jsonc", ".persona/rules/", ".opencode/opencode.json"]),
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
})
