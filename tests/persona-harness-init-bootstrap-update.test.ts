import {
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { loadHarnessConfig } from "../src/config/harness-config.js"
import { mergeBootstrapHarnessOptIns } from "../src/cli/init-harness-overlay.js"
import { runPersonaCli } from "../src/cli/index.js"
import { readInitManifest, sha256Bytes } from "../src/cli/init-manifest.js"

const tempDirectories: string[] = []

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-init-bootstrap-update-"))
  tempDirectories.push(projectDir)
  return projectDir
}

function createJavaProject(): string {
  const projectDir = createProject()
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'tasks'\n")
  writeFileSync(
    join(projectDir, "build.gradle"),
    "plugins { id 'java'; id 'org.springframework.boot' version '3.5.0' }\n",
  )
  const sourceDir = join(projectDir, "src", "main", "java", "com", "example", "tasks")
  mkdirSync(sourceDir, { recursive: true })
  writeFileSync(join(sourceDir, "TasksApplication.java"), "package com.example.tasks;\n")
  return projectDir
}

function createPackageRoot(version: string, maxRulesPerInjection: number): string {
  const packageRoot = mkdtempSync(join(tmpdir(), "persona-init-bootstrap-package-"))
  tempDirectories.push(packageRoot)
  const sourcePersona = join(process.cwd(), ".persona")
  cpSync(sourcePersona, join(packageRoot, ".persona"), {
    filter: (source) => relative(sourcePersona, source) !== "evidence",
    recursive: true,
  })
  cpSync(
    join(process.cwd(), "packages", "shared-skills"),
    join(packageRoot, "packages", "shared-skills"),
    { recursive: true },
  )
  const packageJson: unknown = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"))
  if (!isRecord(packageJson)) throw new TypeError("package.json must be an object")
  writeFileSync(join(packageRoot, "package.json"), `${JSON.stringify({ ...packageJson, version }, null, 2)}\n`)
  const harnessPath = join(packageRoot, ".persona", "harness.jsonc")
  const harness: unknown = JSON.parse(readFileSync(harnessPath, "utf8"))
  if (!isRecord(harness)) throw new TypeError("harness template must be an object")
  writeFileSync(harnessPath, `${JSON.stringify({ ...harness, maxRulesPerInjection }, null, 2)}\n`)
  mkdirSync(join(packageRoot, "dist"), { recursive: true })
  writeFileSync(join(packageRoot, "dist", "index.js"), "// synthetic plugin\n")
  return packageRoot
}

function cli(projectDir: string, packageRoot: string, args: readonly string[]) {
  return runPersonaCli(args, { cwd: projectDir, env: {}, invocationName: "ph", packageRoot })
}

function snapshotTree(root: string): Readonly<Record<string, string>> {
  const snapshot: Record<string, string> = {}
  const visit = (current: string): void => {
    const path = relative(root, current).replace(/\\/gu, "/")
    const stat = lstatSync(current)
    if (path.length > 0) snapshot[path] = stat.isFile() ? readFileSync(current).toString("base64") : "directory"
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current).sort()) visit(join(current, entry))
    }
  }
  visit(root)
  return snapshot
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function expectManifestMatchesBootstrap(projectDir: string, profileBytes: Buffer): void {
  const manifest = readInitManifest(projectDir)
  expect(manifest?.project.profileDigest).toBe(sha256Bytes(profileBytes))
  for (const path of [".persona/harness.jsonc", ".opencode/opencode.json"]) {
    expect(manifest?.files.find((entry) => entry.path === path)?.digest).toBe(
      sha256Bytes(readFileSync(join(projectDir, path))),
    )
  }
}

afterEach(() => {
  for (const directory of tempDirectories) rmSync(directory, { force: true, recursive: true })
  tempDirectories.length = 0
})

