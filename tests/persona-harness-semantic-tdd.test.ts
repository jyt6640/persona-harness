import { execFileSync } from "node:child_process"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { readWorkflowFinishAuthority } from "../src/cli/workflow-finish-authority.js"
import { runFreshFixedVerification } from "../src/cli/fresh-verification-runner.js"
import { assessSemanticTddChain } from "../src/cli/workflow-semantic-tdd.js"

const projects: string[] = []

afterEach(() => {
  for (const project of projects) rmSync(project, { force: true, recursive: true })
  projects.length = 0
})

describe("semantic TDD red-to-green evidence", () => {
  it("accepts a fresh red-to-green chain as structurally valid but untrusted", () => {
    const projectDir = createProject(semanticScript(matchingTestcase()))
    runChain(projectDir)
    const before = evidenceSnapshot(projectDir)

    const assessment = assessSemanticTddChain(projectDir)
    const authority = readWorkflowFinishAuthority(projectDir)

    expect(assessment.state).toBe("valid-untrusted")
    expect(assessment.authorityEligible).toBe(false)
    expect(assessment.red?.testcaseId).toBe("com.example.TodoTest#createsTodo")
    expect(assessment.green?.testcaseId).toBe("com.example.TodoTest#createsTodo")
    expect(authority.status).toBe("blocked")
    expect(authority.blocker.id).toBe("trusted-authority-required")
    expect(authority.blocker.reason).toContain("Semantic TDD assessment:")
    expect(evidenceSnapshot(projectDir)).toBe(before)
  })

  it("rejects green without a preceding red phase", () => {
    const projectDir = createProject(alwaysGreenScript())
    const result = runFreshFixedVerification(projectDir, "ci", {
      finishId: "semantic-finish",
      idFactory: () => "semantic-session",
      now: () => Date.now(),
    })

    expect(result.finalStatus).toBe("passed")
    expect(assessSemanticTddChain(projectDir).state).toBe("missing-red")
  })

  it("rejects a red phase that occurs after the green phase", () => {
    const projectDir = createProject(semanticScript(matchingTestcase()))
    runChain(projectDir)
    const attemptDir = join(projectDir, ".persona", "evidence", "verification-attempts")
    const failedAttemptName = readdirSync(attemptDir).find((entry) => {
      if (!entry.endsWith(".json")) return false
      const candidate = JSON.parse(readFileSync(join(attemptDir, entry), "utf8")) as Readonly<Record<string, unknown>>
      return candidate.status === "failed"
    })
    expect(failedAttemptName).toBeDefined()
    if (failedAttemptName === undefined) throw new Error("failed attempt fixture was not created")
    const failedAttemptPath = join(attemptDir, failedAttemptName)
    const failedAttempt = JSON.parse(readFileSync(failedAttemptPath, "utf8")) as Readonly<Record<string, unknown>>
    writeFileSync(failedAttemptPath, `${JSON.stringify({
      ...failedAttempt,
      startedAt: new Date(Date.now() + 60_000).toISOString(),
    }, null, 2)}\n`)

    const assessment = assessSemanticTddChain(projectDir)
    expect(assessment.state).toBe("ordering-invalid")
    expect(assessment.diagnosticCodes).toContain("semantic-order-invalid")
  })

  it("rejects a changed testcase identity between red and green", () => {
    const projectDir = createProject(semanticScript({
      red: { classname: "com.example.TodoTest", name: "createsTodo" },
      green: { classname: "com.example.OtherTest", name: "createsTodo" },
    }))
    runChain(projectDir)

    const assessment = assessSemanticTddChain(projectDir)
    expect(assessment.state).toBe("mismatch")
    expect(assessment.diagnosticCodes).toContain("semantic-testcase-mismatch")
  })

  it("rejects changed source and provenance bindings", () => {
    const projectDir = createProject(semanticScript(matchingTestcase()))
    const first = runFreshFixedVerification(projectDir, "ci", {
      finishId: "semantic-finish",
      idFactory: () => "semantic-session",
      now: () => Date.now(),
    })
    writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App { int changed; }\n")
    execFileSync("git", ["add", "src/main/java/App.java"], { cwd: projectDir })
    execFileSync("git", ["commit", "-qm", "source changed"], { cwd: projectDir })
    runFreshFixedVerification(projectDir, "ci", {
      finishId: "semantic-finish",
      idFactory: () => "semantic-session",
      now: () => Date.now(),
    })

    expect(first.finalStatus).toBe("failed")
    const assessment = assessSemanticTddChain(projectDir)
    expect(assessment.state).toBe("mismatch")
    expect(assessment.diagnosticCodes).toContain("semantic-binding-mismatch")
  })

  it("rejects byte-only source drift that preserves the current Git status record", () => {
    const projectDir = createProject(semanticScript(matchingTestcase()))
    const sourcePath = join(projectDir, "src", "main", "java", "App.java")
    writeFileSync(sourcePath, "class App { int firstChange; }\n")
    runChain(projectDir)
    writeFileSync(sourcePath, "class App { int secondChange; }\n")

    const assessment = assessSemanticTddChain(projectDir)

    expect(assessment.state).toBe("mismatch")
    expect(assessment.diagnosticCodes).toContain("semantic-binding-mismatch")
  })

  it("rejects a provenance-only receipt mutation", () => {
    const projectDir = createProject(semanticScript(matchingTestcase()))
    runChain(projectDir)
    const receiptDir = join(projectDir, ".persona", "evidence", "verification-receipts")
    const receiptName = readDirEntry(receiptDir)
    const receiptPath = join(receiptDir, `${receiptName}.json`)
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as Readonly<Record<string, unknown>>
    writeFileSync(receiptPath, `${JSON.stringify({
      ...receipt,
      provenanceDigest: `sha256:${"0".repeat(64)}`,
    }, null, 2)}\n`)

    const assessment = assessSemanticTddChain(projectDir)

    expect(assessment.state).toBe("mismatch")
    expect(assessment.diagnosticCodes).toContain("semantic-binding-mismatch")
  })

  it("rejects a red and green attempt with different session lineage", () => {
    const projectDir = createProject(semanticScript(matchingTestcase()))
    expect(runFreshFixedVerification(projectDir, "ci", {
      finishId: "semantic-finish",
      idFactory: () => "red-session",
      now: () => Date.now(),
    }).finalStatus).toBe("failed")
    expect(runFreshFixedVerification(projectDir, "ci", {
      finishId: "semantic-finish",
      idFactory: () => "green-session",
      now: () => Date.now(),
    }).finalStatus).toBe("passed")

    const assessment = assessSemanticTddChain(projectDir)

    expect(assessment.state).toBe("mismatch")
    expect(assessment.diagnosticCodes).toContain("semantic-binding-mismatch")
  })

  it("rejects a fresh artifact with a forged command plan", () => {
    const projectDir = createProject(semanticScript(matchingTestcase()))
    runChain(projectDir)
    const artifactDir = join(projectDir, ".persona", "evidence", "ci-reverification")
    const artifactName = readdirSync(artifactDir).find((entry) => {
      if (!entry.endsWith(".json")) return false
      const candidate = JSON.parse(readFileSync(join(artifactDir, entry), "utf8")) as Readonly<Record<string, unknown>>
      return candidate.finalStatus === "passed"
    })
    expect(artifactName).toBeDefined()
    if (artifactName === undefined) throw new Error("green artifact fixture was not created")
    const artifactPath = join(artifactDir, artifactName)
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as Readonly<Record<string, unknown>>
    writeFileSync(artifactPath, `${JSON.stringify({
      ...artifact,
      commandPlanSha256: "f".repeat(64),
    }, null, 2)}\n`)

    const assessment = assessSemanticTddChain(projectDir)

    expect(assessment.state).toBe("invalid")
    expect(assessment.diagnosticCodes).toContain("semantic-artifact-invalid")
  })

  it("rejects replayed phase records and preserves legacy evidence as diagnostic-only", () => {
    const projectDir = createProject(semanticScript(matchingTestcase()))
    runChain(projectDir)
    const receiptPath = join(projectDir, ".persona", "evidence", "verification-receipts")
    const receipt = readFileSync(join(receiptPath, `${readDirEntry(receiptPath)}.json`), "utf8")
    writeFileSync(join(receiptPath, "replayed.json"), receipt)

    const assessment = assessSemanticTddChain(projectDir)
    expect(assessment.state).toBe("replayed")
    expect(assessment.diagnosticCodes).toContain("semantic-replayed")

    const legacyProject = createProject(alwaysGreenScript())
    const legacyPath = join(legacyProject, ".persona", "evidence", "phase0", "forged.json")
    mkdirSync(join(legacyPath, ".."), { recursive: true })
    const legacyBytes = '{"generatedBy":"persona-harness","status":0,"digest":"sha256:forged","head":"deadbeef","command":"arbitrary","exit":0,"attemptId":"stale"}\n'
    writeFileSync(legacyPath, legacyBytes)
    const legacyAssessment = assessSemanticTddChain(legacyProject)
    expect(legacyAssessment.state).toBe("legacy-only")
    expect(legacyAssessment.diagnosticCodes).toContain("semantic-legacy-only")
    expect(readFileSync(legacyPath, "utf8")).toBe(legacyBytes)
  })

  it("accepts the intended testcase when green contains additional passing cases", () => {
    const projectDir = createProject(semanticScript({
      ...matchingTestcase(),
      greenAdditional: { classname: "com.example.OtherTest", name: "unrelatedPass" },
    }))
    runChain(projectDir)

    const assessment = assessSemanticTddChain(projectDir)
    expect(assessment.state).toBe("valid-untrusted")
    expect(assessment.green?.testcaseId).toBe("com.example.TodoTest#createsTodo")
  })

  it("rejects a zero-test green attempt and retains the finish blocker", () => {
    const projectDir = createProject(semanticScript({ ...matchingTestcase(), greenZeroTests: true }))
    expect(runFreshFixedVerification(projectDir, "ci", { finishId: "semantic-finish", idFactory: () => "semantic-session", now: () => Date.now() }).finalStatus).toBe("failed")
    expect(runFreshFixedVerification(projectDir, "ci", { finishId: "semantic-finish", idFactory: () => "semantic-session", now: () => Date.now() }).finalStatus).toBe("failed")

    const assessment = assessSemanticTddChain(projectDir)
    expect(assessment.state).toBe("missing-green")
    expect(readWorkflowFinishAuthority(projectDir).blocker.id).toBe("trusted-authority-required")
  })

  it("rejects a mutable JUnit path that overwrites red evidence", () => {
    const projectDir = createProject(semanticScript({ ...matchingTestcase(), reuseJUnitPath: true }))
    runChain(projectDir)

    const assessment = assessSemanticTddChain(projectDir)
    expect(assessment.state).toBe("invalid")
    expect(assessment.diagnosticCodes).toContain("semantic-junit-failure-missing")
  })

  it("rejects an expired green receipt without writing during assessment", () => {
    const projectDir = createProject(semanticScript(matchingTestcase()))
    runChain(projectDir)
    const receiptDir = join(projectDir, ".persona", "evidence", "verification-receipts")
    const receiptName = readDirEntry(receiptDir)
    const receiptPath = join(receiptDir, `${receiptName}.json`)
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as Readonly<Record<string, unknown>>
    const issuedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    writeFileSync(receiptPath, `${JSON.stringify({
      ...receipt,
      issuedAt,
      expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    }, null, 2)}\n`)
    const before = evidenceSnapshot(projectDir)

    const assessment = assessSemanticTddChain(projectDir)

    expect(assessment.state).toBe("invalid")
    expect(assessment.diagnosticCodes).toContain("semantic-artifact-invalid")
    expect(evidenceSnapshot(projectDir)).toBe(before)
  })

  it("rejects missing JUnit failure evidence and self-declared JSON-only evidence", () => {
    const noFailureProject = createProject(semanticScript({
      red: matchingTestcase().red,
      green: matchingTestcase().green,
      redFailure: false,
    }))
    runChain(noFailureProject)
    expect(assessSemanticTddChain(noFailureProject).diagnosticCodes).toContain("semantic-junit-failure-missing")

    const forgedProject = createProject(alwaysGreenScript())
    mkdirSync(join(forgedProject, ".persona", "evidence", "tdd"), { recursive: true })
    writeFileSync(join(forgedProject, ".persona", "evidence", "tdd", "forged.json"), JSON.stringify({
      generatedBy: "persona-harness",
      status: "pass",
      digest: `sha256:${"f".repeat(64)}`,
    }))
    expect(assessSemanticTddChain(forgedProject).state).toBe("legacy-only")
  })
})

