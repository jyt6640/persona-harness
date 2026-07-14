import { execFileSync } from "node:child_process"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runFreshFixedVerification } from "../src/cli/fresh-verification-runner.js"
import {
  assessVerificationAuthority,
  parseVerificationAttempt,
  parseVerificationReceipt,
} from "../src/cli/workflow-verification-receipt.js"

const projects: string[] = []

afterEach(() => {
  for (const project of projects) {
    rmSync(project, { force: true, recursive: true })
  }
  projects.length = 0
})

describe("fresh fixed-command verification runner", () => {
  it("writes a bound completed attempt and local receipt only after fresh tests run", () => {
    const projectDir = createProject(successScript())

    const result = runFreshFixedVerification(projectDir, "ci", {
      finishId: "finish-test-001",
      idFactory: () => "session-test-001",
      now: () => Date.now(),
    })

    expect(result.finalStatus).toBe("passed")
    expect(result.decision).toMatchObject({
      status: "diagnostic-only",
    })
    expect(result.testCount).toBe(1)
    expect(result.attemptPath).toContain(".persona/evidence/verification-attempts/")
    expect(result.receiptPath).toContain(".persona/evidence/verification-receipts/")

    const attemptSource = readFileSync(result.attemptPath ?? "", "utf8")
    const receiptSource = readFileSync(result.receiptPath ?? "", "utf8")
    const parsedAttempt = parseVerificationAttempt(attemptSource, "attempt.json")
    const parsedReceipt = parseVerificationReceipt(receiptSource, "receipt.json")

    expect(parsedAttempt).toMatchObject({ ok: true })
    expect(parsedReceipt).toMatchObject({ ok: true })
    expect(assessVerificationAuthority(projectDir, new Date())).toMatchObject({
      authorityEligible: false,
      state: "untrusted",
    })
    expect(attemptSource).not.toContain("secret-output")
    expect(receiptSource).not.toContain("secret-output")
  })

  it("fails closed on a zero-test command and does not issue a receipt", () => {
    const projectDir = createProject("#!/bin/sh\nprintf 'BUILD SUCCESSFUL\\n'\nexit 0\n")

    const result = runFreshFixedVerification(projectDir, "ci", {
      finishId: "finish-test-zero",
      idFactory: () => "session-test-zero",
      now: () => Date.now(),
    })

    expect(result.finalStatus).toBe("failed")
    expect(result.decision).toMatchObject({
      status: "diagnostic-only",
    })
    expect(result.testCount).toBe(0)
    expect(result.diagnosticCodes).toContain("zero-test-count")
    expect(result.receiptPath).toBeUndefined()
    expect(result.attemptPath).toContain(".persona/evidence/verification-attempts/")

    const attempt = parseVerificationAttempt(readFileSync(result.attemptPath ?? "", "utf8"), "attempt.json")
    expect(attempt).toMatchObject({ ok: true, value: { status: "failed", receiptId: null } })
  })

  it("does not overwrite an existing attempt when an invocation identity repeats", () => {
    const projectDir = createProject(successScript())
    const first = runFreshFixedVerification(projectDir, "ci", {
      finishId: "finish-test-repeat",
      idFactory: () => "session-test-repeat",
    })
    const artifactPath = first.artifactPath
    const attemptPath = first.attemptPath
    if (artifactPath === undefined || attemptPath === undefined) {
      throw new Error("expected the first fresh verification to create bound records")
    }
    const before = readFileSync(attemptPath, "utf8")

    const repeated = runFreshFixedVerification(projectDir, "ci", {
      finishId: "finish-test-repeat",
      idFactory: () => "session-test-repeat",
      runReverification: () => ({ artifactPath, diagnosticCodes: [], finalStatus: "passed" as const }),
    })

    expect(repeated.finalStatus).toBe("artifact-invalid")
    expect(repeated.diagnosticCodes).toContain("fresh-attempt-write-invalid")
    expect(readFileSync(attemptPath, "utf8")).toBe(before)
  })
})

function createProject(gradleWrapper: string): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-fresh-verification-"))
  projects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "evidence"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), `${JSON.stringify({
    enforce: { executeVerification: true, tdd: false },
  }, null, 2)}\n`)
  writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), `${JSON.stringify({
    defaults: { buildTool: "gradle", framework: "spring", language: "java" },
    questions: [
      { answer: "ko", id: "user-language" },
      { answer: "team", id: "project-context" },
      { answer: "production-service", id: "project-goal" },
      { answer: "long-lived", id: "project-scale" },
      { answer: "rest-api", id: "application-type" },
      { answer: "database", id: "storage" },
      { answer: "jpa", id: "persistence-technology" },
      { answer: "flyway", id: "migration-style" },
      { answer: "domain-first", id: "package-style" },
      { answer: "clean-architecture-light", id: "architecture-style" },
      { answer: "strict", id: "boundary-strictness" },
    ],
    schema: "persona.project-profile.v1",
    scope: { mvp: "java-spring-clean-code", role: "backend" },
    status: "ready",
  }, null, 2)}\n`)
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
  writeFileSync(join(projectDir, "gradlew"), gradleWrapper)
  chmodSync(join(projectDir, "gradlew"), 0o755)
  execFileSync("git", ["init", "-q"], { cwd: projectDir })
  execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: projectDir })
  execFileSync("git", ["config", "user.name", "PH Test"], { cwd: projectDir })
  execFileSync("git", ["add", "."], { cwd: projectDir })
  execFileSync("git", ["commit", "-qm", "fresh verification fixture"], { cwd: projectDir })
  return projectDir
}

function successScript(): string {
  return [
    "#!/bin/sh",
    "mkdir -p build/test-results/test",
    "printf '%s\\n' '<testsuite tests=\"1\" failures=\"0\" errors=\"0\"><testcase classname=\"ExampleTest\" name=\"works\"/></testsuite>' > build/test-results/test/TEST-example.xml",
    "printf 'secret-output\\n'",
    "exit 0",
  ].join("\n") + "\n"
}
