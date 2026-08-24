import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { readInitManifest, sha256Bytes } from "../src/cli/init-manifest.js"
import { applyProjectAutoUpdate } from "../src/cli/project-auto-update.js"
import { mergePluginPath } from "../src/cli/init-source.js"
import { personaHarnessVersion } from "../src/cli/version.js"
import { createProjectAutoUpdateScheduler } from "../src/runtime/project-auto-update.js"

const projects: string[] = []

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-project-auto-update-"))
  projects.push(projectDir)
  return projectDir
}

function cli(projectDir: string, args: readonly string[]) {
  return runPersonaCli(args, {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readOpenCodeConfig(projectDir: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(join(projectDir, ".opencode", "opencode.json"), "utf8"))
  if (!isRecord(parsed)) {
    throw new Error("expected OpenCode config object")
  }
  return parsed
}

function configAndManifestBytes(projectDir: string): readonly [Buffer, Buffer] {
  return [
    readFileSync(join(projectDir, ".opencode", "opencode.json")),
    readFileSync(join(projectDir, ".persona", ".ph-init-manifest.json")),
  ]
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (condition()) {
      return
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  throw new Error("timed out waiting for project auto-update")
}

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

describe("ph update", () => {
  it("enables an owned project without changing unrelated OpenCode plugins", () => {
    const projectDir = createProject()
    mkdirSync(join(projectDir, ".opencode"), { recursive: true })
    writeFileSync(
      join(projectDir, ".opencode", "opencode.json"),
      `${JSON.stringify({ plugin: [["third-party-plugin", { mode: "strict" }]] }, null, 2)}\n`,
    )
    expect(cli(projectDir, ["init"]).status).toBe(0)

    const result = cli(projectDir, ["update", "enable", "--yes"])

    expect(result.status).toBe(0)
    expect(readOpenCodeConfig(projectDir).plugin).toEqual([
      ["third-party-plugin", { mode: "strict" }],
      [`persona-harness@${personaHarnessVersion()}`, { autoUpdate: true }],
    ])
    const manifest = readInitManifest(projectDir)
    expect(manifest?.files.find((entry) => entry.path === ".opencode/opencode.json")?.digest).toBe(
      sha256Bytes(readFileSync(join(projectDir, ".opencode", "opencode.json"))),
    )
  })

  it("reports the enabled project setting with a bounded JSON shape", () => {
    const projectDir = createProject()
    expect(cli(projectDir, ["init"]).status).toBe(0)
    expect(cli(projectDir, ["update", "enable", "--yes"]).status).toBe(0)

    const result = cli(projectDir, ["update", "status", "--json"])

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({
      configuredVersion: personaHarnessVersion(),
      schemaVersion: "project-auto-update.1",
      state: "enabled",
    })
  })

  it("advances only the active owned Persona Harness pin after a newer latest result", async () => {
    const projectDir = createProject()
    expect(cli(projectDir, ["init"]).status).toBe(0)
    expect(cli(projectDir, ["update", "enable", "--yes"]).status).toBe(0)

    const result = await applyProjectAutoUpdate({
      installedVersion: personaHarnessVersion(),
      projectDir,
      readLatestVersion: async () => ({ kind: "available", version: "9.9.9" }),
    })

    expect(result).toEqual({ kind: "updated", version: "9.9.9" })
    expect(readOpenCodeConfig(projectDir).plugin).toEqual([
      ["persona-harness@9.9.9", { autoUpdate: true }],
    ])
    const manifest = readInitManifest(projectDir)
    expect(manifest?.files.find((entry) => entry.path === ".opencode/opencode.json")?.digest).toBe(
      sha256Bytes(readFileSync(join(projectDir, ".opencode", "opencode.json"))),
    )
  })

  it("leaves the project untouched when the latest registry value is unavailable", async () => {
    const projectDir = createProject()
    expect(cli(projectDir, ["init"]).status).toBe(0)
    expect(cli(projectDir, ["update", "enable", "--yes"]).status).toBe(0)
    const before = configAndManifestBytes(projectDir)

    const result = await applyProjectAutoUpdate({
      installedVersion: personaHarnessVersion(),
      projectDir,
      readLatestVersion: async () => ({ kind: "unavailable" }),
    })

    expect(result).toEqual({ kind: "blocked", reason: "registry-unavailable" })
    expect(configAndManifestBytes(projectDir)).toEqual(before)
  })

  it("fails closed before the registry read when the owned OpenCode configuration changed", async () => {
    const projectDir = createProject()
    expect(cli(projectDir, ["init"]).status).toBe(0)
    expect(cli(projectDir, ["update", "enable", "--yes"]).status).toBe(0)
    const configPath = join(projectDir, ".opencode", "opencode.json")
    const changedConfig = Buffer.from(
      `${JSON.stringify({ plugin: ["persona-harness@0.0.1"] }, null, 2)}\n`,
      "utf8",
    )
    writeFileSync(configPath, changedConfig)
    let registryRead = false

    const result = await applyProjectAutoUpdate({
      installedVersion: personaHarnessVersion(),
      projectDir,
      readLatestVersion: async () => {
        registryRead = true
        return { kind: "available", version: "9.9.9" }
      },
    })

    expect(result).toEqual({ kind: "blocked", reason: "ownership-unavailable" })
    expect(registryRead).toBe(false)
    expect(readFileSync(configPath)).toEqual(changedConfig)
  })

  it("disables only the auto-update option and keeps the exact active pin", () => {
    const projectDir = createProject()
    expect(cli(projectDir, ["init"]).status).toBe(0)
    expect(cli(projectDir, ["update", "enable", "--yes"]).status).toBe(0)

    const result = cli(projectDir, ["update", "disable", "--yes"])

    expect(result.status).toBe(0)
    expect(readOpenCodeConfig(projectDir).plugin).toEqual([`persona-harness@${personaHarnessVersion()}`])
    expect(JSON.parse(cli(projectDir, ["update", "status", "--json"]).stdout)).toEqual({
      configuredVersion: personaHarnessVersion(),
      schemaVersion: "project-auto-update.1",
      state: "disabled",
    })
  })

  it("stages a newer exact pin from the session scheduler without hot-reloading the current session", async () => {
    const projectDir = createProject()
    expect(cli(projectDir, ["init"]).status).toBe(0)
    expect(cli(projectDir, ["update", "enable", "--yes"]).status).toBe(0)
    const scheduler = createProjectAutoUpdateScheduler({
      installedVersion: personaHarnessVersion(),
      readLatestVersion: async () => ({ kind: "available", version: "9.9.9" }),
    })

    scheduler.schedule(projectDir)
    await waitFor(() => readOpenCodeConfig(projectDir).plugin !== undefined
      && JSON.stringify(readOpenCodeConfig(projectDir).plugin).includes("persona-harness@9.9.9"))

    expect(readOpenCodeConfig(projectDir).plugin).toEqual([
      ["persona-harness@9.9.9", { autoUpdate: true }],
    ])
  })

  it("fails closed instead of treating a top-level plugin tuple as a plugin list", () => {
    const projectDir = createProject()
    mkdirSync(join(projectDir, ".opencode"), { recursive: true })
    const configPath = join(projectDir, ".opencode", "opencode.json")
    const invalidConfig = Buffer.from(
      `${JSON.stringify({ plugin: ["third-party-plugin", { mode: "strict" }] }, null, 2)}\n`,
      "utf8",
    )
    writeFileSync(configPath, invalidConfig)

    const result = cli(projectDir, ["init"])

    expect(result.status).toBe(1)
    expect(readFileSync(configPath)).toEqual(invalidConfig)
  })

  it("keeps auto-update attached to the active Persona Harness plugin when init advances its pin", () => {
    const merged = mergePluginPath(
      {
        plugin: [
          "persona-harness@9.9.9",
          ["persona-harness@0.8.27", { autoUpdate: true }],
        ],
      },
      "persona-harness@9.9.9",
    )

    expect(merged.plugin).toEqual([
      "persona-harness@9.9.9",
      ["persona-harness@0.8.27", { autoUpdate: true }],
      ["persona-harness@9.9.9", { autoUpdate: true }],
    ])
  })
})