type TestcaseSpec = {
  readonly classname: string
  readonly name: string
}

type ScriptOptions = {
  readonly greenAdditional?: TestcaseSpec
  readonly greenZeroTests?: boolean
  readonly green: TestcaseSpec
  readonly red: TestcaseSpec
  readonly redFailure?: boolean
  readonly reuseJUnitPath?: boolean
}

function matchingTestcase(): ScriptOptions {
  return {
    green: { classname: "com.example.TodoTest", name: "createsTodo" },
    red: { classname: "com.example.TodoTest", name: "createsTodo" },
  }
}

function createProject(script: string): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-semantic-tdd-"))
  projects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "evidence"), { recursive: true })
  mkdirSync(join(projectDir, "src", "main", "java"), { recursive: true })
  writeFileSync(join(projectDir, ".gitignore"), "build/\n.persona/evidence/\n")
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
  writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App {}\n")
  writeFileSync(join(projectDir, "gradlew"), script)
  chmodSync(join(projectDir, "gradlew"), 0o755)
  execFileSync("git", ["init", "-q"], { cwd: projectDir })
  execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: projectDir })
  execFileSync("git", ["config", "user.name", "PH Test"], { cwd: projectDir })
  execFileSync("git", ["add", "."], { cwd: projectDir })
  execFileSync("git", ["commit", "-qm", "semantic TDD fixture"], { cwd: projectDir })
  return projectDir
}

