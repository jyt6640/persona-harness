import { createHash } from "node:crypto"
import {
  ProjectReadBoundaryError,
  reserveProjectReadBoundary,
  type ProjectReadBoundary,
} from "../io/bootstrap-write-boundary.js"
import { runBoundedProcess, type BoundedProcessOptions, type BoundedProcessResult } from "./bounded-process.js"
import { preflightDiagnostic, safeGradleWrapper } from "./ci-reverification-catalog.js"
import {
  captureGitIdentity,
  captureGitIdentityFromCapturedProject,
  samePathIdentity,
} from "./ci-reverification-identity.js"
import { type CooperativeFinishContext } from "./cooperative-finish-context.js"
import { assessCooperativeJUnit } from "./cooperative-junit.js"
import { snapshotJUnitResults } from "./junit-result-discovery.js"
import {
  bindProjectFinishAttestationInputSnapshot,
  captureProjectFinishAttestationInputSnapshot,
  sameProjectFinishAttestationInputSnapshot,
  type ProjectFinishAttestationInputSnapshot,
} from "./project-finish-attestation-inputs.js"
import {
  captureSourceIdentity,
  sameSourceIdentity,
  type SourceIdentity,
} from "./source-identity.js"
import { captureProjectFinishAttestationSourceIdentity } from "./project-finish-attestation-source.js"

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
  let boundary: ProjectReadBoundary | undefined
  try {
    boundary = reserveProjectReadBoundary(projectDir)
    const projectRoot = canonicalProjectRoot(projectDir, context, boundary)
    if (projectRoot.kind === "blocked") return blocked(projectRoot.code)
    const preflight = preflightDiagnostic(projectRoot.value, "local", process.platform, boundary)
    return runGradleVerification(projectRoot.value, context, preflight, options, undefined, boundary)
  } catch {
    return blocked("source-read-runtime-unavailable")
  } finally {
    boundary?.close()
  }
}

export function runCooperativeGradleVerificationWithinBoundary(
  projectDir: string,
  context: CooperativeFinishContext,
  boundary: ProjectReadBoundary,
  options: CooperativeGradleVerificationOptions = {},
): CooperativeGradleVerification {
  try {
    const projectRoot = canonicalProjectRoot(projectDir, context, boundary)
    if (projectRoot.kind === "blocked") return blocked(projectRoot.code)
    const preflight = preflightDiagnostic(projectRoot.value, "local", process.platform, boundary)
    return runGradleVerification(projectRoot.value, context, preflight, options, undefined, boundary)
  } catch {
    return blocked("source-read-runtime-unavailable")
  }
}

export function runProjectFinishAttestationGradleVerification(
  projectDir: string,
  context: CooperativeFinishContext,
  options: CooperativeGradleVerificationOptions = {},
): CooperativeGradleVerification {
  try {
    const boundary = reserveProjectReadBoundary(projectDir)
    try {
      return runProjectFinishAttestationGradleVerificationWithinBoundary(projectDir, context, boundary, options)
    } finally {
      boundary.close()
    }
  } catch (error) {
    if (error instanceof ProjectReadBoundaryError) return blocked("workspace-root-unavailable")
    return blocked("project-finish-producer-profile")
  }
}

export function runProjectFinishAttestationGradleVerificationWithinBoundary(
  projectDir: string,
  context: CooperativeFinishContext,
  projectReadBoundary: ProjectReadBoundary,
  options: CooperativeGradleVerificationOptions = {},
): CooperativeGradleVerification {
  const projectRoot = canonicalProjectRoot(projectDir, context, projectReadBoundary)
  if (projectRoot.kind === "blocked") return blocked(projectRoot.code)
  try {
    projectReadBoundary.assert()
    const inputSnapshot = captureProjectFinishAttestationInputSnapshot(projectRoot.value, projectReadBoundary)
    if (inputSnapshot.kind === "blocked") return blocked(inputSnapshot.code)
    return runGradleVerification(
      projectRoot.value,
      context,
      process.platform === "win32" ? "platform-windows-unavailable" : undefined,
      options,
      inputSnapshot.value,
      projectReadBoundary,
    )
  } catch {
    return blocked("project-finish-producer-profile")
  }
}

