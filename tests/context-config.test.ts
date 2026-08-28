import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  DEFAULT_CONTEXT_CONFIG,
  isContextPersonalizationEnabled,
  loadHarnessConfig,
  loadHarnessConfigResult,
} from "../src/config/harness-config.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

const repositoryRoot = resolve(process.cwd())

describe("Context configuration", () => {
  it("defaults to a disabled targeted Context budget without rewriting the project config", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { features: { runtimeInjection: true } })
    const configPath = `${projectDir}/.persona/harness.jsonc`
    const before = readFileSync(configPath, "utf8")

    const result = loadHarnessConfigResult(projectDir)

    expect(result.config.context).toEqual(DEFAULT_CONTEXT_CONFIG)
    expect(result.contextDiagnostics).toEqual([])
    expect(isContextPersonalizationEnabled(result)).toBe(false)
    expect(readFileSync(configPath, "utf8")).toBe(before)
  })

  it("loads an explicit targeted Context opt-in with bounded custom budgets", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, {
      context: {
        enabled: true,
        maxCapsules: 4,
        maxChars: 900,
        mode: "targeted",
      },
    })

    const result = loadHarnessConfigResult(projectDir)

    expect(result.config.context).toEqual({
      enabled: true,
      maxCapsules: 4,
      maxChars: 900,
      mode: "targeted",
    })
    expect(result.contextDiagnostics).toEqual([])
    expect(isContextPersonalizationEnabled(result)).toBe(true)
  })

  it("does not infer Context enablement from legacy guidance switches", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, {
      features: {
        projectPhilosophyInjection: true,
        runtimeInjection: true,
      },
    })

    const result = loadHarnessConfigResult(projectDir)

    expect(result.config.features.runtimeInjection).toBe(true)
    expect(result.config.features.projectPhilosophyInjection).toBe(true)
    expect(result.config.context.enabled).toBe(false)
    expect(isContextPersonalizationEnabled(result)).toBe(false)
  })

  it("keeps Context disabled when the harness itself is disabled", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { enabled: false, context: { enabled: true } })

    expect(isContextPersonalizationEnabled(loadHarnessConfigResult(projectDir))).toBe(false)
  })

  it.each([
    ["unknown key", { context: { enabled: true, unexpected: true } }],
    ["unsupported mode", { context: { enabled: true, mode: "broad" } }],
    ["invalid budget", { context: { enabled: true, maxCapsules: 17 } }],
    ["wrong scalar type", { context: { enabled: "true" } }],
  ])("fails closed for %s without disabling the legacy harness", (_label, input) => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, input)

    const result = loadHarnessConfigResult(projectDir)

    expect(result.safe).toBe(true)
    expect(result.diagnostics).toEqual([])
    expect(result.config.enabled).toBe(true)
    expect(result.config.context).toEqual(DEFAULT_CONTEXT_CONFIG)
    expect(result.contextDiagnostics).toEqual([
      {
        code: "context-config-invalid",
        message: "Context configuration is invalid; Context remains disabled.",
      },
    ])
    expect(isContextPersonalizationEnabled(result)).toBe(false)
  })

  it("keeps the existing loadHarnessConfig convenience result compatible", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { context: { enabled: true } })

    expect(loadHarnessConfig(projectDir).context).toEqual({
      enabled: true,
      maxCapsules: 8,
      maxChars: 1_600,
      mode: "targeted",
    })
  })

  it("keeps Context configuration parsing free of host, filesystem, and process effects", () => {
    const source = readFileSync(resolve(repositoryRoot, "src/config/context-config.ts"), "utf8")

    expect(source).not.toContain("node:")
    expect(source).not.toMatch(/\b(?:exec|spawn|fetch)\b/u)
    expect(source).not.toMatch(/(?:writeFile|mkdir|rmSync|unlink)/u)
  })
})