function runChain(projectDir: string): void {
  const options = { finishId: "semantic-finish", idFactory: () => "semantic-session" }
  expect(runFreshFixedVerification(projectDir, "ci", { ...options, now: () => Date.now() }).finalStatus).toBe("failed")
  const green = runFreshFixedVerification(projectDir, "ci", { ...options, now: () => Date.now() })
  expect(green.finalStatus).toBe("passed")
}

function semanticScript(options: ScriptOptions): string {
  const stateDir = mkdtempSync(join(tmpdir(), "persona-semantic-tdd-state-"))
  const statePath = join(stateDir, "run.txt")
  writeFileSync(statePath, "0")
  projects.push(stateDir)
  const redFailure = options.redFailure ?? true
  const redPhase = options.reuseJUnitPath ? "test" : "red"
  const greenPhase = options.reuseJUnitPath ? "test" : "green"
  return [
    "#!/bin/sh",
    "set -eu",
    `run="$(cat '${statePath.replaceAll("'", "'\\''")}')"`,
    `printf '%s' "$((run + 1))" > '${statePath.replaceAll("'", "'\\''")}'`,
    'if [ "$run" = "0" ]; then',
    ...(redFailure ? junitXml(options.red, true, redPhase) : junitXml(options.red, false, redPhase)),
    "  exit 1",
    "fi",
    ...(options.greenZeroTests
      ? emptyJUnitXml(greenPhase)
      : junitXml(options.green, false, greenPhase, options.greenAdditional)),
    "exit 0",
    "",
  ].join("\n")
}

