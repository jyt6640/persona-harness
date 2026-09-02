import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  buildHostPluginDistributionTargets,
  verifyHostPluginDistribution,
  writeHostPluginDistribution,
} from "../src/cli/host-plugin-distribution.js"
import { runHostPluginCommand } from "../src/cli/host-plugin-command.js"
import { buildHostSkillAdapterTargets } from "../src/cli/host-skill-materializer.js"
import { listPersonaSharedSkills } from "../src/runtime/persona-shared-skill-catalog.js"

const temporaryPackageRoots: string[] = []

function createPackageRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "persona-host-plugin-package-"))
  temporaryPackageRoots.push(root)
  cpSync(join(process.cwd(), "package.json"), join(root, "package.json"))
  cpSync(join(process.cwd(), "packages", "shared-skills"), join(root, "packages", "shared-skills"), { recursive: true })
  return root
}

function findTarget(
  targets: readonly { readonly nextBytes: Buffer; readonly relativePath: string }[],
  relativePath: string,
): { readonly nextBytes: Buffer; readonly relativePath: string } {
  const target = targets.find((candidate) => candidate.relativePath === relativePath)
  if (target === undefined) throw new Error(`missing target: ${relativePath}`)
  return target
}

function snapshot(path: string): Buffer {
  return readFileSync(path)
}

afterEach(() => {
  for (const root of temporaryPackageRoots) {
    rmSync(root, { force: true, recursive: true })
  }
  temporaryPackageRoots.length = 0
})

