import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, realpathSync, symlinkSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { readContextPreview } from "../src/cli/context-preview.js"
import { loadHarnessConfigResult } from "../src/config/harness-config.js"
import { selectContextForTargets } from "../src/context-delivery/context-target-selection.js"
import { runPortableContextHook } from "../src/context-delivery/portable-context-hook.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

describe("Context config read boundary", () => {
  it("accepts a regular checkout config without following a linked replacement", () => {
    const projectDir = realpathSync(createProject())
    const options = { personalization: { storeRoot: join(projectDir, "personalization") } }
    writeHarnessConfig(projectDir, { context: { enabled: true } })
    expect(loadHarnessConfigResult(projectDir).safe).toBe(true)
    expect(selectContextForTargets(projectDir, ["src/TransferService.java"], options).status).toBe("selected")
  })

  it.each(["file", "directory"] as const)("blocks a symlinked config %s before Preview or portable delivery", (kind) => {
    const projectDir = realpathSync(createProject())
    const outside = realpathSync(createProject())
    const options = { personalization: { storeRoot: join(projectDir, "personalization") } }
    writeHarnessConfig(outside, { context: { enabled: true } })
    if (kind === "file") {
      mkdirSync(join(projectDir, ".persona"), { recursive: true })
      symlinkSync(join(outside, ".persona", "harness.jsonc"), join(projectDir, ".persona", "harness.jsonc"), "file")
    } else {
      symlinkSync(join(outside, ".persona"), join(projectDir, ".persona"), "dir")
    }
    expect.soft(loadHarnessConfigResult(projectDir).safe).toBe(false)
    expect.soft(readContextPreview(["src/TransferService.java"], projectDir, options))
      .toEqual({ status: "blocked", code: "context-config-unavailable" })
    expect.soft(selectContextForTargets(projectDir, ["src/TransferService.java"], options))
      .toEqual({ status: "blocked", reason: "preview-unavailable" })
    expect.soft(runPortableContextHook({
      hook_event_name: "PreToolUse", session_id: "config-boundary", cwd: projectDir,
      tool_name: "Edit", tool_input: { file_path: join(projectDir, "src", "TransferService.java") },
    }, projectDir, { ...options, host: "codex" }))
      .toEqual({ status: "blocked", reason: "preview-unavailable" })
  })

  it.each(["codex", "claude"] as const)("rejects a config symlink in the relocated %s runtime", (host) => {
    const projectDir = realpathSync(createProject())
    const outside = realpathSync(createProject())
    const pluginDir = realpathSync(createProject())
    writeHarnessConfig(outside, { context: { enabled: true } })
    mkdirSync(join(projectDir, ".persona"))
    symlinkSync(join(outside, ".persona/harness.jsonc"), join(projectDir, ".persona/harness.jsonc"), "file")
    const source = host === "codex"
      ? "packages/host-plugins/codex/plugins/persona-harness/scripts/context-runtime.mjs"
      : "packages/host-plugins/claude/scripts/context-runtime.mjs"
    const runtime = join(pluginDir, "context-runtime.mjs")
    copyFileSync(join(process.cwd(), source), runtime)
    const result = spawnSync(process.execPath, [runtime, "--host", host], {
      cwd: projectDir, encoding: "utf8", timeout: 10_000,
      env: { PATH: process.env.PATH ?? "", PH_HOME: join(projectDir, "personalization") },
      input: JSON.stringify({
        hook_event_name: "PreToolUse", session_id: "config-boundary", cwd: projectDir,
        tool_name: "Edit", tool_input: { file_path: join(projectDir, "src/TransferService.java") },
      }),
    })
    expect(result).toMatchObject({ status: 1, stdout: "", stderr: "Persona Harness Context blocked: preview-unavailable\n" })
  })
})
