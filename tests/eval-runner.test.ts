import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

import { afterEach, describe, expect, it } from "vitest"

import {
  aggregateRuns,
  buildPlan,
  countFailureModes,
  decideResults,
  DECISION_POLICIES,
  DEFAULT_OUTPUT_ROOT,
  buildCommandForToolchain,
  detectGeneratedToolchain,
  FIXTURE_METADATA,
  findAmbientInfluencePaths,
  measureCompileResult,
  measureGradleTestResult,
  measureToolchainTestResult,
  parseArgs,
  parseBackendShapeWarnCount,
  parseCommandOutcome,
  formatCommand,
  parseJUnitXmlText,
  preflight,
  classifyProviderToolCompletion,
  runEval,
  runShellAsync,
  scanWorkspacePurity,
  scoreFixtureStackToolchain,
  scoreStackAlignmentFromObserveReport,
  testCommandForToolchain,
  COMPLETION_SEMANTICS_VERSION,
  TOOLCHAIN_SCORING_VERSION,
} from "../scripts/eval/eval-core.mjs"

const tempDirs: string[] = []

type ReplayRuntimeRun = {
  readonly fixtureId: string
  readonly fixtureMetadata: Record<string, unknown>
  readonly conditionId: string
  readonly fixtureStackToolchain: Record<string, unknown>
  readonly outcomes: {
    readonly runtimeSmokeOutcome: string
    readonly workflowFinishOutcome: string
  }
  readonly metrics: {
    readonly runtimeSmokePass: boolean | null
    readonly stackToolchainMatches: boolean | null
    readonly stackToolchainMatchReason: string
    readonly externalFailureModeLabels: readonly string[]
    readonly operationalFailureModeLabels: readonly string[]
    readonly workflowFinishOutcome: string
  }
}

