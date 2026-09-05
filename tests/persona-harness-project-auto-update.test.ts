import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import {
  createInitManifest,
  readInitManifest,
  serializeInitManifest,
  sha256Bytes,
} from "../src/cli/init-manifest.js"
import { applyProjectAutoUpdate, runProjectAutoUpdateCommand } from "../src/cli/project-auto-update.js"
import { mergePluginPath } from "../src/cli/init-source.js"
import { personaHarnessVersion } from "../src/cli/version.js"
import { createProjectAutoUpdateScheduler } from "../src/runtime/project-auto-update.js"

const projects: string[] = []
const [currentMajor = "0", currentMinor = "0"] = personaHarnessVersion().split(".")
const nextMinorVersion = `${currentMajor}.${BigInt(currentMinor) + 1n}.0`
const nextMajorVersion = `${BigInt(currentMajor) + 1n}.0.0`

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

function writeLegacyAttachedProject(projectDir: string): void {
  expect(cli(projectDir, ["init"]).status).toBe(0)
  const legacyPackageRoot = join(realpathSync(projectDir), "legacy-persona-harness")
  mkdirSync(join(legacyPackageRoot, "dist"), { recursive: true })
  writeFileSync(
    join(legacyPackageRoot, "package.json"),
    `${JSON.stringify({ name: "persona-harness", version: personaHarnessVersion() }, null, 2)}\n`,
  )
  writeFileSync(join(legacyPackageRoot, "dist", "index.js"), "export {}\n")
  writeFileSync(
    join(projectDir, ".opencode", "opencode.json"),
    `${JSON.stringify({
      mcp: { context7: { type: "remote", url: "https://mcp.context7.com/mcp" } },
      plugin: [
        ["third-party-plugin", { mode: "strict" }],
        join(legacyPackageRoot, "dist", "index.js"),
      ],
    }, null, 2)}\n`,
  )
  writeFileSync(join(projectDir, ".gitignore"), "# project-owned ignore\n")
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), "{\n  \"runtimeInjection\": true\n}\n")

  const manifest = readInitManifest(projectDir)
  if (manifest === null) {
    throw new Error("expected init manifest")
  }
  const staleManifest = createInitManifest(
    manifest.package,
    {
      profileDigest: null,
      realPath: join(realpathSync(tmpdir()), "persona-attach-stage-legacy"),
    },
    manifest.files,
  )
  writeFileSync(
    join(projectDir, ".persona", ".ph-init-manifest.json"),
    serializeInitManifest(staleManifest),
  )
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
  it("explicitly recovers a bounded legacy attach before enabling auto-update", () => {
    const projectDir = createProject()
    writeLegacyAttachedProject(projectDir)
    const gitignorePath = join(projectDir, ".gitignore")
    const harnessPath = join(projectDir, ".persona", "harness.jsonc")
    const beforeGitignore = readFileSync(gitignorePath)
    const beforeHarness = readFileSync(harnessPath)

    const repair = cli(projectDir, ["update", "repair", "--yes"])

    expect(repair.status).toBe(0)
    expect(readOpenCodeConfig(projectDir)).toEqual({
      mcp: { context7: { type: "remote", url: "https://mcp.context7.com/mcp" } },
      plugin: [
        ["third-party-plugin", { mode: "strict" }],
        `persona-harness@${personaHarnessVersion()}`,
      ],
    })
    expect(readFileSync(gitignorePath)).toEqual(beforeGitignore)
    expect(readFileSync(harnessPath)).toEqual(beforeHarness)
    const manifest = readInitManifest(projectDir)
    expect(manifest?.project.realPath).toBe(realpathSync(projectDir))
    expect(manifest?.project.profileDigest).toBeNull()
    expect(manifest?.files.some((entry) => entry.path === ".opencode/opencode.json")).toBe(true)
    expect(manifest?.files.some((entry) => entry.path === ".gitignore")).toBe(false)
    expect(manifest?.files.some((entry) => entry.path === ".persona/harness.jsonc")).toBe(false)
    expect(manifest?.files.find((entry) => entry.path === ".opencode/opencode.json")?.digest).toBe(
      sha256Bytes(readFileSync(join(projectDir, ".opencode", "opencode.json"))),
    )

    expect(cli(projectDir, ["update", "enable", "--yes"]).status).toBe(0)
    expect(readOpenCodeConfig(projectDir).plugin).toEqual([
      ["third-party-plugin", { mode: "strict" }],
      [`persona-harness@${personaHarnessVersion()}`, { autoUpdate: true }],
    ])
  })

  it("fails closed without changing a non-legacy project", () => {
    const projectDir = createProject()
    expect(cli(projectDir, ["init"]).status).toBe(0)
    const before = configAndManifestBytes(projectDir)

    const repair = cli(projectDir, ["update", "repair", "--yes"])

    expect(repair.status).toBe(1)
    expect(repair.stderr).toContain("ownership-unavailable")
    expect(configAndManifestBytes(projectDir)).toEqual(before)
  })

  it("fails closed without changing malformed legacy ownership state", () => {
    const projectDir = createProject()
    writeLegacyAttachedProject(projectDir)
    const manifestPath = join(projectDir, ".persona", ".ph-init-manifest.json")
    const configPath = join(projectDir, ".opencode", "opencode.json")
    writeFileSync(manifestPath, "{ malformed\n")
    const beforeConfig = readFileSync(configPath)
    const beforeManifest = readFileSync(manifestPath)

    const repair = cli(projectDir, ["update", "repair", "--yes"])

    expect(repair.status).toBe(1)
    expect(repair.stderr).toContain("ownership-unavailable")
    expect(readFileSync(configPath)).toEqual(beforeConfig)
    expect(readFileSync(manifestPath)).toEqual(beforeManifest)
  })

  it.skipIf(process.platform === "win32")("fails closed without changing a legacy project with a symlinked plugin", () => {
    const projectDir = createProject()
    writeLegacyAttachedProject(projectDir)
    const configPath = join(projectDir, ".opencode", "opencode.json")
    const manifestPath = join(projectDir, ".persona", ".ph-init-manifest.json")
    const legacyPluginPath = join(realpathSync(projectDir), "legacy-persona-harness", "dist", "index.js")
    const outsidePluginPath = join(realpathSync(projectDir), "outside-plugin.js")
    writeFileSync(outsidePluginPath, "export {}\n")
    rmSync(legacyPluginPath)
    symlinkSync(outsidePluginPath, legacyPluginPath)
    const beforeConfig = readFileSync(configPath)
    const beforeManifest = readFileSync(manifestPath)

    const repair = cli(projectDir, ["update", "repair", "--yes"])

    expect(repair.status).toBe(1)
    expect(repair.stderr).toContain("ownership-unavailable")
    expect(readFileSync(configPath)).toEqual(beforeConfig)
    expect(readFileSync(manifestPath)).toEqual(beforeManifest)
  })

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

  it("advances only the active owned Persona Harness pin after a newer same-major result", async () => {
    const projectDir = createProject()
    expect(cli(projectDir, ["init"]).status).toBe(0)
    expect(cli(projectDir, ["update", "enable", "--yes"]).status).toBe(0)

    const result = await applyProjectAutoUpdate({
      installedVersion: personaHarnessVersion(),
      projectDir,
      readLatestVersion: async () => ({ kind: "available", version: nextMinorVersion }),
    })

    expect(result).toEqual({ kind: "updated", version: nextMinorVersion })
    expect(readOpenCodeConfig(projectDir).plugin).toEqual([
      [`persona-harness@${nextMinorVersion}`, { autoUpdate: true }],
    ])
    const manifest = readInitManifest(projectDir)
    expect(manifest?.files.find((entry) => entry.path === ".opencode/opencode.json")?.digest).toBe(
      sha256Bytes(readFileSync(join(projectDir, ".opencode", "opencode.json"))),
    )
  })

  it("blocks an automatic major update without changing config or ownership", async () => {
    const projectDir = createProject()
    expect(cli(projectDir, ["init"]).status).toBe(0)
    expect(cli(projectDir, ["update", "enable", "--yes"]).status).toBe(0)
    const before = configAndManifestBytes(projectDir)

    const result = await applyProjectAutoUpdate({
      installedVersion: personaHarnessVersion(),
      projectDir,
      readLatestVersion: async () => ({ kind: "available", version: nextMajorVersion }),
    })

    expect(result).toEqual({ kind: "blocked", reason: "major-approval-required" })
    expect(configAndManifestBytes(projectDir)).toEqual(before)
  })

  it("requires explicit confirmation to apply a selected new major without replacing user rules", () => {
    const projectDir = createProject()
    expect(cli(projectDir, ["init"]).status).toBe(0)
    const packageRoot = createProject()
    writeFileSync(join(packageRoot, "package.json"), JSON.stringify({ name: "persona-harness", version: nextMajorVersion }))
    const customRulePath = join(projectDir, ".persona", "custom-rule.md")
    writeFileSync(customRulePath, "Keep domain classes separate.\n")
    const before = configAndManifestBytes(projectDir)

    const unconfirmed = runProjectAutoUpdateCommand(["enable"], { packageRoot, projectDir })

    expect(unconfirmed.status).toBe(1)
    expect(configAndManifestBytes(projectDir)).toEqual(before)

    const confirmed = runProjectAutoUpdateCommand(["enable", "--yes"], { packageRoot, projectDir })

    expect(confirmed.status).toBe(0)
    expect(readOpenCodeConfig(projectDir).plugin).toEqual([
      [`persona-harness@${nextMajorVersion}`, { autoUpdate: true }],
    ])
    expect(readFileSync(customRulePath, "utf8")).toBe("Keep domain classes separate.\n")
    expect(readInitManifest(projectDir)?.files.find((entry) => entry.path === ".opencode/opencode.json")?.digest).toBe(
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
      readLatestVersion: async () => ({ kind: "available", version: nextMinorVersion }),
    })

    scheduler.schedule(projectDir)
    await waitFor(() => readOpenCodeConfig(projectDir).plugin !== undefined
      && JSON.stringify(readOpenCodeConfig(projectDir).plugin).includes(`persona-harness@${nextMinorVersion}`))

    expect(readOpenCodeConfig(projectDir).plugin).toEqual([
      [`persona-harness@${nextMinorVersion}`, { autoUpdate: true }],
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