describe("host plugin distribution", () => {
  it("renders Antigravity, Codex, and Claude plugin skills byte-bound to canonical host adapters", () => {
    const targets = buildHostPluginDistributionTargets(process.cwd())
    const adapters = buildHostSkillAdapterTargets(process.cwd())
    const skills = listPersonaSharedSkills()

    expect(targets).toHaveLength((skills.length * 3) + 4)
    const antigravityManifest = JSON.parse(findTarget(targets, "packages/host-plugins/antigravity/plugin.json").nextBytes.toString("utf8"))
    expect(antigravityManifest).toEqual({
      $schema: "https://antigravity.google/schemas/v1/plugin.json",
      description: "Portable Persona Harness shared skills for Antigravity.",
      name: "persona-harness",
    })
    expect(findTarget(targets, "packages/host-plugins/codex/.agents/plugins/marketplace.json").nextBytes.toString("utf8"))
      .toContain('"name": "persona-harness"')
    expect(findTarget(targets, "packages/host-plugins/codex/plugins/persona-harness/.codex-plugin/plugin.json").nextBytes.toString("utf8"))
      .toContain('"skills": "./skills/"')
    const claudeManifest = findTarget(targets, "packages/host-plugins/claude/.claude-plugin/plugin.json").nextBytes.toString("utf8")
    expect(claudeManifest).toContain('"name": "persona-harness"')
    expect(claudeManifest).not.toContain('"displayName"')

    for (const skill of skills) {
      const codexAdapter = findTarget(
        adapters,
        `.agents/skills/persona-harness-${skill.id}/SKILL.md`,
      )
      const claudeAdapter = findTarget(
        adapters,
        `.claude/skills/persona-harness-claude-${skill.id}/SKILL.md`,
      )

      expect(findTarget(
        targets,
        `packages/host-plugins/codex/plugins/persona-harness/skills/${skill.id}/SKILL.md`,
      ).nextBytes.equals(codexAdapter.nextBytes)).toBe(true)
      expect(findTarget(
        targets,
        `packages/host-plugins/antigravity/skills/${skill.id}/SKILL.md`,
      ).nextBytes.equals(codexAdapter.nextBytes)).toBe(true)
      expect(findTarget(
        targets,
        `packages/host-plugins/claude/skills/${skill.id}/SKILL.md`,
      ).nextBytes.equals(claudeAdapter.nextBytes)).toBe(true)
    }
  })

  it("writes and resolves only verified package-owned plugin roots", () => {
    const packageRoot = createPackageRoot()

    writeHostPluginDistribution(packageRoot)

    expect(verifyHostPluginDistribution(packageRoot)).toEqual({
      antigravityPluginRoot: join(packageRoot, "packages", "host-plugins", "antigravity"),
      claudePluginRoot: join(packageRoot, "packages", "host-plugins", "claude"),
      codexMarketplaceRoot: join(packageRoot, "packages", "host-plugins", "codex"),
    })
    expect(runHostPluginCommand(["path", "codex"], { packageRoot }, "ph")).toEqual({
      status: 0,
      stderr: "",
      stdout: `${join(packageRoot, "packages", "host-plugins", "codex")}\n`,
    })
    expect(runHostPluginCommand(["path", "claude"], { packageRoot }, "ph")).toEqual({
      status: 0,
      stderr: "",
      stdout: `${join(packageRoot, "packages", "host-plugins", "claude")}\n`,
    })
    expect(runHostPluginCommand(["path", "antigravity"], { packageRoot }, "ph")).toEqual({
      status: 0,
      stderr: "",
      stdout: `${join(packageRoot, "packages", "host-plugins", "antigravity")}\n`,
    })
  })

  it("fails closed without replacing a modified plugin artifact", () => {
    const packageRoot = createPackageRoot()
    writeHostPluginDistribution(packageRoot)
    const manifestPath = join(packageRoot, "packages", "host-plugins", "antigravity", "plugin.json")
    writeFileSync(manifestPath, "{\n")
    const before = snapshot(manifestPath)

    expect(() => verifyHostPluginDistribution(packageRoot)).toThrow("host-plugin-distribution")
    expect(() => writeHostPluginDistribution(packageRoot)).toThrow("host-plugin-distribution")
    expect(snapshot(manifestPath)).toEqual(before)
  })

  it("rejects missing, duplicate, and symlinked skill artifacts", () => {
    const missingRoot = createPackageRoot()
    writeHostPluginDistribution(missingRoot)
    rmSync(join(missingRoot, "packages", "host-plugins", "antigravity", "skills", "debug", "SKILL.md"))
    expect(() => verifyHostPluginDistribution(missingRoot)).toThrow("host-plugin-distribution")

    const duplicateRoot = createPackageRoot()
    writeHostPluginDistribution(duplicateRoot)
    const duplicatePath = join(duplicateRoot, "packages", "host-plugins", "claude", "skills", "duplicate", "SKILL.md")
    mkdirSync(join(duplicatePath, ".."), { recursive: true })
    writeFileSync(duplicatePath, readFileSync(join(duplicateRoot, "packages", "host-plugins", "claude", "skills", "debug", "SKILL.md")))
    expect(() => verifyHostPluginDistribution(duplicateRoot)).toThrow("host-plugin-distribution")

    const symlinkRoot = createPackageRoot()
    writeHostPluginDistribution(symlinkRoot)
    const skillPath = join(symlinkRoot, "packages", "host-plugins", "antigravity", "skills", "debug", "SKILL.md")
    const sourcePath = join(symlinkRoot, "packages", "host-plugins", "antigravity", "skills", "review", "SKILL.md")
    rmSync(skillPath)
    symlinkSync(sourcePath, skillPath, "file")
    expect(existsSync(skillPath) && lstatSync(skillPath).isSymbolicLink()).toBe(true)
    expect(() => verifyHostPluginDistribution(symlinkRoot)).toThrow("host-plugin-distribution")
  })

  it("rejects stale versions and invalid command arguments before returning a path", () => {
    const packageRoot = createPackageRoot()
    writeHostPluginDistribution(packageRoot)
    const skillPath = join(packageRoot, "packages", "host-plugins", "antigravity", "skills", "debug", "SKILL.md")
    const skill = readFileSync(skillPath, "utf8").replace(/persona-harness\/adapter-version: [^\n]+/u, "persona-harness/adapter-version: 0.0.0")
    writeFileSync(skillPath, skill)

    expect(() => verifyHostPluginDistribution(packageRoot)).toThrow("host-plugin-distribution")
    expect(runHostPluginCommand(["path", "antigravity"], { packageRoot }, "ph").status).toBe(1)
    expect(runHostPluginCommand(["--help"], { packageRoot }, "ph").stdout).toContain("<antigravity|codex|claude>")
    expect(runHostPluginCommand(["path", "unknown"], { packageRoot }, "ph").status).toBe(1)
    expect(runHostPluginCommand(["install", "codex"], { packageRoot }, "ph").status).toBe(1)
  })
})
