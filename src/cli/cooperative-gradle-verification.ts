import { createHash } from "node:crypto"

import { runBoundedProcess, type BoundedProcessOptions, type BoundedProcessResult } from "./bounded-process.js"
import { preflightDiagnostic, safeGradleWrapper } from "./ci-reverification-catalog.js"
import {
  captureGitIdentity,
  captureWorkspaceIdentity,
  samePathIdentity,
} from "./ci-reverification-identity.js"
import { type CooperativeFinishContext } from "./cooperative-finish-context.js"
import { assessCooperativeJUnit } from "./cooperative-junit.js"
import { snapshotJUnitResults } from "./junit-result-discovery.js"
import {
  captureSourceIdentity,
  sameSourceIdentity,
  type SourceIdentity,
} from "./source-identity.js"

export const COOPERATIVE_GRADLE_COMMAND_CATALOG = [
  {
    args: ["--no-daemon", "--no-build-cache", "cleanTest", "test", "--console=plain"],
    id: "test",
  },
  {
    args: ["--no-daemon", "--no-build-cache", "build", "--console=plain"],
    id: "build",
  },
] as const

export const COOPERATIVE_GRADLE_COMMAND_CATALOG_ID = "java-spring-gradle-cooperative.1" as const
export const COOPERATIVE_COMMAND_TIMEOUT_MS = 120_000
export const COOPERATIVE_ATTEMPT_TIMEOUT_MS = 300_000

export type CooperativeGradleVerification =
  | { readonly code: string; readonly kind: "blocked" }
  | {
      readonly kind: "passed"
      readonly value: {
      readonly commandPlanDigest: string
      readonly buildOutputDigest: string
      readonly junitDigest: string
      readonly passedTestCount: number
      readonly skippedTestCount: number
      readonly sourceIdentity: SourceIdentity
      readonly sourceSnapshotDigest: string
      readonly testCount: number
      }
    }

export type CooperativeGradleVerificationOptions = {
  readonly now?: () => number
  readonly runProcess?: (options: BoundedProcessOptions) => BoundedProcessResult
}

export function runCooperativeGradleVerification(
  projectDir: string,
  context: CooperativeFinishContext,
  options: CooperativeGradleVerificationOptions = {},
): CooperativeGradleVerification {
  const preflight = preflightDiagnostic(projectDir, "local", process.platform)
  if (preflight !== undefined || safeGradleWrapper(projectDir) === undefined) {
    return blocked(preflight ?? "gradle-wrapper-unavailable")
  }
  const preGit = captureGitIdentity(projectDir, context.workspace)
  if (!preGit.available) return blocked(preGit.diagnosticCode)
  const preSource = captureSourceIdentity(projectDir, preGit, context.evidenceRootRelativePath)
  if (preSource.status === "unavailable") return blocked(preSource.diagnosticCode)
  const baseline = snapshotJUnitResults(projectDir)
  if (!baseline.safe) return blocked("junit-unsafe-report")

  const now = options.now ?? Date.now
  const runProcess = options.runProcess ?? runBoundedProcess
  const attemptStartedAt = now()
  const test = runFixedCommand(projectDir, COOPERATIVE_GRADLE_COMMAND_CATALOG[0], attemptStartedAt, now, runProcess)
  const testCode = testDiagnostic(test)
  if (testCode !== undefined) return blocked(testCode)
  const testOutputCode = testExecutionDiagnostic(test.result, ["cleanTest", "test"])
  if (testOutputCode !== undefined) return blocked(testOutputCode)
  const junit = assessCooperativeJUnit(projectDir, baseline)
  if (junit.kind === "blocked") return junit

  const build = runFixedCommand(projectDir, COOPERATIVE_GRADLE_COMMAND_CATALOG[1], attemptStartedAt, now, runProcess)
  const buildCode = testDiagnostic(build)
  if (buildCode !== undefined) return blocked(buildCode.replace(/^test-/u, "build-"))
  const buildOutputCode = buildExecutionDiagnostic(build.result)
  if (buildOutputCode !== undefined) return blocked(buildOutputCode)

  const postWorkspace = captureWorkspaceIdentity(projectDir)
  if (postWorkspace.status === "unavailable" || !samePathIdentity(context.workspace, postWorkspace.value)) {
    return blocked(postWorkspace.status === "unavailable" ? postWorkspace.diagnosticCode : "workspace-identity-drift")
  }
  const postGit = captureGitIdentity(projectDir, postWorkspace.value)
  if (!postGit.available) return blocked(postGit.diagnosticCode)
  const postSource = captureSourceIdentity(projectDir, postGit, context.evidenceRootRelativePath)
  if (postSource.status === "unavailable") return blocked(postSource.diagnosticCode)
  if (!sameSourceIdentity(preSource.value, postSource.value)) return blocked("source-identity-drift")

  return {
    kind: "passed",
    value: {
      buildOutputDigest: processOutputDigest(build.result),
      commandPlanDigest: commandPlanDigest(),
      junitDigest: junit.digest,
      passedTestCount: junit.passed,
      skippedTestCount: junit.skipped,
      sourceIdentity: preSource.value,
      sourceSnapshotDigest: preSource.value.contentDigest,
      testCount: junit.testCount,
    },
  }
}

