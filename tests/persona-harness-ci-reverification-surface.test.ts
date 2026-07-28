import { execFileSync } from "node:child_process"
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { createDirectProjectRoot } from "./helpers/direct-project-root.js"

const projects: string[] = []

function git(projectDir: string, args: readonly string[]): void {
  execFileSync("git", [...args], { cwd: projectDir, stdio: "ignore" })
}

function createBootstrappedProject(gradlew?: string): string {
  const projectDir = createDirectProjectRoot("persona-ci-surface")
  projects.push(projectDir)
  const bootstrap = runPersonaCli(["bootstrap", "backend", "--no-developer-mcp"], {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
  })
  expect(bootstrap.status).toBe(0)
  mkdirSync(join(projectDir, ".persona", "evidence"), { recursive: true })
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), `${JSON.stringify({
    enforce: { executeVerification: true, tdd: false },
  }, null, 2)}\n`)
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "- README ranges read: 1-20",
      "- Project profile ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
      "- Direct verification observed passing JUnit output.",
    ].join("\n") + "\n",
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    [
      "Status: filled",
      "- Manual QA reviewed the fixed-command verification surface.",
      "- No source mutation was observed.",
    ].join("\n") + "\n",
  )
  writeFileSync(join(projectDir, ".persona", "evidence", ".gitkeep"), "")
  writeFileSync(
    join(projectDir, "gradlew"),
    gradlew ?? [
      "#!/bin/sh",
      "mkdir -p build/test-results/test",
      "printf '%s\\n' '<testsuite tests=\"1\" failures=\"0\" errors=\"0\"><testcase classname=\"SurfaceTest\" name=\"works\"/></testsuite>' > build/test-results/test/TEST-surface.xml",
      "exit 0",
    ].join("\n") + "\n",
  )
  chmodSync(join(projectDir, "gradlew"), 0o755)
  git(projectDir, ["init", "-q"])
  git(projectDir, ["config", "user.email", "ph@example.invalid"])
  git(projectDir, ["config", "user.name", "PH Test"])
  git(projectDir, ["add", "."])
  git(projectDir, ["commit", "-qm", "fixture"])
  return projectDir
}

afterEach(() => {
  for (const project of projects) rmSync(project, { force: true, recursive: true })
  projects.length = 0
})

describe.sequential("CI reverification public surface", () => {
  it("keeps plaintext finish and closure-next JSON unchanged after a passing reverify attempt", () => {
    const projectDir = createBootstrappedProject()
    const plain = runPh(projectDir, ["workflow", "finish", "implement"])
    const closureBefore = runPh(projectDir, ["workflow", "closure", "next", "--json"])

    const reverified = runPh(projectDir, ["workflow", "finish", "implement", "--reverify", "--ci"])
    const closureAfter = runPh(projectDir, ["workflow", "closure", "next", "--json"])

    expect(reverified).toEqual(plain)
    expect(JSON.parse(closureAfter.stdout)).toEqual(JSON.parse(closureBefore.stdout))
    expect(closureAfter.stdout).not.toContain("ciReverification")
  })

  it("rejects bare CI before creating reverification evidence", () => {
    const projectDir = createBootstrappedProject()
    const result = runPh(projectDir, ["workflow", "finish", "implement", "--ci"], { CI: "true" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("workflow finish --ci requires --reverify")
    expect(result.stderr).not.toContain("ph-ci-reverification.1")
  })

  it("does not let an ambient CI environment select reverification", () => {
    const projectDir = createBootstrappedProject()
    const plain = runPh(projectDir, ["workflow", "finish", "implement"])
    const ambientCi = runPh(projectDir, ["workflow", "finish", "implement"], { CI: "true" })

    expect(ambientCi).toEqual(plain)
  })

  it("keeps reverify artifact diagnostics project-relative", () => {
    const projectDir = createBootstrappedProject([
      "#!/bin/sh",
      "mkdir -p build/test-results/test",
      "printf '%s\\n' '<testsuite' > build/test-results/test/TEST-surface.xml",
      "exit 0",
    ].join("\n") + "\n")
    const result = runPh(projectDir, ["workflow", "finish", "implement", "--reverify", "--ci"])

    expect(result.status).toBe(1)
    expect(result.stdout).not.toContain(projectDir)
    expect(result.stderr).not.toContain(projectDir)
    expect(result.stderr).toContain("artifact: .persona/evidence/ci-reverification/")
    expect(result.stderr).toContain("junit-malformed-xml")
  })
})

function runPh(projectDir: string, args: readonly string[], env: Readonly<Record<string, string>> = {}) {
  return runPersonaCli(args, { cwd: projectDir, env, invocationName: "ph" })
}
