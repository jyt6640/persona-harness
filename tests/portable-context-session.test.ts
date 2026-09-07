import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as harnessConfig from "../src/config/harness-config.js"
import { runPortableContextHook } from "../src/context-delivery/portable-context-hook.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(() => { vi.restoreAllMocks(); cleanupProjects() })

describe("portable first-use and resume guidance", () => {
  it.each([undefined, {}, { context: { enabled: true } }])("includes an opaque task handle within the default complete guidance bound: %j", (settings) => {
    const projectDir = realpathSync(createProject())
    if (settings !== undefined) writeHarnessConfig(projectDir, settings)
    const configPath = join(projectDir, ".persona/harness.jsonc")
    const before = existsSync(configPath) ? readFileSync(configPath) : undefined

    const result = runPortableContextHook({ session_id: "private-session-id", hook_event_name: "SessionStart", cwd: projectDir }, projectDir, {
      host: "codex", setupScript: `/installed/${"a".repeat(160)}/scripts/context-setup.mjs`,
    })

    expect(result).toMatchObject({ status: "offered", kind: "guidance", selection: { ruleIds: [] } })
    if (result.status !== "offered") throw new Error(`expected complete guidance: ${result.reason}`)
    expect(result.selection.usedChars).toBe(result.output.hookSpecificOutput.additionalContext.length)
    expect(result.selection.usedChars).toBeLessThanOrEqual(1_600)
    expect(result.output.hookSpecificOutput.additionalContext).not.toContain("private-session-id")
    expect(existsSync(configPath) ? readFileSync(configPath) : undefined).toEqual(before)
  })

  it.each([undefined, {}, { context: { enabled: true } }])("does not offer guidance from a config changed to opt-out during inspection", (initial) => {
    const projectDir = realpathSync(createProject())
    if (initial !== undefined) writeHarnessConfig(projectDir, initial)
    const load = harnessConfig.loadHarnessConfigResult
    const spy = vi.spyOn(harnessConfig, "loadHarnessConfigResult").mockImplementation((root, boundary) => {
      const result = load(root, boundary)
      writeHarnessConfig(projectDir, { context: { enabled: false } })
      return result
    })
    const input = { session_id: "changing", hook_event_name: "SessionStart", cwd: projectDir }
    expect(runPortableContextHook(input, projectDir, { setupScript: "/installed/scripts/context-setup.mjs" }))
      .toEqual({ status: "blocked", reason: "preview-unavailable" })
    spy.mockRestore()
    expect(runPortableContextHook(input, projectDir)).toEqual({ status: "skipped", reason: "context-disabled" })
    expect(JSON.parse(readFileSync(join(projectDir, ".persona/harness.jsonc"), "utf8"))).toMatchObject({ context: { enabled: false } })
  })

  it.each([{}, { context: { mode: "targeted", maxCapsules: 4 } }])("offers consent for an existing config with no personalization decision", (settings) => {
    const projectDir = realpathSync(createProject())
    mkdirSync(join(projectDir, ".persona"), { recursive: true })
    const config = join(projectDir, ".persona/harness.jsonc")
    const before = `// Keep this user comment.\n${JSON.stringify({ features: { runtimeInjection: false }, ...settings }, null, 2)}\n`
    writeFileSync(config, before)
    const result = runPortableContextHook({ session_id: "legacy", hook_event_name: "SessionStart", cwd: projectDir, source: "startup" }, projectDir, { setupScript: "/installed/scripts/context-setup.mjs" })
    expect(result).toMatchObject({ status: "offered", kind: "guidance", selection: { warningCodes: ["context-setup-required"] } })
    if (result.status !== "offered") throw new Error(`fixture not offered: ${result.reason}`)
    expect(result.output.hookSpecificOutput.additionalContext).toContain("context.enabled")
    expect(result.output.hookSpecificOutput.additionalContext).not.toContain("context init --enable")
    expect(readFileSync(config, "utf8")).toBe(before)
  })

  it("does not treat a globally disabled harness as unconfigured personalization", () => {
    const projectDir = realpathSync(createProject())
    writeHarnessConfig(projectDir, { enabled: false })
    expect(runPortableContextHook({ session_id: "disabled", hook_event_name: "SessionStart", cwd: projectDir }, projectDir))
      .toEqual({ status: "skipped", reason: "context-disabled" })
  })

  it("offers bounded first-use guidance without writing or granting consent", () => {
    const projectDir = realpathSync(createProject())
    const result = runPortableContextHook({ session_id: "new", hook_event_name: "SessionStart", cwd: projectDir, source: "startup" }, projectDir, { setupScript: "/installed plugin/scripts/context-setup.mjs" })
    if (result.status !== "offered") throw new Error(`fixture not offered: ${result.reason}`)
    expect(result.kind).toBe("guidance")
    expect(result.selection.ruleIds).toEqual([])
    expect(result.selection.warningCodes).toEqual(["context-setup-required"])
    expect(result.selection.usedChars).toBe(result.output.hookSpecificOutput.additionalContext.length)
    expect(result.selection.usedChars).toBeLessThanOrEqual(1_600)
    expect(existsSync(join(projectDir, ".persona/harness.jsonc"))).toBe(false)
  })

  it("honors existing opt-out on startup, resume and compaction without repeating setup", () => {
    const projectDir = realpathSync(createProject())
    writeHarnessConfig(projectDir, { context: { enabled: false }, features: { runtimeInjection: true } })
    const config = join(projectDir, ".persona/harness.jsonc")
    const before = readFileSync(config)
    for (const source of ["startup", "resume", "compact"]) {
      expect(runPortableContextHook({ session_id: "existing", hook_event_name: "SessionStart", cwd: projectDir, source }, projectDir))
        .toEqual({ status: "skipped", reason: "context-disabled" })
    }
    expect(readFileSync(config)).toEqual(before)
  })

  it("refreshes approved-task guidance after resume without claiming profile delivery", () => {
    const projectDir = realpathSync(createProject())
    writeHarnessConfig(projectDir, { context: { enabled: true } })
    const result = runPortableContextHook({ session_id: "existing", hook_event_name: "SessionStart", cwd: projectDir, source: "resume" }, projectDir)
    expect(result).toMatchObject({ status: "offered", kind: "guidance", selection: { ruleIds: [], warningCodes: [] } })
  })

  it("blocks the whole guidance when its complete output exceeds the configured budget", () => {
    const projectDir = realpathSync(createProject())
    writeHarnessConfig(projectDir, { context: { enabled: true, maxChars: 1 } })
    expect(runPortableContextHook({ session_id: "small", hook_event_name: "SessionStart", cwd: projectDir }, projectDir))
      .toEqual({ status: "blocked", reason: "budget-exceeded" })
  })
})
