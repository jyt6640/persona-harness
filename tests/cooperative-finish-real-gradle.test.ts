import { existsSync, readFileSync } from "node:fs"
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
})

function run(projectDir: string, args: readonly string[]) {
  return runPersonaCli(args, { cwd: projectDir, env: {}, invocationName: "ph" })
}

function track(fixture: RealCooperativeGradleFixture): RealCooperativeGradleFixture {
  fixtures.push(fixture)
  return fixture
}
