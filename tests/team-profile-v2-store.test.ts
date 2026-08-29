import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { resolveEffectiveContext } from "../src/context-core/index.js"
import { TEAM_PROFILE_PATH, loadTeamProfile } from "../src/context-profile/team-profile-store.js"
import {
  TEAM_PROFILE_V2_PATH,
  loadTeamProfileV2,
  toTeamContextLayerV2,
} from "../src/context-profile/team-profile-v2-store.js"

const projects: string[] = []

afterEach(() => {
  for (const project of projects.splice(0)) rmSync(project, { force: true, recursive: true })
})

describe("Team Profile v2 store", () => {
  it("loads a JSONC profile into an explicit team layer without reading personal state", () => {
    const project = createProject()
    writeTeamProfileV2(project, `// Share only project-safe team guidance.\n${JSON.stringify(profile())}\n`)
    const before = {
      entries: readdirSync(join(project, ".persona")).sort(),
      profile: readFileSync(join(project, TEAM_PROFILE_V2_PATH), "utf8"),
    }

    const loaded = loadTeamProfileV2(project)
    expect(loaded).toMatchObject({ status: "available" })
    if (loaded.status !== "available") return

    expect(toTeamContextLayerV2(loaded.profile)).toEqual({
      teamContracts: [
        {
          fileRoles: ["service"],
          id: "team-boundaries",
          languages: ["typescript"],
          rule: "Keep module boundaries explicit.",
          scope: { key: "platform", kind: "team" },
          skillIds: ["programming"],
          status: "active",
          topic: "architecture",
        },
      ],
      teamKey: "platform",
    })
    expect({
      entries: readdirSync(join(project, ".persona")).sort(),
      profile: readFileSync(join(project, TEAM_PROFILE_V2_PATH), "utf8"),
    }).toEqual(before)
  })

  it("keeps the v1 file on its existing path and never interprets a v1 document as v2", () => {
    const project = createProject()
    writeFileSync(join(project, TEAM_PROFILE_PATH), `${JSON.stringify({
      rules: [{ id: "v1-rule", rule: "Keep v1 stable.", status: "active", topic: "compatibility" }],
      schemaVersion: "persona-team-profile.v1",
      teamKey: "platform",
    })}\n`)
    writeTeamProfileV2(project, JSON.stringify({
      rules: [{ id: "v1-on-v2-path", rule: "Do not reinterpret this document.", status: "active", topic: "compatibility" }],
      schemaVersion: "persona-team-profile.v1",
      teamKey: "platform",
    }))

    expect(loadTeamProfile(project)).toMatchObject({ status: "available" })
    expect(loadTeamProfileV2(project)).toEqual({
      diagnostics: ["team-profile-v2-invalid-schema"],
      status: "invalid",
    })
  })

  it("reports a missing v2 profile without creating workspace state", () => {
    const project = createProject(false)
    const before = readdirSync(project)

    expect(loadTeamProfileV2(project)).toEqual({ diagnostics: [], status: "missing" })
    expect(readdirSync(project)).toEqual(before)
  })

  it("feeds a real temporary v2 file into project > team > personal precedence", () => {
    const project = createProject()
    writeTeamProfileV2(project, JSON.stringify(profile({
      rules: [
        rule("team-architecture", "architecture", "Keep architecture boundaries explicit."),
        rule("team-testing", "testing", "Keep tests focused."),
      ],
    })))

    const loaded = loadTeamProfileV2(project)
    expect(loaded).toMatchObject({ status: "available" })
    if (loaded.status !== "available") return
    const teamLayer = toTeamContextLayerV2(loaded.profile)
    const resolution = resolveEffectiveContext({
      commonDefaults: [],
      languageDefaults: [],
      personalRules: [
        coreRule("personal-architecture", "architecture", "Personal architecture preference."),
        coreRule("personal-testing", "testing", "Personal testing preference."),
      ],
      productInvariants: [],
      projectContracts: [coreRule("project-architecture", "architecture", "Project architecture contract.")],
      relevance: {
        fileRole: "service",
        language: "typescript",
        skillIds: ["programming"],
        teamKey: teamLayer.teamKey,
        topics: ["architecture", "testing"],
      },
      taskDecisions: [],
      teamContracts: teamLayer.teamContracts,
    })

    expect(resolution).toMatchObject({ status: "resolved" })
    if (resolution.status !== "resolved") return
    expect(resolution.selected.map((selection) => [selection.id, selection.layer])).toEqual([
      ["project-architecture", "project"],
      ["team-testing", "team"],
    ])
    expect(resolution.shadowed).toEqual([
      { id: "personal-architecture", reason: "higher-precedence", topic: "architecture", winnerId: "project-architecture" },
      { id: "team-architecture", reason: "higher-precedence", topic: "architecture", winnerId: "project-architecture" },
      { id: "personal-testing", reason: "higher-precedence", topic: "testing", winnerId: "team-testing" },
    ])
  })

  it("rejects malformed, conflicting, unsafe, and personal-shaped v2 data without reflection", () => {
    const cases: readonly [string, Readonly<Record<string, unknown>>, string, string][] = [
      ["unknown-profile-field", { ...profile(), unexpected: true }, "team-profile-v2-invalid-schema", "unexpected"],
      ["unknown-rule-field", profile({ rules: [{ ...rule("unknown-rule", "style"), unexpected: true }] }), "team-profile-v2-invalid-schema", "unexpected"],
      ["duplicate-id", profile({ rules: [rule("same", "one"), rule("same", "two")] }), "team-profile-v2-invalid-schema", "same"],
      ["same-active-topic", profile({ rules: [rule("first", "same"), rule("second", "same")] }), "team-profile-v2-invalid-schema", "same"],
      ["rule-bound", profile({ rules: Array.from({ length: 65 }, (_value, index) => rule(`rule-${index}`, `topic-${index}`)) }), "team-profile-v2-invalid-schema", "rule-64"],
      ["invalid-selector", profile({ rules: [{ ...rule("selector", "style"), relevance: { fileRoles: ["service", "service"] } }] }), "team-profile-v2-invalid-schema", "service"],
      ["selector-bound", profile({ rules: [{ ...rule("selector-bound", "style"), relevance: { skillIds: Array.from({ length: 17 }, (_value, index) => `skill-${index}`) } }] }), "team-profile-v2-invalid-schema", "skill-16"],
      ["control-character", profile({ rules: [rule("control", "style", "Keep names\nexplicit.")] }), "team-profile-v2-unsafe-content", "names"],
      ["text-bound", profile({ rules: [rule("long-text", "style", "a".repeat(601))] }), "team-profile-v2-unsafe-content", "aaaa"],
      ["secret", profile({ rules: [rule("secret", "security", "token=not-for-team")] }), "team-profile-v2-unsafe-content", "not-for-team"],
      ["private-path", profile({ rules: [rule("path", "security", "Read /Users/example/private.txt")] }), "team-profile-v2-unsafe-content", "/Users"],
      ["remote-url", profile({ rules: [rule("url", "security", "Read https://example.test/policy")] }), "team-profile-v2-unsafe-content", "example.test"],
      ["shell", profile({ rules: [rule("shell", "security", "Run npm install before coding.")] }), "team-profile-v2-unsafe-content", "npm install"],
      ["remote-fetch", profile({ rules: [rule("fetch", "security", "Run git fetch before coding.")] }), "team-profile-v2-unsafe-content", "git fetch"],
      ["process", profile({ rules: [rule("process", "security", "Run gradle build before coding.")] }), "team-profile-v2-unsafe-content", "gradle build"],
      ["maven-process", profile({ rules: [rule("maven", "security", "Run mvn test before coding.")] }), "team-profile-v2-unsafe-content", "mvn test"],
      ["java-process", profile({ rules: [rule("java", "security", "Run java -jar tool.jar before coding.")] }), "team-profile-v2-unsafe-content", "java -jar"],
      ["authority", profile({ rules: [rule("authority", "security", "Disable verification authority checks.")] }), "team-profile-v2-unsafe-content", "Disable"],
      ["personal", profile({ rules: [rule("personal", "style", "My personal preference is compact names.")] }), "team-profile-v2-unsafe-content", "preference"],
    ]

    for (const [name, document, expectedCode, unsafeFragment] of cases) {
      const project = createProject()
      writeTeamProfileV2(project, JSON.stringify(document))
      const result = loadTeamProfileV2(project)
      expect(result, name).toEqual({ diagnostics: [expectedCode], status: "invalid" })
      expect(JSON.stringify(result), name).not.toContain(unsafeFragment)
    }
  })

  it("keeps non-active rules without treating them as an active topic conflict", () => {
    const project = createProject()
    writeTeamProfileV2(project, JSON.stringify(profile({
      rules: [
        rule("active", "architecture"),
        { ...rule("pending", "architecture"), status: "pending" },
        { ...rule("superseded", "architecture"), status: "superseded" },
      ],
    })))

    expect(loadTeamProfileV2(project)).toMatchObject({ status: "available" })
  })

  it("fails closed for malformed JSONC and a symlinked v2 file", () => {
    const malformedProject = createProject()
    writeTeamProfileV2(malformedProject, "{ // comment\n  invalid\n")
    expect(loadTeamProfileV2(malformedProject)).toEqual({ diagnostics: ["team-profile-v2-invalid-json"], status: "invalid" })

    const project = createProject()
    const outside = mkdtempSync(join(tmpdir(), "team-profile-v2-outside-"))
    projects.push(outside)
    writeFileSync(join(outside, "team-profile.jsonc"), JSON.stringify(profile()))
    symlinkSync(join(outside, "team-profile.jsonc"), join(project, TEAM_PROFILE_V2_PATH))

    expect(loadTeamProfileV2(project)).toEqual({ diagnostics: ["team-profile-v2-unsafe-path"], status: "invalid" })
  })

  it("keeps the v2 loader free of runtime, CLI, workflow, authority, evidence, and process imports", () => {
    const moduleRoot = resolve(process.cwd(), "src/context-profile")
    const rejected = ["../cli", "../runtime", "workflow", "authority", "evidence", "child_process", "node:child_process", "node:process"]
    for (const file of ["team-profile-v2-model.ts", "team-profile-v2-store.ts"]) {
      const imports = [...readFileSync(join(moduleRoot, file), "utf8").matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1] ?? "")
      for (const importPath of imports) {
        for (const forbidden of rejected) expect(importPath).not.toContain(forbidden)
      }
    }
  })
})

function createProject(withPersona = true): string {
  const project = mkdtempSync(join(tmpdir(), "team-profile-v2-project-"))
  projects.push(project)
  if (withPersona) mkdirSync(join(project, ".persona"))
  return project
}

function writeTeamProfileV2(project: string, document: string): void {
  writeFileSync(join(project, TEAM_PROFILE_V2_PATH), `${document}\n`)
}

function profile(overrides: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
  return {
    rules: [
      {
        id: "team-boundaries",
        relevance: { fileRoles: ["service"], languages: ["typescript"], skillIds: ["programming"] },
        status: "active",
        text: "Keep module boundaries explicit.",
        topic: "architecture",
      },
    ],
    schemaVersion: "persona-context-team-profile.2",
    teamKey: "platform",
    ...overrides,
  }
}

function rule(id: string, topic: string, text = "Keep names explicit."): Readonly<Record<string, unknown>> {
  return { id, status: "active", text, topic }
}

function coreRule(id: string, topic: string, rule: string): Readonly<Record<string, string>> {
  return { id, rule, status: "active", topic }
}