describe("init after backend bootstrap", () => {
  it("updates package-owned defaults without losing bootstrap-selected behavior or project state", () => {
    const projectDir = createProject()
    const firstPackage = createPackageRoot("0.8.6-loop5-base", 12)
    expect(cli(projectDir, firstPackage, ["init"]).status).toBe(0)
    expect(cli(projectDir, firstPackage, [
      "bootstrap",
      "backend",
      "--strict",
      "--runtime-injection-preview",
      "--multi-agent-preview",
      "--no-developer-mcp",
    ]).status).toBe(0)
    const profileBefore = readFileSync(join(projectDir, ".persona", "project-profile.jsonc"))
    expectManifestMatchesBootstrap(projectDir, profileBefore)
    const planBefore = readFileSync(join(projectDir, ".persona", "workflow", "plan.md"))
    const evidencePath = join(projectDir, ".persona", "evidence", "loop5-sentinel.json")
    mkdirSync(join(projectDir, ".persona", "evidence"), { recursive: true })
    writeFileSync(evidencePath, "{\"loop\":5}\n")

    const nextPackage = createPackageRoot("0.8.6-loop5-next", 17)
    const updated = cli(projectDir, nextPackage, ["init"])

    expect(updated.status).toBe(0)
    const config = loadHarnessConfig(projectDir)
    expect(config.maxRulesPerInjection).toBe(17)
    expect(config.enforce.executeVerification).toBe(true)
    expect(config.features.runtimeInjection).toBe(true)
    expect(config.multiAgent.enabled).toBe(true)
    expect(readFileSync(join(projectDir, ".persona", "project-profile.jsonc"))).toEqual(profileBefore)
    expect(readFileSync(join(projectDir, ".persona", "workflow", "plan.md"))).toEqual(planBefore)
    expect(readFileSync(evidencePath, "utf8")).toBe("{\"loop\":5}\n")

    expectManifestMatchesBootstrap(projectDir, profileBefore)
    const stable = snapshotTree(projectDir)
    expect(cli(projectDir, nextPackage, ["init"]).status).toBe(0)
    expect(snapshotTree(projectDir)).toEqual(stable)
  })

  it("preserves the default developer MCP configuration across an init rerun", () => {
    const projectDir = createProject()
    const packageRoot = createPackageRoot("0.8.6-loop5-mcp", 12)
    expect(cli(projectDir, packageRoot, ["init"]).status).toBe(0)
    expect(cli(projectDir, packageRoot, ["bootstrap", "backend"]).status).toBe(0)

    const rerun = cli(projectDir, packageRoot, ["init"])

    expect(rerun.status).toBe(0)
    const openCode: unknown = JSON.parse(readFileSync(join(projectDir, ".opencode", "opencode.json"), "utf8"))
    expect(isRecord(openCode) && isRecord(openCode.mcp)).toBe(true)
    if (!isRecord(openCode) || !isRecord(openCode.mcp)) return
    expect(openCode.mcp.grep_app).toEqual({ type: "remote", url: "https://mcp.grep.app" })
    expect(openCode.mcp.context7).toEqual({ type: "remote", url: "https://mcp.context7.com/mcp" })
  })

  it.each([".persona/harness.jsonc", ".opencode/opencode.json"])(
    "refuses to launder user drift in %s through bootstrap",
    (relativePath) => {
      const projectDir = createProject()
      const packageRoot = createPackageRoot("0.8.6-loop5-drift", 12)
      expect(cli(projectDir, packageRoot, ["init"]).status).toBe(0)
      const targetPath = join(projectDir, relativePath)
      writeFileSync(targetPath, `${readFileSync(targetPath, "utf8")}\n// user drift\n`)
      const before = snapshotTree(projectDir)

      const bootstrap = cli(projectDir, packageRoot, ["bootstrap", "backend", "--strict", "--no-developer-mcp"])

      expect(bootstrap.status).toBe(1)
      expect(snapshotTree(projectDir)).toEqual(before)
    },
  )
})