function canonicalProjectRoot(
  projectDir: string,
  context: CooperativeFinishContext,
  projectReadBoundary?: ProjectReadBoundary,
): { readonly code: string; readonly kind: "blocked" } | { readonly kind: "ready"; readonly value: string } {
  try {
    if (projectReadBoundary === undefined) return { code: "source-read-runtime-unavailable", kind: "blocked" }
    projectReadBoundary.assert()
    const workspace = projectReadBoundary.workspaceIdentity()
    if (!samePathIdentity(context.workspace, workspace)) {
      return { code: "workspace-identity-drift", kind: "blocked" }
    }
    return { kind: "ready", value: projectDir }
  } catch {
    return { code: "workspace-root-unavailable", kind: "blocked" }
  }
}

function runGradleVerification(
  projectDir: string,
  context: CooperativeFinishContext,
  preflight: string | undefined,
  options: CooperativeGradleVerificationOptions,
  inputSnapshot?: ProjectFinishAttestationInputSnapshot,
  projectReadBoundary?: ProjectReadBoundary,
): CooperativeGradleVerification {
  const gradleWrapper = projectReadBoundary === undefined
    ? undefined
    : safeGradleWrapper(projectDir, projectReadBoundary)
  if (preflight !== undefined || gradleWrapper === undefined) {
    return blocked(preflight ?? "gradle-wrapper-unavailable")
  }
  const preGit = captureVerificationGitIdentity(projectDir, context.workspace, projectReadBoundary)
  if (!preGit.available) return blocked(preGit.diagnosticCode)
  const preSource = inputSnapshot === undefined
    ? captureSourceIdentity(projectDir, preGit, context.evidenceRootRelativePath, { projectReadBoundary })
    : captureProjectFinishAttestationSourceIdentity(projectDir, preGit, projectReadBoundary)
  if (preSource.status === "unavailable") return blocked(preSource.diagnosticCode)
  const boundPreSource = inputSnapshot === undefined
    ? preSource.value
    : bindProjectFinishAttestationInputSnapshot(preSource.value, inputSnapshot)
  const baseline = snapshotJUnitResults(projectDir, projectReadBoundary)
  if (!baseline.safe) return blocked("junit-unsafe-report")

  const now = options.now ?? Date.now
  const runProcess = options.runProcess ?? runBoundedProcess
  const useNativeProjectCommand = options.runProcess === undefined
  const attemptStartedAt = now()
  const test = runFixedCommandWithinBoundary(
    projectDir,
    COOPERATIVE_GRADLE_COMMAND_CATALOG[0],
    attemptStartedAt,
    now,
    runProcess,
    projectReadBoundary,
    useNativeProjectCommand,
  )
  const testCode = testDiagnostic(test)
  if (testCode !== undefined) return blocked(testCode)
  const testOutputCode = testExecutionDiagnostic(test.result, ["cleanTest", "test"])
  if (testOutputCode !== undefined) return blocked(testOutputCode)
  const junit = assessCooperativeJUnit(projectDir, baseline, projectReadBoundary)
  if (junit.kind === "blocked") return junit

  const build = runFixedCommandWithinBoundary(
    projectDir,
    COOPERATIVE_GRADLE_COMMAND_CATALOG[1],
    attemptStartedAt,
    now,
    runProcess,
    projectReadBoundary,
    useNativeProjectCommand,
  )
  const buildCode = testDiagnostic(build)
  if (buildCode !== undefined) return blocked(buildCode.replace(/^test-/u, "build-"))
  const buildOutputCode = buildExecutionDiagnostic(build.result)
  if (buildOutputCode !== undefined) return blocked(buildOutputCode)

  projectReadBoundary?.assert()
  const postWorkspace = projectReadBoundary === undefined
    ? undefined
    : projectReadBoundary.workspaceIdentity()
  if (postWorkspace === undefined || !samePathIdentity(context.workspace, postWorkspace)) {
    return blocked("workspace-identity-drift")
  }
  const postGit = captureVerificationGitIdentity(projectDir, postWorkspace, projectReadBoundary)
  if (!postGit.available) return blocked(postGit.diagnosticCode)
  let postInputSnapshot: ProjectFinishAttestationInputSnapshot | undefined
  if (inputSnapshot !== undefined) {
    const postInputs = captureProjectFinishAttestationInputSnapshot(projectDir, projectReadBoundary)
    if (postInputs.kind === "blocked") return blocked("source-identity-drift")
    if (!sameProjectFinishAttestationInputSnapshot(inputSnapshot, postInputs.value)) {
      return blocked("source-identity-drift")
    }
    postInputSnapshot = postInputs.value
  }
  const postSource = inputSnapshot === undefined
    ? captureSourceIdentity(projectDir, postGit, context.evidenceRootRelativePath, { projectReadBoundary })
    : captureProjectFinishAttestationSourceIdentity(projectDir, postGit, projectReadBoundary)
  if (postSource.status === "unavailable") {
    return blocked(postSource.diagnosticCode === "source-identity-symlink"
      ? "source-identity-drift"
      : postSource.diagnosticCode)
  }
  const boundPostSource = postInputSnapshot === undefined
    ? postSource.value
    : bindProjectFinishAttestationInputSnapshot(postSource.value, postInputSnapshot)
  if (!sameSourceIdentity(boundPreSource, boundPostSource)) return blocked("source-identity-drift")

  return {
    kind: "passed",
    value: {
      buildOutputDigest: processOutputDigest(build.result),
      commandPlanDigest: commandPlanDigest(),
      junitDigest: junit.digest,
      passedTestCount: junit.passed,
      skippedTestCount: junit.skipped,
      sourceIdentity: boundPreSource,
      sourceSnapshotDigest: boundPreSource.contentDigest,
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

function runFixedCommandWithinBoundary(
  projectDir: string,
  command: (typeof COOPERATIVE_GRADLE_COMMAND_CATALOG)[number],
  attemptStartedAt: number,
  now: () => number,
  runProcess: (options: BoundedProcessOptions) => BoundedProcessResult,
  projectReadBoundary?: ProjectReadBoundary,
  useNativeProjectCommand = false,
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
  if (projectReadBoundary !== undefined && useNativeProjectCommand) {
    const native = projectReadBoundary.runFixedGradle(
      command.id,
      Math.min(COOPERATIVE_COMMAND_TIMEOUT_MS, remaining),
    )
    return {
      result: {
        killed: native.killed,
        outcome: native.outcome,
        outputLimited: native.outcome === "output-limit",
        signal: nativeSignal(native.signal),
        status: native.status,
        stderr: native.stderr.toString("utf8"),
        stdout: native.stdout.toString("utf8"),
        timedOut: native.timedOut,
      },
      timedOutBeforeStart: false,
    }
  }
  return runFixedCommand(projectDir, command, attemptStartedAt, now, runProcess)
}

function nativeSignal(value: number): NodeJS.Signals | null {
  switch (value) {
    case 0:
      return null
    case 9:
      return "SIGKILL"
    case 15:
      return "SIGTERM"
    default:
      return "SIGTERM"
  }
}

function captureVerificationGitIdentity(
  projectDir: string,
  workspace: Parameters<typeof captureGitIdentity>[1],
  projectReadBoundary?: ProjectReadBoundary,
) {
  return projectReadBoundary === undefined
    ? captureGitIdentity(projectDir, workspace)
    : captureGitIdentityFromCapturedProject((args) => projectReadBoundary.runFixedGit(args))
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
