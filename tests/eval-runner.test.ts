import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

import { afterEach, describe, expect, it } from "vitest"

import {
  aggregateRuns,
  buildPlan,
  countFailureModes,
  measureCompileResult,
  measureGradleTestResult,
  parseArgs,
  parseBackendShapeWarnCount,
  parseCommandOutcome,
  parseJUnitXmlText,
  preflight,
  scoreStackAlignmentFromObserveReport,
} from "../scripts/eval/eval-core.mjs"

const tempDirs: string[] = []

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  tempDirs.length = 0
})

describe("ON/OFF eval runner core", () => {
  it("selects a narrow one-fixture one-condition run plan", () => {
    const options = parseArgs(["--runs", "1", "--fixture", "backend-api-no-stack", "--condition", "plain", "--model", "test-model"])
    const plan = buildPlan(options)

    expect(plan.runs).toEqual([{ fixtureId: "backend-api-no-stack", conditionId: "plain", repetition: 1 }])
  })

  it("measures Gradle test from JUnit XML instead of successful log text", () => {
    const projectDir = tempDir("persona-eval-junit-")

    const fakeLogOnly = measureGradleTestResult(projectDir, {
      status: 0,
      stdout: "BUILD SUCCESSFUL in 3s",
      stderr: "",
      timedOut: false,
    })
    expect(fakeLogOnly.outcome).toBe("UNKNOWN")

    const junitDir = join(projectDir, "build", "test-results", "test")
    mkdirSync(junitDir, { recursive: true })
    writeFileSync(join(junitDir, "TEST-sample.xml"), '<testsuite tests="2" failures="1" errors="0" skipped="0"></testsuite>\n')

    expect(parseJUnitXmlText(readFixtureXml())).toEqual({ tests: 3, failures: 0, errors: 0, skipped: 1 })
    const measured = measureGradleTestResult(projectDir, {
      status: 0,
      stdout: "BUILD SUCCESSFUL in 3s",
      stderr: "",
      timedOut: false,
    })
    expect(measured).toEqual(expect.objectContaining({ outcome: "FAIL", tests: 2, failures: 1, errors: 0, skipped: 0 }))
  })

  it("measures compile from exit code plus build artifacts", () => {
    const projectDir = tempDir("persona-eval-compile-")
    expect(measureCompileResult(projectDir, { status: 0, timedOut: false })).toEqual({ outcome: "UNKNOWN", artifacts: [] })

    mkdirSync(join(projectDir, "build", "classes", "java", "main", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "build", "classes", "java", "main", "com", "example", "App.class"), "bytecode")

    expect(measureCompileResult(projectDir, { status: 0, timedOut: false })).toEqual(
      expect.objectContaining({ outcome: "PASS", artifacts: ["classes/java/main/com/example/App.class"] }),
    )
    expect(measureCompileResult(projectDir, { status: 1, timedOut: false })).toEqual({ outcome: "FAIL", artifacts: [] })
  })

  it("keeps runtime command outcome exit-code based only", () => {
    expect(parseCommandOutcome({ status: 0, stdout: "", stderr: "", timedOut: false })).toBe("PASS")
    expect(parseCommandOutcome({ status: 1, stdout: "PASS", stderr: "", timedOut: false })).toBe("FAIL")
    expect(parseCommandOutcome({ status: null, stdout: "", stderr: "", timedOut: true })).toBe("FAIL")
  })

  it("scores stack alignment from observer findings and structure", () => {
    const projectDir = tempDir("persona-eval-stack-")
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "OrderController.java"), "class OrderController { OrderService service; }\n")
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "OrderResponse.java"), "class OrderResponse {}\n")

    const score = scoreStackAlignmentFromObserveReport(
      {
        findings: [
          { ruleId: "controller.repository-dependency", result: "PASS" },
          { ruleId: "service.storage-ownership", result: "PASS" },
        ],
      },
      projectDir,
    )

    expect(score).toEqual(
      expect.objectContaining({
        rate: 1,
        score: 2,
        criteria: {
          controllerServiceDependency: true,
          noControllerRepositoryDependency: true,
          noServiceStorageOwnership: true,
          dtoBoundary: true,
        },
      }),
    )
  })

  it("counts backend-shape WARN lines from fixed report text", () => {
    expect(parseBackendShapeWarnCount("PASS\nWARN controller boundary\nWARN repository boundary\n")).toBe(2)
    expect(parseBackendShapeWarnCount("Backend-shape WARN count: 3\n")).toBe(3)
  })

  it("aggregates fixed run metadata into deterministic rates", () => {
    const runs = [
      run("backend-api-no-stack", "plain", true, true, true, 0.5, 5),
      run("backend-api-no-stack", "ph-on", true, true, true, 1, 3),
      run("backend-api-no-stack", "ph-on", true, false, null, 1, 4),
    ]

    const aggregate = aggregateRuns(runs)

    expect(aggregate.byCondition).toEqual([
      expect.objectContaining({
        fixtureId: "backend-api-no-stack",
        conditionId: "plain",
        runs: 1,
        compileBuildRate: 1,
        gradleTestRate: 1,
        runtimeSmokeRate: 1,
        externalFailureModeTotal: 5,
      }),
      expect.objectContaining({
        fixtureId: "backend-api-no-stack",
        conditionId: "ph-on",
        runs: 2,
        compileBuildRate: 1,
        gradleTestRate: 0.5,
        runtimeSmokeRate: 1,
        stackAlignmentRate: 1,
        externalFailureModeTotal: 7,
      }),
    ])
  })

  it("maps failed outcomes to failure-mode labels", () => {
    const failures = countFailureModes({
      compileBuildOutcome: "FAIL",
      gradleTestOutcome: "FAIL",
      runtimeSmokeOutcome: "FAIL",
      stackAlignmentRate: 0,
      workflowFinishOutcome: "FAIL",
      providerFailed: true,
    })

    expect(failures).toEqual({
      count: 6,
      labels: ["wrong stack", "compile failure", "test failure", "runtime smoke failure", "provider limit", "workflow dead-end"],
    })
  })

  it("fails preflight before result creation when provider prerequisites are missing", () => {
    const outputRoot = tempDir("persona-eval-no-results-")
    const result = spawnSync(
      process.execPath,
      [
        resolve("scripts/eval/run-onoff-eval.mjs"),
        "--preflight",
        "--fixture",
        "backend-api-no-stack",
        "--condition",
        "plain",
        "--model",
        "test-model",
        "--opencode-command",
        "definitely-missing-opencode-binary",
        "--output-root",
        outputRoot,
      ],
      { cwd: resolve("."), encoding: "utf8" },
    )

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("Preflight: FAIL")
    expect(result.stdout).toContain("OpenCode command not found")
    expect(readdirSync(outputRoot)).toEqual([])
  })

  it("fails replay when capture artifacts are missing", () => {
    const outputRoot = tempDir("persona-eval-replay-missing-")
    const result = spawnSync(
      process.execPath,
      [resolve("scripts/eval/run-onoff-eval.mjs"), "--replay", join(outputRoot, "missing"), "--output-root", outputRoot],
      { cwd: resolve("."), encoding: "utf8" },
    )

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("Preflight: FAIL")
    expect(result.stdout).toContain("capture raw directory not found")
    expect(readdirSync(outputRoot)).toEqual([])
  })

  it("reports PH ON install command as required during preflight", () => {
    const options = parseArgs([
      "--fixture",
      "backend-api-no-stack",
      "--condition",
      "ph-on",
      "--model",
      "test-model",
      "--opencode-command",
      "definitely-missing-opencode-binary",
    ])
    const result = preflight(options)

    expect(result.ok).toBe(false)
    expect(result.errors).toContain("PH ON requires --ph-install-command or PERSONA_HARNESS_INSTALL_COMMAND")
  })
})

function run(
  fixtureId: string,
  conditionId: string,
  compileBuildPass: boolean,
  gradleTestPass: boolean,
  runtimeSmokePass: boolean | null,
  stackAlignmentRate: number,
  externalFailureModeCount: number,
) {
  return {
    fixtureId,
    conditionId,
    metrics: {
      compileBuildPass,
      gradleTestPass,
      runtimeSmokePass,
      stackAlignmentRate,
      externalFailureModeCount,
      workflowFinishOutcome: conditionId === "ph-on" ? "PASS" : "NOT APPLICABLE",
      backendShapeWarnCount: 0,
    },
  }
}

function readFixtureXml(): string {
  return [
    '<testsuite tests="1" failures="0" errors="0" skipped="0"></testsuite>',
    '<testsuite tests="2" failures="0" errors="0" skipped="1"></testsuite>',
  ].join("\n")
}
