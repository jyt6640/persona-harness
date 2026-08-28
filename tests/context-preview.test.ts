import { mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { proposePersonalizationCandidate } from "../src/cli/personalization-profile-store.js"
import type { PersonalizationScope } from "../src/cli/personalization-profile-store.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

const repositoryRoot = resolve(process.cwd())

describe("context preview", () => {
  it("builds a deterministic JSON envelope for a missing safe target without creating project state", () => {
    const projectDir = createProject()
    const before = projectEntries(projectDir)

    const first = preview(projectDir, ["src/main/java/example/MissingController.java", "--json"])
    const second = preview(projectDir, ["src/main/java/example/MissingController.java", "--json"])

    expect(first.status).toBe(0)
    expect(first.stderr).toBe("")
    expect(first.stdout).toBe(second.stdout)
    expect(first.stdout).toContain("persona-context-envelope.v1")
    expect(first.stdout).toContain("MissingController.java")
    expect(projectEntries(projectDir)).toEqual(before)
  })

  it("uses the same envelope digest for text and JSON while text omits rule content", () => {
    const projectDir = createProject()
    const rule = "Prefer explicit domain naming."
    activatePersonalRule(projectDir, "personal-naming", "naming", rule, { key: "personal", kind: "personal" })

    const text = preview(projectDir, ["src/main/java/example/App.java"])
    const json = preview(projectDir, ["src/main/java/example/App.java", "--json"])

    expect(text.status).toBe(0)
    expect(json.status).toBe(0)
    expect(text.stdout).not.toContain(rule)
    expect(text.stdout).toContain(envelopeDigest(json.stdout))
  })

  it("resolves a Team rule over the same-topic personal rule with explicit configuration", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { context: { enabled: true, maxCapsules: 16, maxChars: 1_600 } })
    activatePersonalRule(projectDir, "personal-naming", "naming", "Use a personal naming convention.", { key: "personal", kind: "personal" })
    writeTeamProfile(projectDir, {
      rules: [
        {
          id: "team.naming",
          rule: "Use the shared naming convention.",
          status: "active",
          topic: "naming",
        },
      ],
      schemaVersion: "persona-team-profile.v1",
      teamKey: "core-team",
    })

    const result = preview(projectDir, ["src/main/java/example/App.java", "--json"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("\"contextEnabled\":true")
    expect(result.stdout).toContain("\"id\":\"team.naming\"")
    expect(result.stdout).toContain("\"winnerId\":\"team.naming\"")
    expect(result.stdout).toContain("\"id\":\"rule-personal-naming\"")
    expect(result.stdout).not.toContain("Use a personal naming convention.")
  })

  it("uses explicit project and topic selectors without inferring missing identity", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { context: { maxCapsules: 16 } })
    activatePersonalRule(projectDir, "project-contract", "project-contract", "Keep the explicit project contract.", {
      key: "checkout-a",
      kind: "project",
    })

    const withoutProject = preview(projectDir, ["src/main/java/example/App.java", "--json", "--topic", "project-contract"])
    const withProject = preview(projectDir, [
      "src/main/java/example/App.java",
      "--json",
      "--topic",
      "project-contract",
      "--project",
      "checkout-a",
    ])

    expect(withoutProject.status).toBe(0)
    expect(withoutProject.stdout).not.toContain("rule-project-contract")
    expect(withProject.status).toBe(0)
    expect(withProject.stdout).toContain("rule-project-contract")
  })

  it.each([
    ["path traversal", ["../outside.java"], "context-target-invalid"],
    ["absolute path", ["/private/outside.java"], "context-target-invalid"],
    ["missing option value", ["src/App.java", "--project"], "context-preview-arguments-invalid"],
  ])("fails closed for %s without reflecting unsafe input", (_label, args, code) => {
    const projectDir = createProject()
    const result = preview(projectDir, args)

    expect(result).toEqual({ status: 1, stdout: "", stderr: `${code}\n` })
    expect(result.stderr).not.toContain(args[0] ?? "")
  })

  it("fails closed for an unknown topic without reflecting it", () => {
    const projectDir = createProject()
    const unknownTopic = "unavailable-topic"

    const result = preview(projectDir, ["src/App.java", "--topic", unknownTopic])

    expect(result).toEqual({ status: 1, stdout: "", stderr: "context-topic-unavailable\n" })
    expect(result.stderr).not.toContain(unknownTopic)
  })

  it("fails closed for invalid Context config, Team Profile, and personal store", () => {
    const configProject = createProject()
    writeHarnessConfig(configProject, { context: { enabled: true, unexpected: true } })
    expect(preview(configProject, ["src/App.java"])).toEqual({ status: 1, stdout: "", stderr: "context-config-invalid\n" })

    const teamProject = createProject()
    mkdirSync(join(teamProject, ".persona"), { recursive: true })
    writeFileSync(join(teamProject, ".persona", "team-profile.json"), "{ broken")
    expect(preview(teamProject, ["src/App.java"])).toEqual({ status: 1, stdout: "", stderr: "context-team-profile-invalid\n" })

    const personalProject = createProject()
    const storeRoot = personalizationStoreRoot(personalProject)
    mkdirSync(storeRoot, { recursive: true })
    writeFileSync(join(storeRoot, "profile.json"), "{ broken")
    expect(preview(personalProject, ["src/App.java"])).toEqual({ status: 1, stdout: "", stderr: "context-personal-profile-unavailable\n" })
  })

  it("keeps preview implementation free of host, network, shell, and workflow dependencies", () => {
    const source = readFileSync(resolve(repositoryRoot, "src/cli/context-preview.ts"), "utf8")

    for (const token of ["node:child_process", "node:http", "node:https", "fetch(", "spawn(", "exec(", "@opencode-ai/plugin", "workflow", "authority", "evidence"]) {
      expect(source).not.toContain(token)
    }
  })
})

function preview(projectDir: string, args: readonly string[]) {
  return runPersonaCli(["context", "preview", ...args], {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
    personalizationStoreRoot: personalizationStoreRoot(projectDir),
  })
}

function activatePersonalRule(
  projectDir: string,
  candidateId: string,
  topic: string,
  rule: string,
  scope: PersonalizationScope,
): void {
  mkdirSync(personalizationStoreRoot(projectDir), { recursive: true })
  proposePersonalizationCandidate({
    candidateId,
    counterexample: "Avoid an unbounded alternative.",
    outcome: "Keep the decision reproducible.",
    provenance: { kind: "user", reference: "manual" },
    rationale: "A local convention is useful.",
    rule,
    schemaVersion: "personalization-candidate.v1",
    scope,
    topic,
    tradeoffs: "The convention is explicit.",
  }, {
    idFactory: () => candidateId,
    now: () => new Date("2026-08-28T00:00:00.000Z"),
    storeRoot: personalizationStoreRoot(projectDir),
  })
}

function writeTeamProfile(projectDir: string, profile: Record<string, unknown>): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "team-profile.json"), `${JSON.stringify(profile, null, 2)}\n`)
}

function personalizationStoreRoot(projectDir: string): string {
  return join(realpathSync(projectDir), "personalization-store")
}

function envelopeDigest(json: string): string {
  const match = /"digest":"([a-f0-9]{64})"/u.exec(json)
  if (match?.[1] === undefined) throw new TypeError("preview digest is unavailable")
  return match[1]
}

function projectEntries(projectDir: string): readonly string[] {
  return readdirSync(projectDir).sort()
}