type ReplayResults = {
  readonly decisionPolicy?: string
  readonly toolchainScoringVersion?: string
  readonly completionSemanticsVersion?: string
  readonly fixtureMetadata: Record<string, unknown>
  readonly aggregate: Record<string, unknown>
  readonly runs: readonly ReplayRuntimeRun[]
}

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

  it("defaults eval output outside the repository tree", () => {
    const options = parseArgs(["--runs", "1", "--fixture", "backend-api-no-stack", "--condition", "plain", "--model", "test-model"])

    expect(options.outputRoot).toBe(DEFAULT_OUTPUT_ROOT)
    expect(resolve(String(options.outputRoot))).toContain(tmpdir())
  })

  it("selects the reduced multi-step fixture for scope-sensitivity evals", () => {
    const options = parseArgs(["--runs", "1", "--fixture", "multi-step-backend-small", "--condition", "ph-on", "--model", "test-model"])
    const plan = buildPlan(options)

    expect(plan.fixtureIds).toEqual(["multi-step-backend-small"])
    expect(plan.fixtureMetadata["multi-step-backend-small"]).toEqual({
      scopeClass: "reduced-single-turn",
      singleTurnEligible: true,
      pairedWith: "multi-step-backend",
      stackToolchain: {
        expectation: "java-spring-gradle-pinned",
        expectedStack: "java",
        expectedFramework: "spring",
        expectedBuildTool: "gradle",
      },
    })
    expect(plan.runs).toEqual([{ fixtureId: "multi-step-backend-small", conditionId: "ph-on", repetition: 1 }])
  })

  it("classifies fixture scope for single-turn and continuation evals", () => {
    const options = parseArgs(["--runs", "1", "--fixture", "all", "--condition", "plain", "--model", "test-model"])
    const plan = buildPlan(options)

    expect(FIXTURE_METADATA["backend-api-no-stack"]).toEqual({
      scopeClass: "single-turn",
      singleTurnEligible: true,
      stackToolchain: {
        expectation: "free-stack",
        expectedStack: "any",
        expectedFramework: "any",
        expectedBuildTool: "any",
      },
    })
    expect(FIXTURE_METADATA["ambiguous-idea-first"]).toEqual({
      scopeClass: "single-turn",
      singleTurnEligible: true,
      stackToolchain: {
        expectation: "free-stack",
        expectedStack: "any",
        expectedFramework: "any",
        expectedBuildTool: "any",
      },
    })
    expect(plan.fixtureMetadata["multi-step-backend"]).toEqual({
      scopeClass: "stress-continuation",
      singleTurnEligible: false,
      stackToolchain: {
        expectation: "java-spring-gradle-pinned",
        expectedStack: "java",
        expectedFramework: "spring",
        expectedBuildTool: "gradle",
      },
    })
    expect(plan.fixtureMetadata["multi-step-backend-small"]).toEqual({
      scopeClass: "reduced-single-turn",
      singleTurnEligible: true,
      pairedWith: "multi-step-backend",
      stackToolchain: {
        expectation: "java-spring-gradle-pinned",
        expectedStack: "java",
        expectedFramework: "spring",
        expectedBuildTool: "gradle",
      },
    })
  })

  it("uses the current OpenCode CLI surface by default", () => {
    const options = parseArgs(["--runs", "1", "--fixture", "backend-api-no-stack", "--condition", "plain", "--model", "openai/test"])
    const command = formatCommand(options.opencodeCommand, {
      model: options.model,
      prompt: "Respond with OK only. Do not create or edit files.",
      promptFile: "/tmp/prompt.txt",
      workspaceDir: "/tmp/workspace",
      message: "README.md 보고 구현해줘",
      temperature: "0",
      topP: "",
      seed: "",
    })

    expect(command).toBe("opencode run --model 'openai/test' 'Respond with OK only. Do not create or edit files.'")
    expect(command).not.toContain("--file")
    expect(command).not.toContain("--prompt-file")
    expect(command).not.toContain("--temperature")
    expect(command).not.toContain("--top-p")
    expect(command).not.toContain("--seed")
  })

  it("keeps capture paths unique for bounded concurrent repetitions", () => {
    const options = parseArgs(["--runs", "2", "--fixture", "backend-api-no-stack", "--condition", "all", "--concurrency", "2", "--model", "test-model"])
    const plan = buildPlan(options)

    const capturePathKeys = plan.runs.map((runPlan) => `${runPlan.fixtureId}/${runPlan.conditionId}/r${runPlan.repetition}`)
    const uniqueCapturePathKeys = new Set(capturePathKeys)

    expect(options.concurrency).toBe(2)
    expect(uniqueCapturePathKeys.size).toBe(capturePathKeys.length)
  })

  it("records token and time proxy telemetry without changing outcome metrics", async () => {
    const outputRoot = tempDir("persona-eval-telemetry-")
    const options = parseArgs([
      "--runs",
      "1",
      "--fixture",
      "backend-api-no-stack",
      "--condition",
      "plain",
      "--model",
      "test-model",
      "--opencode-command",
      `${process.execPath} -e "require('node:fs').writeFileSync('generated.txt', 'ok')"`,
      "--output-root",
      outputRoot,
    ])

    const result = await runEval(options)

    expect(result.ok).toBe(true)
    const runResult = result.results?.runs[0]
    expect(runResult?.metadata.telemetry.input).toEqual(
      expect.objectContaining({
        fixtureBytes: expect.any(Number),
        promptBytes: expect.any(Number),
        baselineFileBytes: 0,
      }),
    )
    expect(runResult?.metadata.telemetry.input.promptBytes).toBeGreaterThan(
      runResult?.metadata.telemetry.input.fixtureBytes ?? Number.POSITIVE_INFINITY,
    )
    expect(runResult?.metadata.telemetry.commands.opencode).toEqual(
      expect.objectContaining({
        status: 0,
        timedOut: false,
        elapsedMs: expect.any(Number),
        stdoutBytes: expect.any(Number),
        stderrBytes: expect.any(Number),
      }),
    )
    expect(runResult?.metrics.externalFailureModeLabels).toEqual(expect.any(Array))
  }, 10000)

  it("detects ambient Persona Harness files above repo-local output roots during preflight", () => {
    const projectDir = tempDir("persona-eval-ambient-")
    writeFileSync(join(projectDir, "AGENTS.md"), "# Ambient root rule\n")
    mkdirSync(join(projectDir, ".persona"), { recursive: true })
    const options = parseArgs([
      "--project-dir",
      projectDir,
      "--output-root",
      "experiments/eval-runs",
      "--fixture",
      "backend-api-no-stack",
      "--condition",
      "plain",
      "--model",
      "test-model",
      "--opencode-command",
      "definitely-missing-opencode-binary",
    ])

    const ambientPaths = findAmbientInfluencePaths(projectDir, String(options.outputRoot))
    const result = preflight(options, {
      fixtureIds: [],
      conditionIds: ["plain"],
      fixtureMetadata: {},
      runs: [],
    })

    expect(ambientPaths).toEqual(expect.arrayContaining([join(projectDir, "AGENTS.md"), join(projectDir, ".persona")]))
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("output root is not isolated from ambient eval files")]),
    )
  })

  it("guards baseline workspace purity while allowing intended agents baseline and PH ON artifacts", () => {
    const plainWorkspace = tempDir("persona-eval-plain-contaminated-")
    writeFileSync(join(plainWorkspace, "AGENTS.md"), "# Should not be inherited by plain\n")
    mkdirSync(join(plainWorkspace, ".persona"), { recursive: true })

    const agentsWorkspace = tempDir("persona-eval-agents-clean-")
    writeFileSync(join(agentsWorkspace, "AGENTS.md"), "# Static agents baseline\n")

    const phWorkspace = tempDir("persona-eval-ph-artifacts-")
    mkdirSync(join(phWorkspace, ".persona"), { recursive: true })
    mkdirSync(join(phWorkspace, ".opencode"), { recursive: true })

    expect(scanWorkspacePurity(plainWorkspace, "plain")).toEqual({
      status: "FAIL",
      violations: expect.arrayContaining([join(plainWorkspace, "AGENTS.md"), join(plainWorkspace, ".persona")]),
    })
    expect(scanWorkspacePurity(agentsWorkspace, "agents")).toEqual({ status: "PASS", violations: [] })
    expect(scanWorkspacePurity(phWorkspace, "ph-on")).toEqual({ status: "NOT_APPLICABLE", violations: [] })
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

    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
    mkdirSync(join(projectDir, "build", "classes", "java", "main", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "build", "classes", "java", "main", "com", "example", "App.class"), "bytecode")

    expect(measureCompileResult(projectDir, { status: 0, timedOut: false })).toEqual(
      expect.objectContaining({ outcome: "PASS", artifacts: ["build/classes/java/main/com/example/App.class"] }),
    )
    expect(measureCompileResult(projectDir, { status: 1, timedOut: false })).toEqual({ outcome: "FAIL", artifacts: [] })
  })

  it("scores Maven Spring projects with Maven commands and surefire XML", () => {
    const projectDir = tempDir("persona-eval-maven-")
    writeFileSync(join(projectDir, "pom.xml"), "<project></project>\n")
    mkdirSync(join(projectDir, "target", "surefire-reports"), { recursive: true })
    mkdirSync(join(projectDir, "target", "classes", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "target", "surefire-reports", "TEST-sample.xml"), '<testsuite tests="1" failures="0" errors="0" skipped="0"></testsuite>\n')
    writeFileSync(join(projectDir, "target", "classes", "com", "example", "App.class"), "bytecode")

    const toolchain = detectGeneratedToolchain(projectDir)

    expect(toolchain).toEqual(
      expect.objectContaining({ detectedStack: "java", buildTool: "maven", testTool: "maven" }),
    )
    expect(testCommandForToolchain(projectDir, toolchain)).toEqual(expect.objectContaining({ tool: "maven" }))
    expect(testCommandForToolchain(projectDir, toolchain).command).toContain("mvn")
    expect(testCommandForToolchain(projectDir, toolchain).command).not.toContain("gradle")
    expect(measureToolchainTestResult(projectDir, { status: 0, timedOut: false }, toolchain)).toEqual(
      expect.objectContaining({ outcome: "PASS", tests: 1, files: ["target/surefire-reports/TEST-sample.xml"] }),
    )
    expect(measureCompileResult(projectDir, { status: 0, timedOut: false }, toolchain)).toEqual(
      expect.objectContaining({ outcome: "PASS", artifacts: ["target/classes/com/example/App.class"] }),
    )
  })

  it("records Gradle-pinned fixture toolchain mismatch separately from Maven external pass", () => {
    const projectDir = tempDir("persona-eval-maven-pinned-")
    writeFileSync(join(projectDir, "pom.xml"), "<project></project>\n")
    mkdirSync(join(projectDir, "target", "surefire-reports"), { recursive: true })
    mkdirSync(join(projectDir, "target", "classes", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "target", "surefire-reports", "TEST-sample.xml"), '<testsuite tests="1" failures="0" errors="0" skipped="0"></testsuite>\n')
    writeFileSync(join(projectDir, "target", "classes", "com", "example", "App.class"), "bytecode")

    const toolchain = detectGeneratedToolchain(projectDir)
    const externalTest = measureToolchainTestResult(projectDir, { status: 0, timedOut: false }, toolchain)
    const externalBuild = measureCompileResult(projectDir, { status: 0, timedOut: false }, toolchain)
    const match = scoreFixtureStackToolchain(FIXTURE_METADATA["multi-step-backend-small"], toolchain)

    expect(externalTest).toEqual(expect.objectContaining({ outcome: "PASS" }))
    expect(externalBuild).toEqual(expect.objectContaining({ outcome: "PASS" }))
    expect(match).toEqual(
      expect.objectContaining({
        matches: false,
        reason: "expected Gradle build tool but generated maven",
      }),
    )
    expect(match.expected).toEqual(
      expect.objectContaining({
        expectation: "java-spring-gradle-pinned",
        expectedStack: "java",
        expectedBuildTool: "gradle",
      }),
    )
    expect(match.detected).toEqual(expect.objectContaining({ detectedStack: "java", buildTool: "maven", testTool: "maven" }))
  })

  it("does not mark free-stack fixtures mismatched for Maven or Python toolchain choice", () => {
    const freeStack = FIXTURE_METADATA["backend-api-no-stack"]

    expect(
      scoreFixtureStackToolchain(freeStack, {
        detectedStack: "java",
        buildTool: "maven",
        testTool: "maven",
        evidence: ["pom.xml"],
      }),
    ).toEqual(expect.objectContaining({ matches: true, reason: "fixture accepts any generated stack/toolchain" }))
    expect(
      scoreFixtureStackToolchain(freeStack, {
        detectedStack: "python",
        buildTool: "python-compileall",
        testTool: "pytest",
        evidence: ["pyproject.toml"],
      }),
    ).toEqual(expect.objectContaining({ matches: true, reason: "fixture accepts any generated stack/toolchain" }))
  })

  it("summarizes external outcome and stack toolchain match separately", () => {
    const aggregate = aggregateRuns([
      {
        fixtureId: "multi-step-backend-small",
        fixtureMetadata: FIXTURE_METADATA["multi-step-backend-small"],
        conditionId: "plain",
        metrics: {
          compileBuildPass: true,
          gradleTestPass: true,
          runtimeSmokePass: true,
          stackToolchainMatches: false,
          stackAlignmentRate: 1,
          externalFailureModeCount: 0,
          workflowFinishOutcome: "NOT APPLICABLE",
          backendShapeWarnCount: 0,
        },
      },
    ])

    expect(aggregate.byCondition).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fixtureId: "multi-step-backend-small",
          compileBuildRate: 1,
          gradleTestRate: 1,
          fixtureStackToolchainExpectation: expect.objectContaining({
            expectation: "java-spring-gradle-pinned",
            expectedBuildTool: "gradle",
          }),
          stackToolchainMatchRate: 0,
        }),
      ]),
    )
  })

  it("keeps Gradle projects on the Gradle command and JUnit path", () => {
    const projectDir = tempDir("persona-eval-gradle-")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
    mkdirSync(join(projectDir, "build", "test-results", "test"), { recursive: true })
    writeFileSync(join(projectDir, "build", "test-results", "test", "TEST-sample.xml"), '<testsuite tests="1" failures="0" errors="0" skipped="0"></testsuite>\n')

    const toolchain = detectGeneratedToolchain(projectDir)

    expect(toolchain).toEqual(
      expect.objectContaining({ detectedStack: "java", buildTool: "gradle", testTool: "gradle" }),
    )
    expect(testCommandForToolchain(projectDir, toolchain)).toEqual(expect.objectContaining({ tool: "gradle" }))
    expect(measureToolchainTestResult(projectDir, { status: 0, timedOut: false }, toolchain)).toEqual(
      expect.objectContaining({ outcome: "PASS", tests: 1, files: ["build/test-results/test/TEST-sample.xml"] }),
    )
  })

  it("scores Python projects with pytest path or UNKNOWN when the test command is skipped", () => {
    const projectDir = tempDir("persona-eval-python-")
    writeFileSync(join(projectDir, "pyproject.toml"), "[project]\nname = 'sample'\n")
    mkdirSync(join(projectDir, "tests"), { recursive: true })
    mkdirSync(join(projectDir, ".persona-eval"), { recursive: true })
    writeFileSync(join(projectDir, "tests", "test_sample.py"), "def test_sample():\n    assert True\n")
    writeFileSync(join(projectDir, ".persona-eval", "pytest-junit.xml"), '<testsuite tests="1" failures="0" errors="0" skipped="0"></testsuite>\n')

    const toolchain = detectGeneratedToolchain(projectDir)

    expect(toolchain).toEqual(
      expect.objectContaining({ detectedStack: "python", buildTool: "python-compileall", testTool: "pytest" }),
    )
    expect(testCommandForToolchain(projectDir, toolchain)).toEqual(expect.objectContaining({ tool: "pytest" }))
    expect(measureToolchainTestResult(projectDir, { status: 0, timedOut: false }, toolchain)).toEqual(
      expect.objectContaining({ outcome: "PASS", tests: 1, files: [".persona-eval/pytest-junit.xml"] }),
    )
    expect(measureToolchainTestResult(projectDir, { status: null, skipped: true, error: "pytest unavailable" }, toolchain)).toEqual(
      expect.objectContaining({ outcome: "UNKNOWN", reason: "pytest unavailable" }),
    )
  })

  it("keeps unknown projects UNKNOWN instead of forcing Gradle scoring", () => {
    const projectDir = tempDir("persona-eval-unknown-")
    const toolchain = detectGeneratedToolchain(projectDir)

    expect(toolchain).toEqual(expect.objectContaining({ detectedStack: "unknown", buildTool: "unknown", testTool: "unknown" }))
    expect(buildCommandForToolchain(projectDir, toolchain)).toEqual(
      expect.objectContaining({ command: null, skippedReason: "no supported build tool detected" }),
    )
    expect(testCommandForToolchain(projectDir, toolchain)).toEqual(
      expect.objectContaining({ command: null, skippedReason: "no supported test tool detected" }),
    )
    expect(measureCompileResult(projectDir, { status: null, skipped: true, error: "no supported build tool detected" }, toolchain)).toEqual(
      expect.objectContaining({ outcome: "UNKNOWN", artifacts: [], reason: "no supported build tool detected" }),
    )
  })

  it("keeps runtime command outcome exit-code based only", () => {
    expect(parseCommandOutcome({ status: 0, stdout: "", stderr: "", timedOut: false })).toBe("PASS")
    expect(parseCommandOutcome({ status: 1, stdout: "PASS", stderr: "", timedOut: false })).toBe("FAIL")
    expect(parseCommandOutcome({ status: null, stdout: "", stderr: "", timedOut: true })).toBe("FAIL")
  })

  it("cleans up runtime-smoke process groups without killing unrelated processes", async () => {
    const projectDir = tempDir("persona-eval-runtime-cleanup-")
    const execution = await runShellAsync(
      `${process.execPath} -e "const { spawn } = require('node:child_process'); const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }); child.unref(); console.log(child.pid);"`,
      projectDir,
      5000,
      { cleanupProcessGroup: true },
    )
    const childPid = Number.parseInt(execution.stdout.trim().split("\n")[0] ?? "", 10)

    try {
      expect(execution.status).toBe(0)
      expect(Number.isInteger(childPid)).toBe(true)
      await new Promise<void>((resolvePromise) => {
        setTimeout(resolvePromise, 100)
      })
      expect(isProcessAlive(childPid)).toBe(false)
    } finally {
      if (Number.isInteger(childPid) && isProcessAlive(childPid)) {
        process.kill(childPid, "SIGKILL")
      }
    }
  })

  it("cleans up timed-out opencode process groups before grading", () => {
    const outputRoot = tempDir("persona-eval-opencode-cleanup-")
    const pidFile = join(outputRoot, "provider-child.pid")
    const opencodeCommand = [
      process.execPath,
      "-e",
      JSON.stringify(
        [
          "const { spawn } = require('node:child_process')",
          "const { writeFileSync } = require('node:fs')",
          "const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })",
          "child.unref()",
          `writeFileSync(${JSON.stringify(pidFile)}, String(child.pid))`,
          "setInterval(() => {}, 1000)",
        ].join("; "),
      ),
    ].join(" ")

    const result = spawnSync(
      process.execPath,
      [
        resolve("scripts/eval/run-onoff-eval.mjs"),
        "--fixture",
        "backend-api-no-stack",
        "--condition",
        "plain",
        "--runs",
        "1",
        "--capture",
        "--output-root",
        outputRoot,
        "--model",
        "test-model",
        "--timeout-ms",
        "1000",
        "--opencode-command",
        opencodeCommand,
      ],
      { cwd: resolve("."), encoding: "utf8" },
    )
    const childPid = Number.parseInt(readFileSync(pidFile, "utf8"), 10)

    try {
      expect(result.status).toBe(0)
      const resultsPath = result.stdout.match(/results: (.+results\.json)/)?.[1]
      if (!resultsPath) {
        throw new Error(`missing results path in output: ${result.stdout}`)
      }
      const results = parseReplayResultsText(readFileSync(resultsPath, "utf8"))
      expect(results.decisionPolicy).toBe(DECISION_POLICIES.externalPrimary)
      expect(results.toolchainScoringVersion).toBe(TOOLCHAIN_SCORING_VERSION)
      expect(results.completionSemanticsVersion).toBe(COMPLETION_SEMANTICS_VERSION)
      expect(Number.isInteger(childPid)).toBe(true)
      expect(isProcessAlive(childPid)).toBe(false)
    } finally {
      if (Number.isInteger(childPid) && isProcessAlive(childPid)) {
        process.kill(childPid, "SIGKILL")
      }
    }
  }, 10000)

  it("marks stack alignment fallback criteria as low-confidence instead of precise observer evidence", () => {
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
    expect(score).toEqual(
      expect.objectContaining({
        stackAlignmentPrecise: false,
        criterionDetails: {
          controllerServiceDependency: expect.objectContaining({ passed: true, source: "fallback", confidence: "LOW" }),
          dtoBoundary: expect.objectContaining({ passed: true, source: "fallback", confidence: "LOW" }),
          noControllerRepositoryDependency: expect.objectContaining({ passed: true, source: "observer", confidence: "HIGH" }),
          noServiceStorageOwnership: expect.objectContaining({ passed: true, source: "observer", confidence: "HIGH" }),
        },
      }),
    )
  })

  it("scores stack alignment as precise when all criteria are observer-backed", () => {
    const score = scoreStackAlignmentFromObserveReport({
      findings: [
        { ruleId: "controller.service-dependency", result: "PASS" },
        { ruleId: "controller.repository-dependency", result: "PASS" },
        { ruleId: "service.storage-ownership", result: "PASS" },
        { ruleId: "dto.boundary", result: "PASS", evidence: { role: "request" } },
        { ruleId: "dto.boundary", result: "PASS", evidence: { role: "response" } },
      ],
    })

    expect(score).toEqual(
      expect.objectContaining({
        rate: 1,
        score: 2,
        stackAlignmentPrecise: true,
        criteria: {
          controllerServiceDependency: true,
          noControllerRepositoryDependency: true,
          noServiceStorageOwnership: true,
          dtoBoundary: true,
        },
        criterionDetails: expect.objectContaining({
          controllerServiceDependency: expect.objectContaining({ passed: true, source: "observer", confidence: "HIGH" }),
          dtoBoundary: expect.objectContaining({ passed: true, source: "observer", confidence: "HIGH" }),
        }),
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

  it("marks stress-continuation fixtures outside single-turn aggregate summaries", () => {
    const runs = [
      run("multi-step-backend", "ph-on", true, true, true, 0.75, 4),
      run("multi-step-backend-small", "ph-on", true, true, true, 1, 0),
      run("backend-api-no-stack", "ph-on", true, true, true, 1, 0),
    ]

    const aggregate = aggregateRuns(runs)

    expect(aggregate.byCondition).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fixtureId: "multi-step-backend",
          scopeClass: "stress-continuation",
          singleTurnEligible: false,
        }),
        expect.objectContaining({
          fixtureId: "multi-step-backend-small",
          scopeClass: "reduced-single-turn",
          singleTurnEligible: true,
        }),
      ]),
    )
    expect(aggregate.singleTurnEligibleByCondition).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fixtureId: "multi-step-backend-small" }),
        expect.objectContaining({ fixtureId: "backend-api-no-stack" }),
      ]),
    )
    expect(aggregate.singleTurnEligibleByCondition).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ fixtureId: "multi-step-backend" })]),
    )
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
      external: {
        count: 3,
        labels: ["compile failure", "test failure", "runtime smoke failure"],
      },
      operational: {
        count: 2,
        labels: ["provider-timeout", "workflow-finalization-incomplete-after-provider-timeout"],
      },
    })
  })

  it("classifies provider timeout separately from generated app failures", () => {
    const completion = classifyProviderToolCompletion({
      status: null,
      signal: "SIGTERM",
      timedOut: true,
      stdout: "",
      stderr: "",
      error: "timed out after 900000ms",
    })
    const failures = countFailureModes({
      compileBuildOutcome: "UNKNOWN",
      gradleTestOutcome: "UNKNOWN",
      runtimeSmokeOutcome: "NOT RUN",
      stackAlignmentRate: 1,
      workflowFinishOutcome: "FAIL",
      providerToolCompletion: completion,
    })

    expect(completion).toEqual(
      expect.objectContaining({
        completionOutcome: "TIMED_OUT",
        completionFailureReason: "provider-timeout",
      }),
    )
    expect(failures.external.labels).toEqual([])
    expect(failures.operational.labels).toEqual(["provider-timeout", "workflow-finalization-incomplete-after-provider-timeout"])
  })

  it("keeps completed generation runtime crashes as generated app failures", () => {
    const completion = classifyProviderToolCompletion({
      status: 0,
      signal: null,
      timedOut: false,
      stdout: "",
      stderr: "",
      error: "",
    })
    const failures = countFailureModes({
      compileBuildOutcome: "PASS",
      gradleTestOutcome: "PASS",
      runtimeSmokeOutcome: "FAIL",
      stackAlignmentRate: 1,
      workflowFinishOutcome: "PASS",
      providerToolCompletion: completion,
    })

    expect(completion.completionOutcome).toBe("COMPLETED")
    expect(failures.external.labels).toEqual(["runtime smoke failure"])
    expect(failures.operational.labels).toEqual([])
  })

  it("returns INCONCLUSIVE instead of a verdict when baseline workspace purity fails", () => {
    const result = decideResults(
      {
        decisionPolicy: DECISION_POLICIES.externalPrimary,
        runs: [
          {
            fixtureId: "backend-api-no-stack",
            conditionId: "plain",
            repetition: 1,
            workspacePurity: { status: "FAIL", violations: ["/tmp/contaminated/AGENTS.md"] },
            metrics: decisionTestMetrics(),
          },
          {
            fixtureId: "backend-api-no-stack",
            conditionId: "ph-on",
            repetition: 1,
            workspacePurity: { status: "NOT_APPLICABLE", violations: [] },
            metrics: decisionTestMetrics(),
          },
        ],
      },
      { policy: DECISION_POLICIES.externalPrimary },
    )

    expect(result).toEqual({
      policy: DECISION_POLICIES.externalPrimary,
      scorer: TOOLCHAIN_SCORING_VERSION,
      verdict: "INCONCLUSIVE",
      reasons: [expect.stringContaining("baseline workspace contamination detected")],
    })
  })

  it("does not apply provider completion semantics to unstamped old results", () => {
    const result = decideResults(
      {
        decisionPolicy: DECISION_POLICIES.externalPrimary,
        toolchainScoringVersion: TOOLCHAIN_SCORING_VERSION,
        runs: [
          { fixtureId: "backend-api-no-stack", conditionId: "plain", metrics: decisionTestMetrics() },
          { fixtureId: "backend-api-no-stack", conditionId: "ph-on", metrics: decisionTestMetrics() },
        ],
      },
      { policy: DECISION_POLICIES.externalPrimary },
    )

    expect(result).toEqual({
      policy: DECISION_POLICIES.externalPrimary,
      scorer: TOOLCHAIN_SCORING_VERSION,
      verdict: "INCONCLUSIVE",
      reasons: [expect.stringContaining(COMPLETION_SEMANTICS_VERSION)],
    })
  })

  it("reports provider completion failures separately from app external failures in decide output", () => {
    const result = decideResults(
      {
        decisionPolicy: DECISION_POLICIES.externalPrimary,
        toolchainScoringVersion: TOOLCHAIN_SCORING_VERSION,
        completionSemanticsVersion: COMPLETION_SEMANTICS_VERSION,
        runs: [
          {
            fixtureId: "backend-api-no-stack",
            conditionId: "plain",
            metrics: decisionTestMetrics(),
          },
          {
            fixtureId: "backend-api-no-stack",
            conditionId: "ph-on",
            metrics: {
              ...decisionTestMetrics(),
              compileBuildPass: null,
              gradleTestPass: null,
              runtimeSmokePass: null,
              providerToolCompletionOutcome: "TIMED_OUT",
              providerToolCompletionFailureReason: "provider-timeout",
              completionWithinBudgetPass: false,
              finishWithinBudgetPass: false,
              externalFailureModeCount: 0,
              externalFailureModeLabels: [],
              operationalFailureModeCount: 2,
              operationalFailureModeLabels: ["provider-timeout", "workflow-finalization-incomplete-after-provider-timeout"],
              workflowFinishOutcome: "INCOMPLETE",
            },
          },
        ],
      },
      { policy: DECISION_POLICIES.externalPrimary },
    )

    expect(result.verdict).toBe("FAIL")
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("operational feasibility failure"),
        expect.stringContaining("operational workflow finalization incomplete"),
      ]),
    )
    expect(result.reasons).not.toEqual(expect.arrayContaining([expect.stringContaining("failure-mode count increased")]))
    expect(result.reasons).not.toEqual(expect.arrayContaining([expect.stringContaining("runtimeSmokeRate below")]))
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

  it("replays captured runtime-smoke log status without fabricating missing smoke results", () => {
    const outputRoot = tempDir("persona-eval-replay-runtime-")
    const captureDir = join(outputRoot, "capture")
    writeCapturedRun(captureDir, { conditionId: "plain", runtimeStatus: "status: 0" })
    writeCapturedRun(captureDir, { conditionId: "claude", runtimeStatus: "status: 1" })
    writeCapturedRun(captureDir, { conditionId: "agents", runtimeStatus: null })

    const result = spawnSync(
      process.execPath,
      [resolve("scripts/eval/run-onoff-eval.mjs"), "--replay", captureDir, "--output-root", outputRoot],
      { cwd: resolve("."), encoding: "utf8" },
    )

    expect(result.status).toBe(0)
    const resultsPath = result.stdout.match(/results: (.+results\.json)/)?.[1]
    if (!resultsPath) {
      throw new Error(`missing replay results path in output: ${result.stdout}`)
    }
    const results = parseReplayResultsText(readFileSync(resultsPath, "utf8"))

    expect(runtimeOutcomeFor(results, "plain")).toEqual({ outcome: "PASS", pass: true })
    expect(runtimeOutcomeFor(results, "claude")).toEqual({ outcome: "FAIL", pass: false })
    expect(runtimeOutcomeFor(results, "agents")).toEqual({ outcome: "NOT RUN", pass: null })
  }, 10000)

  it("replays captured provider and workflow logs without fabricating missing workflow results", () => {
    const outputRoot = tempDir("persona-eval-replay-workflow-")
    const captureDir = join(outputRoot, "capture")
    writeCapturedRun(captureDir, {
      conditionId: "ph-on",
      runtimeStatus: "status: 0",
      opencodeStatus: "status: null\nsignal: SIGTERM\nerror: spawnSync /bin/sh ETIMEDOUT",
      workflowStatus: "status: 0",
    })
    writeCapturedRun(captureDir, {
      conditionId: "plain",
      runtimeStatus: "status: 0",
      opencodeStatus: "status: 0",
      workflowStatus: null,
    })

    const result = spawnSync(
      process.execPath,
      [resolve("scripts/eval/run-onoff-eval.mjs"), "--replay", captureDir, "--output-root", outputRoot],
      { cwd: resolve("."), encoding: "utf8" },
    )

    expect(result.status).toBe(0)
    const results = readReplayResults(result.stdout)

    expect(workflowOutcomeFor(results, "ph-on")).toEqual({ outcome: "PASS", metric: "PASS" })
    expect(operationalLabelsFor(results, "ph-on")).toContain("provider-timeout")
    expect(workflowOutcomeFor(results, "plain")).toEqual({ outcome: "NOT APPLICABLE", metric: "NOT APPLICABLE" })
    expect(failureLabelsFor(results, "plain")).not.toContain("workflow lifecycle failure")
    expect(operationalLabelsFor(results, "plain")).toEqual([])
  }, 10000)

  it("replays completed provider logs with elapsed metadata without marking them interrupted", () => {
    const outputRoot = tempDir("persona-eval-replay-provider-elapsed-")
    const captureDir = join(outputRoot, "capture")
    writeCapturedRun(captureDir, {
      conditionId: "plain",
      runtimeStatus: "status: 0",
      opencodeStatus: "status: 0\nsignal: \nelapsedMs: 208441",
      workflowStatus: null,
    })

    const result = spawnSync(
      process.execPath,
      [resolve("scripts/eval/run-onoff-eval.mjs"), "--replay", captureDir, "--output-root", outputRoot],
      { cwd: resolve("."), encoding: "utf8" },
    )

    expect(result.status).toBe(0)
    const resultsPath = result.stdout.match(/results: (.+results\.json)/)?.[1]
    if (!resultsPath) {
      throw new Error(`missing replay results path in output: ${result.stdout}`)
    }
    const parsed: unknown = JSON.parse(readFileSync(resultsPath, "utf8"))
    if (!isRecord(parsed) || !Array.isArray(parsed.runs)) {
      throw new Error("invalid replay results shape")
    }
    const run = parsed.runs.find((candidate) => isRecord(candidate) && candidate.conditionId === "plain")
    if (!isRecord(run)) {
      throw new Error("missing replay run")
    }
    expect(run?.providerToolCompletion).toMatchObject({
      signal: null,
      elapsedMs: 208441,
      completionOutcome: "COMPLETED",
      completionFailureReason: null,
    })
    const results = parseReplayResultsText(readFileSync(resultsPath, "utf8"))
    expect(operationalLabelsFor(results, "plain")).toEqual([])
  }, 10000)

  it("records fixture scope metadata in replay results without changing verdict semantics", () => {
    const outputRoot = tempDir("persona-eval-replay-scope-")
    const captureDir = join(outputRoot, "capture")
    writeCapturedRun(captureDir, {
      fixtureId: "multi-step-backend",
      conditionId: "ph-on",
      runtimeStatus: "status: 0",
      workflowStatus: "status: 0",
    })
    writeCapturedRun(captureDir, {
      fixtureId: "multi-step-backend-small",
      conditionId: "plain",
      runtimeStatus: "status: 0",
      workflowStatus: null,
    })

    const result = spawnSync(
      process.execPath,
      [resolve("scripts/eval/run-onoff-eval.mjs"), "--replay", captureDir, "--output-root", outputRoot],
      { cwd: resolve("."), encoding: "utf8" },
    )

    expect(result.status).toBe(0)
    const results = readReplayResults(result.stdout)

    expect(results.fixtureMetadata["multi-step-backend"]).toEqual({
      scopeClass: "stress-continuation",
      singleTurnEligible: false,
      stackToolchain: {
        expectation: "java-spring-gradle-pinned",
        expectedStack: "java",
        expectedFramework: "spring",
        expectedBuildTool: "gradle",
      },
    })
    expect(replayRunFor(results, "ph-on").fixtureMetadata).toEqual({
      scopeClass: "stress-continuation",
      singleTurnEligible: false,
      stackToolchain: {
        expectation: "java-spring-gradle-pinned",
        expectedStack: "java",
        expectedFramework: "spring",
        expectedBuildTool: "gradle",
      },
    })
    expect(replayRunFor(results, "ph-on").fixtureStackToolchain).toEqual(
      expect.objectContaining({
        matches: true,
        reason: "generated stack/toolchain matches fixture expectation",
        expected: expect.objectContaining({ expectation: "java-spring-gradle-pinned", expectedBuildTool: "gradle" }),
        detected: expect.objectContaining({ detectedStack: "java", buildTool: "gradle", testTool: "gradle" }),
      }),
    )
    expect(replayRunFor(results, "ph-on").metrics.stackToolchainMatches).toBe(true)
    expect(results.fixtureMetadata["multi-step-backend-small"]).toEqual({
      scopeClass: "reduced-single-turn",
      singleTurnEligible: true,
      pairedWith: "multi-step-backend",
      stackToolchain: {
        expectation: "java-spring-gradle-pinned",
        expectedStack: "java",
        expectedFramework: "spring",
        expectedBuildTool: "gradle",
      },
    })
    expect(results.aggregate["singleTurnEligibleByCondition"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fixtureId: "multi-step-backend-small",
          fixtureStackToolchainExpectation: expect.objectContaining({ expectedBuildTool: "gradle" }),
          stackToolchainMatchRate: 1,
        }),
      ]),
    )
    expect(results.aggregate["singleTurnEligibleByCondition"]).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ fixtureId: "multi-step-backend" })]),
    )
  }, 10000)

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

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") {
      return false
    }
    throw error
  }
}

