import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import {
  createRealCooperativeGradleFixture,
  hasRealJUnitResult,
  type RealCooperativeGradleFixture,
} from "./helpers/cooperative-real-gradle-fixture.js"

const fixtures: RealCooperativeGradleFixture[] = []

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    fixture.cleanup()
  }
})

describe("real Java/Spring Gradle cooperative Finish", () => {
  it("passes a fresh project through the public source CLI without disk authority", () => {
    // Given: a fresh Git-backed Java/Spring project with a genuine Gradle wrapper.
    const fixture = track(createRealCooperativeGradleFixture())

    // When: the public source CLI runs explicit cooperative Finish.
    const defaultFinish = run(fixture.projectDir, ["workflow", "finish", "implement"])
    const cooperativeFinish = run(fixture.projectDir, ["workflow", "finish", "implement", "--assurance", "cooperative"])
    const closure = run(fixture.projectDir, ["workflow", "closure", "next", "--json"])

    // Then: real JUnit exists, cooperative Finish passes, and later closure stays external-blocked.
    expect(defaultFinish.status).toBe(1)
    expect(cooperativeFinish.status, cooperativeFinish.stderr).toBe(0)
    expect(cooperativeFinish.stdout).toContain("Finish status: PASS")
    expect(hasRealJUnitResult(fixture.projectDir)).toBe(true)
    expect(readFileSync(join(fixture.projectDir, "build", "test-results", "test", "TEST-example.cooperative.CooperativeApplicationTest.xml"), "utf8"))
      .toContain("<testcase")
    expect(JSON.parse(closure.stdout)).toMatchObject({ state: { finish: "blocked" } })
    expect(closure.stdout).toContain("trusted-authority-required")
    expect(existsSync(join(fixture.projectDir, ".persona", "custom-evidence", "verification-receipts"))).toBe(false)
    expect(existsSync(join(fixture.projectDir, ".persona", "custom-evidence", "verification-attempts"))).toBe(false)
    expect(existsSync(join(fixture.projectDir, ".persona", "custom-evidence", "finish-attestation"))).toBe(false)
  }, 300_000)

  it("drives a fresh Java/Spring Gradle project through public bootstrap, reports, and cooperative Finish", () => {
    // Given: a Git-backed Spring/Gradle project without pre-seeded Persona records.
    const fixture = track(createRealCooperativeGradleFixture())
    resetToFreshProject(fixture.projectDir)

    // When: the public CLI creates and completes the normal workflow before Finish.
    const bootstrap = run(fixture.projectDir, ["bootstrap", "backend", "--strict", "--no-developer-mcp"])
    const test = run(fixture.projectDir, ["bearshell", "./gradlew", "test"])
    const compile = run(fixture.projectDir, ["bearshell", "./gradlew", "compileJava"])
    const clean = run(fixture.projectDir, ["bearshell", "./gradlew", "clean"])
    const implementation = run(
      fixture.projectDir,
      ["plan", "--report-filled", "implementation", "--stdin"],
      publicImplementationReport(),
    )
    const review = run(
      fixture.projectDir,
      ["plan", "--report-filled", "review", "--stdin"],
      publicReviewReport(),
    )
    const defaultFinish = run(fixture.projectDir, ["workflow", "finish", "implement"])
    const cooperativeFinish = run(fixture.projectDir, ["workflow", "finish", "implement", "--assurance", "cooperative"])
    const closure = run(fixture.projectDir, ["workflow", "closure", "next", "--json"])

    // Then: only explicit same-invocation cooperative Finish may pass.
    expect(bootstrap.status, bootstrap.stderr).toBe(0)
    expect(test.status, test.stderr).toBe(0)
    expect(compile.status, compile.stderr).toBe(0)
    expect(clean.status, clean.stderr).toBe(0)
    expect(implementation.status, implementation.stderr).toBe(0)
    expect(review.status, review.stderr).toBe(0)
    expect(defaultFinish.status).toBe(1)
    expect(defaultFinish.stderr).toContain("trusted-authority-required")
    expect(cooperativeFinish.status, cooperativeFinish.stderr).toBe(0)
    expect(cooperativeFinish.stdout).toContain("Finish status: PASS")
    expect(JSON.parse(closure.stdout)).toMatchObject({ state: { finish: "blocked" } })
    expect(closure.stdout).toContain("trusted-authority-required")
  }, 300_000)
})

function run(projectDir: string, args: readonly string[], stdin?: string) {
  return runPersonaCli(args, { cwd: projectDir, env: {}, invocationName: "ph", stdin })
}

function track(fixture: RealCooperativeGradleFixture): RealCooperativeGradleFixture {
  fixtures.push(fixture)
  return fixture
}

function resetToFreshProject(projectDir: string): void {
  rmSync(join(projectDir, ".persona"), { force: true, recursive: true })
  execFileSync("git", ["add", "--all"], { cwd: projectDir })
  execFileSync("git", ["commit", "-qm", "remove pre-seeded Persona records"], { cwd: projectDir })
}

function publicImplementationReport(): string {
  return [
    "Status: filled",
    "- README ranges read: all",
    "- Project profile ranges read: all",
    "- `npx ph bearshell ./gradlew test`",
    "- `npx ph bearshell ./gradlew compileJava`",
  ].join("\n")
}

function publicReviewReport(): string {
  return [
    "Status: filled",
    "- Manual QA reviewed the Java/Spring Gradle project.",
    "- `npx ph bearshell ./gradlew clean`",
  ].join("\n")
}
