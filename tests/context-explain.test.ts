import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { proposePersonalizationCandidate } from "../src/cli/personalization-profile-store.js"
import type { PersonalizationScope } from "../src/cli/personalization-profile-store.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

const repositoryRoot = resolve(process.cwd())

describe("context explain", () => {
  it("renders the same digest as preview while explaining Team precedence without rule text", () => {
    const projectDir = createProject()
    const personalRule = "Use a personal naming convention."
    const teamRule = "Use the shared naming convention."
    writeHarnessConfig(projectDir, { context: { enabled: true, maxCapsules: 16 } })
    activatePersonalRule(projectDir, "personal-naming", "naming", personalRule, { key: "personal", kind: "personal" })
    writeTeamProfile(projectDir, {
      rules: [{ id: "team.naming", rule: teamRule, status: "active", topic: "naming" }],
      schemaVersion: "persona-team-profile.v1",
      teamKey: "core-team",
    })

    const preview = run(projectDir, ["context", "preview", "src/main/java/example/App.java", "--json"])
    const explain = run(projectDir, ["context", "explain", "src/main/java/example/App.java"])

    expect(preview.status).toBe(0)
    expect(explain.status).toBe(0)
    expect(explain.stdout).toContain(`Digest: ${digest(preview.stdout)}`)
    expect(explain.stdout).toContain("Selected: team.naming")
    expect(explain.stdout).toContain("Shadowed: rule-personal-naming -> team.naming")
    expect(explain.stdout).not.toContain(personalRule)
    expect(explain.stdout).not.toContain(teamRule)
  })

  it("keeps a project rule omitted until its project selector is explicit", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { context: { maxCapsules: 16 } })
    activatePersonalRule(projectDir, "project-contract", "project-contract", "Keep the explicit project contract.", {
      key: "checkout-a",
      kind: "project",
    })

    const withoutProject = run(projectDir, ["context", "explain", "src/App.java", "--topic", "project-contract"])
    const withProject = run(projectDir, ["context", "explain", "src/App.java", "--topic", "project-contract", "--project", "checkout-a"])

    expect(withoutProject.status).toBe(0)
    expect(withoutProject.stdout).not.toContain("rule-project-contract")
    expect(withProject.status).toBe(0)
    expect(withProject.stdout).toContain("Selected: rule-project-contract")
  })

  it("renders a finite blocked resolution without raw rule content", () => {
    const projectDir = createProject()
    const privateRule = "Keep the unbounded alternate hidden."
    writeHarnessConfig(projectDir, { context: { maxCapsules: 1 } })
    activatePersonalRule(projectDir, "extra-convention", "extra-convention", privateRule, { key: "personal", kind: "personal" })

    const result = run(projectDir, ["context", "explain", "src/App.java"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Envelope status: blocked")
    expect(result.stdout).toContain("Resolution: selection-overflow")
    expect(result.stdout).not.toContain(privateRule)
  })

  it.each([
    ["traversal", ["context", "explain", "../outside.java"], "context-target-invalid"],
    ["missing selector", ["context", "explain", "src/App.java", "--task"], "context-preview-arguments-invalid"],
  ])("fails closed for %s without reflecting the input", (_label, args, code) => {
    const projectDir = createProject()
    const result = run(projectDir, args)

    expect(result).toEqual({ status: 1, stderr: `${code}\n`, stdout: "" })
    expect(result.stderr).not.toContain(args[2] ?? "")
  })

  it("keeps explanation rendering free of host, network, shell, and workflow dependencies", () => {
    const source = readFileSync(resolve(repositoryRoot, "src/cli/context-explain.ts"), "utf8")

    for (const token of ["node:child_process", "node:http", "node:https", "fetch(", "spawn(", "exec(", "@opencode-ai/plugin", "workflow", "authority", "evidence"]) {
      expect(source).not.toContain(token)
    }
  })
})

function run(projectDir: string, args: readonly string[]) {
  return runPersonaCli(args, {
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
  const storeRoot = personalizationStoreRoot(projectDir)
  mkdirSync(storeRoot, { recursive: true })
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
    storeRoot,
  })
}

function writeTeamProfile(projectDir: string, profile: Record<string, unknown>): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "team-profile.json"), `${JSON.stringify(profile, null, 2)}\n`)
}

function personalizationStoreRoot(projectDir: string): string {
  return join(realpathSync(projectDir), "personalization-store")
}

function digest(json: string): string {
  const match = /"digest":"([a-f0-9]{64})"/u.exec(json)
  if (match?.[1] === undefined) throw new TypeError("preview digest is unavailable")
  return match[1]
}
