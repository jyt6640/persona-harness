import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  PERSONA_CORE_SKILL_IDS,
  PERSONA_OPTIONAL_SKILL_IDS,
  listPersonaSharedSkills,
  personaSharedSkillPath,
  resolvePersonaSharedSkill,
} from "../src/runtime/persona-shared-skill-catalog.js"
import { createOpenCodeSkillRoute } from "../src/runtime/opencode-skill-adapter.js"

const packageRoot = process.cwd()

function isCoveredByPackageFiles(filePath: string, files: readonly string[]): boolean {
  return files.some((entry) => filePath === entry || filePath.startsWith(`${entry}/`))
}

describe("Persona-owned shared-skill catalog", () => {
  it("ships one portable core with explicit handoffs and optional extensions", () => {
    expect(PERSONA_CORE_SKILL_IDS).toEqual([
      "deep-interview",
      "technical-intake",
      "plan",
      "ralplan",
      "tdd",
      "implementation",
      "review",
      "programming",
      "debug",
      "refactor",
      "git",
    ])
    expect(PERSONA_OPTIONAL_SKILL_IDS).toEqual(["frontend", "visual-qa", "ast-grep", "lsp-setup"])

    const skills = listPersonaSharedSkills()
    expect(skills.map((skill) => skill.id)).toEqual([...PERSONA_CORE_SKILL_IDS, ...PERSONA_OPTIONAL_SKILL_IDS])
    expect(resolvePersonaSharedSkill("deep-interview")).toMatchObject({
      mutability: "conversation-only",
      handoff: "technical-intake",
    })
    expect(resolvePersonaSharedSkill("plan")).toMatchObject({ handoff: "ralplan" })
    expect(resolvePersonaSharedSkill("ralplan")).toMatchObject({ optional: true, handoff: "tdd" })
    expect(resolvePersonaSharedSkill("implementation")).toMatchObject({ handoff: "review" })
    expect(skills.filter((skill) => skill.category === "optional-extension").every((skill) => skill.optional)).toBe(true)
  })

  it("keeps every catalog entry package-visible and never treats host workflow templates as core skills", () => {
    const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      readonly files: readonly string[]
      readonly version: string
    }
    const sharedPackageJson = JSON.parse(readFileSync(join(packageRoot, "packages/shared-skills/package.json"), "utf8")) as {
      readonly files: readonly string[]
      readonly name: string
      readonly private: boolean
      readonly version: string
    }

    for (const skill of listPersonaSharedSkills()) {
      const path = personaSharedSkillPath(skill.id)
      expect(existsSync(join(packageRoot, path))).toBe(true)
      expect(isCoveredByPackageFiles(path, packageJson.files)).toBe(true)
    }

    expect(existsSync(join(packageRoot, "packages/shared-skills/catalog.json"))).toBe(true)
    expect(isCoveredByPackageFiles("packages/shared-skills/catalog.json", packageJson.files)).toBe(true)
    expect(packageJson.files).not.toContain("packages/shared-skills/skills/workflow")
    expect((listPersonaSharedSkills().map((skill) => skill.id) as readonly string[])).not.toContain("workflow")
    expect(sharedPackageJson).toMatchObject({
      name: "@persona-harness/shared-skills",
      private: true,
      version: packageJson.version,
    })
    expect(sharedPackageJson.files).toContain("catalog.json")
    expect(sharedPackageJson.files).not.toContain("skills")
  })

  it("keeps advisory host tools out of the mandatory consumer install surface", () => {
    const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      readonly dependencies?: Readonly<Record<string, string>>
      readonly devDependencies?: Readonly<Record<string, string>>
      readonly optionalDependencies?: Readonly<Record<string, string>>
      readonly peerDependencies?: Readonly<Record<string, string>>
      readonly peerDependenciesMeta?: Readonly<Record<string, { readonly optional?: boolean }>>
      readonly scripts?: Readonly<Record<string, string>>
    }
    const packageLock = JSON.parse(readFileSync(join(packageRoot, "package-lock.json"), "utf8")) as {
      readonly packages: Readonly<Record<string, {
        readonly dependencies?: Readonly<Record<string, string>>
        readonly devDependencies?: Readonly<Record<string, string>>
        readonly optionalDependencies?: Readonly<Record<string, string>>
        readonly peerDependencies?: Readonly<Record<string, string>>
        readonly peerDependenciesMeta?: Readonly<Record<string, { readonly optional?: boolean }>>
      }>>
    }
    const lockRoot = packageLock.packages[""]
    expect(lockRoot).toBeDefined()
    const hostTools = [
      "@opencode-ai/plugin",
      "@ast-grep/cli",
      "@colbymchenry/codegraph",
      "@theupsider/lsp-mcp",
    ] as const

    for (const hostTool of hostTools) {
      expect(packageJson.dependencies?.[hostTool]).toBeUndefined()
      expect(packageJson.optionalDependencies?.[hostTool]).toBeUndefined()
      expect(packageJson.devDependencies?.[hostTool]).toBeDefined()
      expect(packageJson.peerDependencies?.[hostTool]).toBeDefined()
      expect(packageJson.peerDependenciesMeta?.[hostTool]).toEqual({ optional: true })
      expect(lockRoot?.dependencies?.[hostTool]).toBeUndefined()
      expect(lockRoot?.optionalDependencies?.[hostTool]).toBeUndefined()
      expect(lockRoot?.devDependencies?.[hostTool]).toBeDefined()
      expect(lockRoot?.peerDependencies?.[hostTool]).toBeDefined()
      expect(lockRoot?.peerDependenciesMeta?.[hostTool]).toEqual({ optional: true })
    }
    expect(packageJson.scripts?.preinstall).toBeUndefined()
    expect(packageJson.scripts?.install).toBeUndefined()
    expect(packageJson.scripts?.postinstall).toBeUndefined()
  })

  it("keeps the packaged provenance decoder free of native install dependencies", () => {
    const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      readonly dependencies?: Readonly<Record<string, string>>
    }
    const packageLock = JSON.parse(readFileSync(join(packageRoot, "package-lock.json"), "utf8")) as {
      readonly packages: Readonly<Record<string, {
        readonly dependencies?: Readonly<Record<string, string>>
        readonly cpu?: readonly string[]
        readonly dev?: boolean
        readonly devOptional?: boolean
        readonly hasInstallScript?: boolean
        readonly os?: readonly string[]
        readonly version?: string
      }>>
    }

    expect(packageJson.dependencies?.snappy).toBeUndefined()
    expect(packageJson.dependencies?.snappyjs).toBe("0.7.0")
    expect(packageLock.packages[""]?.dependencies?.snappy).toBeUndefined()
    expect(packageLock.packages[""]?.dependencies?.snappyjs).toBe("0.7.0")
    expect(packageLock.packages["node_modules/snappy"]).toBeUndefined()
    expect(Object.keys(packageLock.packages).filter((entry) => entry.startsWith("node_modules/@napi-rs/snappy-"))).toEqual([])
    const decoder = packageLock.packages["node_modules/snappyjs"]
    expect(decoder?.version).toBe("0.7.0")
    expect(decoder?.hasInstallScript).toBeUndefined()
    expect(decoder?.os).toBeUndefined()
    expect(decoder?.cpu).toBeUndefined()

    const productionInstallRisks = Object.entries(packageLock.packages)
      .filter(([entry, value]) => entry !== "" && value.dev !== true && value.devOptional !== true)
      .filter(([, value]) => value.hasInstallScript === true || value.os !== undefined || value.cpu !== undefined)
      .map(([entry]) => entry)
    expect(productionInstallRisks).toEqual([])
  })

  it("states the bounded Windows package-install contract without making a runtime support claim", () => {
    const guide = readFileSync(join(packageRoot, "docs/current/persona-shared-skills-core.md"), "utf8")

    expect(guide).toContain("Windows package-install surface")
    expect(guide).toContain("does not claim Windows runtime support")
  })

  it("renders an advisory route instead of injecting a skill body or advancing workflow state", () => {
    const route = createOpenCodeSkillRoute({
      decision: "suggest",
      skillId: "deep-interview",
      reason: "A product outcome is still unresolved.",
    })

    expect(route).toContain("[Persona Harness Skill Route]")
    expect(route).toContain("Decision: suggest")
    expect(route).toContain("Skill: deep-interview")
    expect(route).toContain("does not create plans, tickets, branches, files, agents, or workflow state")
    expect(route).not.toContain("npx ph workflow")
    expect(route).not.toContain("# Product Deep Interview")
  })
})