function alwaysGreenScript(): string {
  return [
    "#!/bin/sh",
    "set -eu",
    "mkdir -p build/test-results/test",
    "cat > build/test-results/test/TEST-tdd.xml <<'XML'",
    '<testsuite tests="1" failures="0" errors="0"><testcase classname="com.example.TodoTest" name="createsTodo"/></testsuite>',
    "XML",
    "exit 0",
    "",
  ].join("\n")
}

function junitXml(testcase: TestcaseSpec, failed: boolean, phase = "test", additional?: TestcaseSpec): readonly string[] {
  const count = additional === undefined ? 1 : 2
  const extra = additional === undefined ? "" : `<testcase classname="${additional.classname}" name="${additional.name}"/>`
  if (!failed) {
    return [
      `mkdir -p build/test-results/test/${phase}`,
      `cat > build/test-results/test/${phase}/TEST-tdd.xml <<'XML'`,
      `<testsuite tests="${count}" failures="0" errors="0"><testcase classname="${testcase.classname}" name="${testcase.name}"/>${extra}</testsuite>`,
      "XML",
    ]
  }
  return [
    `mkdir -p build/test-results/test/${phase}`,
    `cat > build/test-results/test/${phase}/TEST-tdd.xml <<'XML'`,
    `<testsuite tests="1" failures="1" errors="0"><testcase classname="${testcase.classname}" name="${testcase.name}"><failure message="expected service path">Assertion failed</failure></testcase></testsuite>`,
    "XML",
  ]
}

function emptyJUnitXml(phase: string): readonly string[] {
  return [
    `mkdir -p build/test-results/test/${phase}`,
    `cat > build/test-results/test/${phase}/TEST-tdd.xml <<'XML'`,
    '<testsuite tests="0" failures="0" errors="0"></testsuite>',
    "XML",
  ]
}

function evidenceSnapshot(projectDir: string): string {
  const root = join(projectDir, ".persona", "evidence")
  const files: string[] = []
  function visit(directory: string): void {
    for (const entry of requireEntries(directory)) {
      const child = join(directory, entry)
      if (entry.endsWith(".json")) files.push(`${child}:${readFileSync(child, "utf8")}`)
      else if (entry.includes(".")) continue
      else visit(child)
    }
  }
  visit(root)
  return files.sort().join("\n")
}

function requireEntries(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).map((entry) => entry.name)
}

function readDirEntry(directory: string): string {
  return requireEntries(directory).find((entry) => entry.endsWith(".json") && entry !== "replayed.json")?.replace(/\.json$/u, "") ?? ""
}