function runFixedCommand(
  projectDir: string,
  command: (typeof COOPERATIVE_GRADLE_COMMAND_CATALOG)[number],
  attemptStartedAt: number,
  now: () => number,
  runProcess: (options: BoundedProcessOptions) => BoundedProcessResult,
): { readonly result: BoundedProcessResult; readonly timedOutBeforeStart: boolean } {
  const remaining = COOPERATIVE_ATTEMPT_TIMEOUT_MS - (now() - attemptStartedAt)
  if (remaining <= 0) {
    return {
      result: {
        killed: false,
        outcome: "timeout",
        outputLimited: false,
        signal: null,
        status: 1,
        stderr: "",
        stdout: "",
        timedOut: true,
      },
      timedOutBeforeStart: true,
    }
  }
  return {
    result: runProcess({
      args: command.args,
      command: "./gradlew",
      cwd: projectDir,
      graceMs: 5_000,
      maxStderrBytes: 1024 * 1024,
      maxStdoutBytes: 1024 * 1024,
      maxTotalBytes: 2 * 1024 * 1024,
      timeoutMs: Math.min(COOPERATIVE_COMMAND_TIMEOUT_MS, remaining),
    }),
    timedOutBeforeStart: false,
  }
}

function testDiagnostic(command: { readonly result: BoundedProcessResult; readonly timedOutBeforeStart: boolean }): string | undefined {
  if (command.timedOutBeforeStart || command.result.timedOut || command.result.outcome === "timeout") return "test-timeout"
  if (command.result.outcome === "output-limit") return "test-output-limit"
  if (command.result.outcome === "signal") return "test-signal"
  if (command.result.outcome === "spawn-failure") return "test-spawn-failure"
  return command.result.outcome === "passed" && command.result.status === 0 ? undefined : "test-command-failed"
}

function testExecutionDiagnostic(result: BoundedProcessResult, tasks: readonly string[]): string | undefined {
  if (!tasks.every((task) => taskLine(result, task))) return "test-task-not-executed"
  if (nonFreshTaskLine(result, "test")) return "test-task-nonfresh"
  return undefined
}

function buildExecutionDiagnostic(result: BoundedProcessResult): string | undefined {
  if (!taskLine(result, "build")) return "build-task-not-executed"
  return nonFreshTaskLine(result, "build") ? "build-task-nonfresh" : undefined
}

function taskLine(result: BoundedProcessResult, task: string): boolean {
  return new RegExp(`^> Task :${task}(?:\\s|$)`, "mu").test(`${result.stdout}\n${result.stderr}`)
}

function nonFreshTaskLine(result: BoundedProcessResult, task: string): boolean {
  return new RegExp(`^> Task :${task}\\s+(?:UP-TO-DATE|FROM-CACHE|NO-SOURCE)\\b`, "mu")
    .test(`${result.stdout}\n${result.stderr}`)
}

function commandPlanDigest(): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(COOPERATIVE_GRADLE_COMMAND_CATALOG)).digest("hex")}`
}

function processOutputDigest(result: BoundedProcessResult): string {
  return `sha256:${createHash("sha256")
    .update(result.stdout)
    .update("\u0000")
    .update(result.stderr)
    .digest("hex")}`
}

function blocked(code: string): CooperativeGradleVerification {
  return { code, kind: "blocked" }
}