type CapturedRunOptions = {
  readonly fixtureId?: string
  readonly conditionId: string
  readonly runtimeStatus: string | null
  readonly opencodeStatus?: string | null
  readonly workflowStatus?: string | null
}

function writeCapturedRun(captureDir: string, options: CapturedRunOptions): void {
  const { fixtureId = "backend-api-no-stack", conditionId, runtimeStatus, opencodeStatus = null, workflowStatus = null } = options
  const replayRunDir = join(captureDir, "raw", fixtureId, conditionId, "r1")
  const workspaceDir = join(replayRunDir, "workspace")
  const logsDir = join(replayRunDir, "raw")
  mkdirSync(join(workspaceDir, "build", "test-results", "test"), { recursive: true })
  mkdirSync(join(workspaceDir, "build", "classes", "java", "main", "com", "example"), { recursive: true })
  mkdirSync(join(workspaceDir, "src", "main", "java", "com", "example"), { recursive: true })
  mkdirSync(logsDir, { recursive: true })
  writeFileSync(join(workspaceDir, "README.md"), "# Captured fixture\n")
  writeFileSync(join(workspaceDir, "build", "test-results", "test", "TEST-sample.xml"), '<testsuite tests="1" failures="0" errors="0" skipped="0"></testsuite>\n')
  writeFileSync(join(workspaceDir, "build", "classes", "java", "main", "com", "example", "App.class"), "bytecode")
  writeFileSync(join(workspaceDir, "src", "main", "java", "com", "example", "OrderController.java"), "class OrderController { OrderService service; }\n")
  writeFileSync(join(workspaceDir, "src", "main", "java", "com", "example", "OrderResponse.java"), "class OrderResponse {}\n")
  writeFileSync(
    join(workspaceDir, "gradlew"),
    [
      "#!/usr/bin/env sh",
      "set -eu",
      "mkdir -p build/test-results/test build/classes/java/main/com/example",
      "printf '<testsuite tests=\"1\" failures=\"0\" errors=\"0\" skipped=\"0\"></testsuite>\\n' > build/test-results/test/TEST-sample.xml",
      "printf bytecode > build/classes/java/main/com/example/App.class",
      "exit 0",
      "",
    ].join("\n"),
    { mode: 0o755 },
  )
  if (runtimeStatus !== null) {
    writeFileSync(
      join(logsDir, "runtime-smoke.log"),
      [`$ /tmp/runtime-smoke`, `cwd: ${workspaceDir}`, runtimeStatus, "signal: ", "", "## stdout", "", "## stderr", ""].join("\n"),
    )
  }
  if (opencodeStatus !== null) {
    writeFileSync(
      join(logsDir, "opencode.log"),
      [`$ opencode run`, `cwd: ${workspaceDir}`, opencodeStatus, "", "## stdout", "", "## stderr", ""].join("\n"),
    )
  }
  if (workflowStatus !== null) {
    writeFileSync(
      join(logsDir, "workflow-finish.log"),
      [`$ npx ph workflow finish implement`, `cwd: ${workspaceDir}`, workflowStatus, "signal: ", "", "## stdout", "Finish status: PASS", "", "## stderr", ""].join("\n"),
    )
  }
}