describe("bootstrap-owned update state", () => {
  it("initializes PH-owned files around a retained draft profile and plan", () => {
    const projectDir = createProject()
    const packageRoot = createPackageRoot("0.8.6-loop5-retained-draft", 12)
    expect(cli(projectDir, packageRoot, ["intake", "--default", "backend"]).status).toBe(0)
    expect(cli(projectDir, packageRoot, ["plan"]).status).toBe(0)
    const planBefore = readFileSync(join(projectDir, ".persona", "workflow", "plan.md"))

    const bootstrap = cli(projectDir, packageRoot, ["bootstrap", "backend", "--strict", "--no-developer-mcp"])

    expect(bootstrap.status).toBe(0)
    expect(readFileSync(join(projectDir, ".persona", "workflow", "plan.md"))).toEqual(planBefore)
    expect(cli(projectDir, packageRoot, ["plan", "--status"]).stdout).toContain("Status: draft")
    expect(cli(projectDir, packageRoot, ["init"]).status).toBe(0)
  })

  it("refuses to adopt an init target from a preinitialized Persona directory", () => {
    const projectDir = createProject()
    const packageRoot = createPackageRoot("0.8.6-loop5-partial", 12)
    const harnessPath = join(projectDir, ".persona", "harness.jsonc")
    mkdirSync(join(projectDir, ".persona"), { recursive: true })
    writeFileSync(harnessPath, "{\"userOwned\":true}\n")
    const before = snapshotTree(projectDir)

    const bootstrap = cli(projectDir, packageRoot, ["bootstrap", "backend", "--strict", "--no-developer-mcp"])

    expect(bootstrap.status).toBe(1)
    expect(snapshotTree(projectDir)).toEqual(before)
  })

  it("keeps a fresh attachment safe for a later init rerun", () => {
    const projectDir = createJavaProject()
    expect(cli(projectDir, process.cwd(), ["attach", "--yes"]).status).toBe(0)

    const rerun = cli(projectDir, process.cwd(), ["init"])

    expect({ status: rerun.status, stderr: rerun.stderr }).toEqual({ status: 0, stderr: "" })
    expect(loadHarnessConfig(projectDir).enforce.executeVerification).toBe(true)
  })

  it("carries only enabled bootstrap opt-ins onto the new package template", () => {
    const template = Buffer.from(`${JSON.stringify({
      enforce: { executeVerification: false, systemConstitution: true },
      features: { entrySteering: true, runtimeInjection: false },
      maxRulesPerInjection: 17,
      multiAgent: { enabled: false, roles: ["next-role"] },
    })}\n`)
    const current = Buffer.from(`${JSON.stringify({
      arbitraryUserKey: "do not carry",
      enforce: { executeVerification: true, systemConstitution: false },
      features: { entrySteering: false, runtimeInjection: true },
      maxRulesPerInjection: 12,
      multiAgent: { enabled: true, roles: ["old-role"] },
    })}\n`)

    const merged: unknown = JSON.parse(mergeBootstrapHarnessOptIns(template, current).toString("utf8"))

    expect(merged).toEqual({
      enforce: { executeVerification: true, systemConstitution: true },
      features: { entrySteering: true, runtimeInjection: true },
      maxRulesPerInjection: 17,
      multiAgent: { enabled: true, roles: ["next-role"] },
    })
  })

  it("keeps package template bytes unchanged when no bootstrap opt-in is enabled", () => {
    const template = Buffer.from("{\n  // package formatting remains authoritative\n  \"maxRulesPerInjection\": 17\n}\n")
    const current = Buffer.from("{\"enforce\":{},\"features\":{},\"multiAgent\":{\"enabled\":false}}\n")

    expect(mergeBootstrapHarnessOptIns(template, current)).toEqual(template)
  })

  it("preserves an explicit project philosophy injection opt-out across init", () => {
    const template = Buffer.from(`${JSON.stringify({
      features: { projectPhilosophyInjection: true, runtimeInjection: false },
    })}\n`)
    const current = Buffer.from(`${JSON.stringify({
      features: { projectPhilosophyInjection: false, runtimeInjection: false },
    })}\n`)

    const merged: unknown = JSON.parse(mergeBootstrapHarnessOptIns(template, current).toString("utf8"))

    expect(merged).toEqual({
      features: { projectPhilosophyInjection: false, runtimeInjection: false },
    })
  })

  it("preserves an explicit shared-skill routing opt-out across init", () => {
    const template = Buffer.from(`${JSON.stringify({
      features: { runtimeInjection: false, sharedSkillRouting: true },
    })}\n`)
    const current = Buffer.from(`${JSON.stringify({
      features: { runtimeInjection: false, sharedSkillRouting: false },
    })}\n`)

    const merged: unknown = JSON.parse(mergeBootstrapHarnessOptIns(template, current).toString("utf8"))

    expect(merged).toEqual({
      features: { runtimeInjection: false, sharedSkillRouting: false },
    })
  })
})