function readReplayResults(stdout: string): ReplayResults {
  const resultsPath = stdout.match(/results: (.+results\.json)/)?.[1]
  if (!resultsPath) {
    throw new Error(`missing replay results path in output: ${stdout}`)
  }
  return parseReplayResultsText(readFileSync(resultsPath, "utf8"))
}

function parseReplayResultsText(text: string): ReplayResults {
  const parsed: unknown = JSON.parse(text)
  if (!isRecord(parsed) || !Array.isArray(parsed.runs)) {
    throw new Error("invalid replay results shape")
  }
  return {
    decisionPolicy: typeof parsed.decisionPolicy === "string" ? parsed.decisionPolicy : undefined,
    toolchainScoringVersion: typeof parsed.toolchainScoringVersion === "string" ? parsed.toolchainScoringVersion : undefined,
    completionSemanticsVersion: typeof parsed.completionSemanticsVersion === "string" ? parsed.completionSemanticsVersion : undefined,
    fixtureMetadata: isRecord(parsed.fixtureMetadata) ? parsed.fixtureMetadata : {},
    aggregate: isRecord(parsed.aggregate) ? parsed.aggregate : {},
    runs: parsed.runs.map(parseReplayRuntimeRun),
  }
}

function parseReplayRuntimeRun(value: unknown): ReplayRuntimeRun {
  if (
    !isRecord(value) ||
    typeof value.fixtureId !== "string" ||
    !isRecord(value.fixtureMetadata) ||
    typeof value.conditionId !== "string" ||
    !isRecord(value.fixtureStackToolchain) ||
    !isRecord(value.outcomes) ||
    !isRecord(value.metrics)
  ) {
    throw new Error("invalid replay run shape")
  }
  const { outcomes, metrics } = value
  if (typeof outcomes.runtimeSmokeOutcome !== "string" || typeof outcomes.workflowFinishOutcome !== "string") {
    throw new Error("invalid replay outcome shape")
  }
  if (
    !isRuntimePass(metrics.runtimeSmokePass) ||
    !isRuntimePass(metrics.stackToolchainMatches) ||
    typeof metrics.stackToolchainMatchReason !== "string" ||
    !Array.isArray(metrics.externalFailureModeLabels) ||
    !metrics.externalFailureModeLabels.every((label) => typeof label === "string") ||
    !Array.isArray(metrics.operationalFailureModeLabels) ||
    !metrics.operationalFailureModeLabels.every((label) => typeof label === "string") ||
    typeof metrics.workflowFinishOutcome !== "string"
  ) {
    throw new Error("invalid replay metrics shape")
  }
  return {
    fixtureId: value.fixtureId,
    fixtureMetadata: value.fixtureMetadata,
    conditionId: value.conditionId,
    fixtureStackToolchain: value.fixtureStackToolchain,
    outcomes: {
      runtimeSmokeOutcome: outcomes.runtimeSmokeOutcome,
      workflowFinishOutcome: outcomes.workflowFinishOutcome,
    },
    metrics: {
      runtimeSmokePass: metrics.runtimeSmokePass,
      stackToolchainMatches: metrics.stackToolchainMatches,
      stackToolchainMatchReason: metrics.stackToolchainMatchReason,
      externalFailureModeLabels: metrics.externalFailureModeLabels,
      operationalFailureModeLabels: metrics.operationalFailureModeLabels,
      workflowFinishOutcome: metrics.workflowFinishOutcome,
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isRuntimePass(value: unknown): value is boolean | null {
  return typeof value === "boolean" || value === null
}

function replayRunFor(results: ReplayResults, conditionId: string): ReplayRuntimeRun {
  const runResult = results.runs.find((item) => item.conditionId === conditionId)
  if (!runResult) {
    throw new Error(`missing run for condition: ${conditionId}`)
  }
  return runResult
}

function runtimeOutcomeFor(results: ReplayResults, conditionId: string): { outcome: string; pass: boolean | null } {
  const runResult = replayRunFor(results, conditionId)
  return {
    outcome: runResult.outcomes.runtimeSmokeOutcome,
    pass: runResult.metrics.runtimeSmokePass,
  }
}

function workflowOutcomeFor(results: ReplayResults, conditionId: string): { outcome: string; metric: string } {
  const runResult = replayRunFor(results, conditionId)
  return {
    outcome: runResult.outcomes.workflowFinishOutcome,
    metric: runResult.metrics.workflowFinishOutcome,
  }
}

function failureLabelsFor(results: ReplayResults, conditionId: string): readonly string[] {
  return replayRunFor(results, conditionId).metrics.externalFailureModeLabels
}

function operationalLabelsFor(results: ReplayResults, conditionId: string): readonly string[] {
  return replayRunFor(results, conditionId).metrics.operationalFailureModeLabels
}

function decisionTestMetrics() {
  return {
    compileBuildPass: true,
    gradleTestPass: true,
    runtimeSmokePass: true,
    stackToolchainMatches: true,
    stackToolchainMatchReason: "fixture accepts any generated stack/toolchain",
    stackAlignmentRate: 1,
    providerToolCompletionOutcome: "COMPLETED",
    providerToolCompletionFailureReason: null,
    completionWithinBudgetPass: true,
    finishWithinBudgetPass: true,
    externalFailureModeCount: 0,
    externalFailureModeLabels: [],
    operationalFailureModeCount: 0,
    operationalFailureModeLabels: [],
    workflowFinishOutcome: "PASS",
    backendShapeWarnCount: 0,
  }
}
