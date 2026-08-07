import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import { readBackendProjectProfileState } from "../config/project-profile.js"
import {
  reserveProjectReadBoundary,
  type ProjectReadBoundary,
} from "../io/bootstrap-write-boundary.js"
import {
  captureProjectReadSnapshot,
  type ProjectReadSnapshot,
} from "../io/project-read-snapshot.js"
import { nativeProjectReadPlatformSupported } from "../io/native-project-read.js"
import { runFreshFixedVerification } from "./fresh-verification-runner.js"
import { runResumeCommand } from "./plan-next.js"
import { workflowClosureFinishReasons } from "./workflow-closure-finish.js"
import { readWorkflowClosurePayload, runWorkflowClosureCommand } from "./workflow-closure.js"
import { runWorkflowFinishResult } from "./workflow-finish-runner.js"
import { isStructuredWorkflowRequiredFix, type WorkflowRequiredFix } from "./workflow-required-fix.js"
import {
  failedGuardOutput,
  failedRunnerOutput,
  passedFinishOutput,
  passedGuardOutput,
  passedImplementOutput,
  passedStartOutput,
  type WorkflowGuardKind,
  type WorkflowRunnerKind,
  uninitializedHarnessOutput,
  uninitializedWorkflowFinishOutput,
} from "./workflow-output.js"
import { parseWorkflowArgs, workflowUsage } from "./workflow-args.js"
import { runWorkflowRelayCommand } from "./workflow-relay.js"
import { runWorkflowLoopCommand } from "./workflow-loop.js"
import { runWorkflowRalphLoopCommand } from "./workflow-ralph-loop.js"
import { runWorkflowRoleBoundaryCommand } from "./workflow-role-boundary.js"
import { runWorkflowRolesCommand } from "./workflow-roles.js"
import { cachedWorkflowRailOutput } from "./workflow-rail-cache.js"
import { formatWorkflowStatus, readWorkflowStatus } from "./workflow-status.js"
import { stdinEncodingError } from "./stdin-text.js"
import { runWorkflowTddStatus } from "./workflow-tdd-status.js"
import { recordTddGreenForCurrentTicket, runWorkflowTddTest } from "./workflow-tdd.js"
import { safeProjectArtifactReference, safeWorkflowCode } from "./workflow-safe-rendering.js"
import type { WorkflowStateWriteOptions } from "./workflow-state-conflict.js"
import type { FinishAssuranceRequirement } from "./workflow-verification-decision.js"
import {
  runWorkflowArchive,
  runWorkflowApproveRequirements,
  runWorkflowCapture,
  runWorkflowDraft,
  runWorkflowNext,
  runWorkflowSplit,
} from "./workflow-tickets.js"

type WorkflowOptions = WorkflowStateWriteOptions & {
  readonly full?: boolean
  readonly projectDir?: string
  readonly stdin?: string
}

type WorkflowStatus = ReturnType<typeof readWorkflowStatus>

function implementationGuardReasons(summary: WorkflowStatus): readonly string[] {
  const reasons: string[] = []
  const profileState = readBackendProjectProfileState(summary.projectDir)
  if (profileState.status !== "ready") {
    reasons.push(
      [
        "Harness initialized but project profile is not ready.",
        ".persona exists but the backend project profile is not ready.",
        ".persona/project-profile.jsonc is required before implementation.",
        "Do not enter implementation rail until profile/bootstrap is ready.",
        profileState.message,
        "Interactive intake: run `npx ph intake --interactive`.",
        "AI/non-TTY fast path: run `npx ph bootstrap backend`.",
      ].join(" "),
    )
  }
  if (summary.plan === "missing") {
    reasons.push(".persona/workflow/plan.md is missing. Run npx ph bootstrap backend or npx ph plan --auto-accept.")
  } else if (summary.plan !== "accepted") {
    reasons.push(".persona/workflow/plan.md must be accepted")
  }
  if (summary.implementation === "missing") {
    reasons.push(".persona/workflow/implementation-report.md must exist")
  }
  if (summary.review === "missing") {
    reasons.push(".persona/workflow/review-report.md must exist")
  }
  return reasons
}

function finalGuardReasons(projectDir: string): readonly WorkflowRequiredFix[] {
  return workflowClosureFinishReasons(readWorkflowClosurePayload("next", projectDir, { recordTddGreenEvidence: true }), projectDir)
}

function requiredFixDetails(fixes: readonly WorkflowRequiredFix[]): readonly string[] {
  return fixes.map((fix) => isStructuredWorkflowRequiredFix(fix) ? fix.detail : fix)
}

function hasPersonaHarness(summary: WorkflowStatus, snapshot?: ProjectReadSnapshot): boolean {
  return hasPersonaHarnessAt(summary.projectDir, snapshot)
}

/**
 * The same check without a status summary, for callers that would otherwise
 * verify the whole finish authority just to learn a resolved path.
 */
function hasPersonaHarnessAt(projectDir: string, snapshot?: ProjectReadSnapshot): boolean {
  return snapshot?.hasDirectory(".persona") ?? existsSync(join(projectDir, ".persona"))
}

function stdinEncodingFailure(options: WorkflowOptions): CliRunResult | undefined {
  const stdin = options.stdin
  if (stdin === undefined) {
    return undefined
  }
  const message = stdinEncodingError(stdin)
  return message === undefined ? undefined : { status: 1, stdout: "", stderr: `${message}\n` }
}

function runWorkflowGuard(guardKind: WorkflowGuardKind, options: WorkflowOptions): CliRunResult {
  const summary = readWorkflowStatus(options.projectDir)
  if (!hasPersonaHarness(summary)) {
    return uninitializedHarnessOutput()
  }
  const reasons = guardKind === "implement" ? implementationGuardReasons(summary) : requiredFixDetails(finalGuardReasons(summary.projectDir))
  if (reasons.length > 0) {
    return failedGuardOutput(guardKind, reasons)
  }
  return passedGuardOutput(guardKind)
}

function runWorkflowStart(runnerKind: WorkflowRunnerKind, options: WorkflowOptions): CliRunResult {
  const summary = readWorkflowStatus(options.projectDir)
  if (!hasPersonaHarness(summary)) {
    return uninitializedHarnessOutput()
  }
  const reasons = implementationGuardReasons(summary)
  if (reasons.length > 0) {
    return failedRunnerOutput("start", runnerKind, reasons)
  }
  return passedStartOutput(runnerKind, summary.projectDir)
}

function runWorkflowImplement(options: WorkflowOptions): CliRunResult {
  const summary = readWorkflowStatus(options.projectDir)
  if (!hasPersonaHarness(summary)) {
    return uninitializedHarnessOutput()
  }
  const reasons = implementationGuardReasons(summary)
  if (reasons.length > 0) {
    return failedRunnerOutput("implement", "implement", reasons)
  }
  return passedImplementOutput(summary.projectDir, { full: options.full })
}

function runWorkflowFinish(
  runnerKind: WorkflowRunnerKind,
  reverify: boolean,
  ci: boolean,
  assurance: FinishAssuranceRequirement,
  options: WorkflowOptions,
): CliRunResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  if (projectDir !== resolve(process.cwd())) {
    return runWorkflowFinishAtProject(runnerKind, reverify, ci, assurance, projectDir)
  }
  // The source-read snapshot needs a native artifact, and the release ships one
  // only for darwin and linux. On any other platform there is nothing to load,
  // so demanding it made `workflow finish` fail before evaluating a single
  // blocker — Windows users had a working gate in 0.7.0, which had no snapshot
  // at all, and lost it entirely in 0.8.x.
  //
  // Run the same unsnapshotted path this function already uses for a project
  // outside the working directory, and say plainly what was not verified. A
  // platform that *is* built keeps failing closed: this is a build-matrix fact,
  // not a load failure, and the two are distinguished at the source.
  if (!nativeProjectReadPlatformSupported()) {
    return withUnsnapshottedFinishNotice(
      runWorkflowFinishAtProject(runnerKind, reverify, ci, assurance, projectDir),
    )
  }
  let boundary: ProjectReadBoundary | undefined
  try {
    boundary = reserveProjectReadBoundary(projectDir)
    const snapshot = captureProjectReadSnapshot(projectDir, boundary)
    return runWorkflowFinishAtProject(
      runnerKind,
      reverify,
      ci,
      assurance,
      projectDir,
      { boundary, snapshot },
    )
  } catch {
    return failedRunnerOutput("finish", runnerKind, ["Cooperative verification blocked: source-read-runtime-unavailable."])
  } finally {
    boundary?.close()
  }
}

/**
 * States what the finish did not do, on every finish that ran without the
 * source-read snapshot. Degrading quietly would let a weaker verification pass
 * for the stronger one, which is the failure this whole gate exists to prevent.
 */
function withUnsnapshottedFinishNotice(result: CliRunResult): CliRunResult {
  const notice = `Source-read snapshot unavailable on ${process.platform}/${process.arch}: `
    + "no native project-read artifact is built for this platform. Cooperative "
    + "verification ran without the snapshot boundary, so this finish does not "
    + "attest that project sources were read under it.\n"
  return { ...result, stderr: `${result.stderr}${notice}` }
}

function runWorkflowFinishAtProject(
  runnerKind: WorkflowRunnerKind,
  reverify: boolean,
  ci: boolean,
  assurance: FinishAssuranceRequirement,
  projectDir: string,
  projectRead?: {
    readonly boundary: ProjectReadBoundary
    readonly snapshot: ProjectReadSnapshot
  },
): CliRunResult {
  // Only the resolved project directory and whether `.persona` exists are used
  // from here on, and `readWorkflowStatus` verifies the full finish authority to
  // produce them — a Sigstore worker spawn plus a source-identity scan whose
  // result is then discarded. `runWorkflowFinishResult` below performs that
  // verification itself, and it is that one which gates the finish.
  const resolvedProjectDir = resolve(projectDir)
  if (!hasPersonaHarnessAt(resolvedProjectDir, projectRead?.snapshot)) {
    return uninitializedWorkflowFinishOutput(runnerKind)
  }
  if (reverify) {
    const result = runFreshFixedVerification(resolvedProjectDir, ci ? "ci" : "local", {
      projectReadBoundary: projectRead?.boundary,
    })
    if (result.finalStatus !== "passed") {
      const artifactReference = safeProjectArtifactReference(resolvedProjectDir, result.artifactPath)
      const diagnostics = result.diagnosticCodes
        .slice(0, 8)
        .map((code) => safeWorkflowCode(code, "invalid-diagnostic-code"))
      return failedRunnerOutput("finish", runnerKind, [
        `Evidence reverification ${result.finalStatus}; ${artifactReference === undefined ? "artifact-unavailable" : `artifact: ${artifactReference}`}; diagnostics: ${diagnostics.join(", ") || "none"}.`,
      ])
    }
  }
  return runWorkflowFinishResult(
    runnerKind,
    resolvedProjectDir,
    assurance,
    projectRead,
  )
}

function runWorkflowCheck(options: WorkflowOptions): CliRunResult {
  const summary = readWorkflowStatus(options.projectDir)
  if (hasPersonaHarness(summary)) {
    recordTddGreenForCurrentTicket(summary.projectDir)
  }
  const nextSummary = readWorkflowStatus(options.projectDir)
  const fullText = `${formatWorkflowStatus(nextSummary)}\n`
  if (!hasPersonaHarness(nextSummary)) {
    return { status: 0, stdout: fullText, stderr: "" }
  }
  return { status: 0, stdout: cachedWorkflowCheckOutput(nextSummary, options.full ?? false), stderr: "" }
}

function cachedWorkflowCheckOutput(summary: WorkflowStatus, full: boolean): string {
  const fullLines = formatWorkflowStatus(summary).split("\n")
  const artifactsIndex = fullLines.findIndex((line) => line === "Artifacts:")
  if (artifactsIndex === -1) {
    return `${fullLines.join("\n")}\n`
  }
  const nextIndex = fullLines.findIndex((line) => line.startsWith("Next: "))
  const scopeIndex = fullLines.findIndex((line) => line === "Scope:")
  const detailEnd = nextIndex !== -1 ? Math.max(artifactsIndex, nextIndex - 1) : scopeIndex !== -1 ? Math.max(artifactsIndex, scopeIndex - 1) : fullLines.length
  const uniqueLines = [
    ...fullLines.slice(0, artifactsIndex),
    ...(nextIndex === -1 ? [] : ["", fullLines[nextIndex] ?? ""]),
    ...(scopeIndex === -1 ? [] : ["", ...fullLines.slice(scopeIndex)]),
  ]
  return cachedWorkflowRailOutput({
    full,
    fullLines,
    projectDir: summary.projectDir,
    railBodyLines: fullLines.slice(artifactsIndex, detailEnd),
    surface: "workflow-check",
    uniqueLines,
  })
}

export function runWorkflowCommand(args: readonly string[], options: WorkflowOptions = {}, invocationName = "ph"): CliRunResult {
  const parsed = parseWorkflowArgs(args)
  if (parsed.kind === "help") {
    return { status: 0, stdout: `${workflowUsage(invocationName)}\n`, stderr: "" }
  }
  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${workflowUsage(invocationName)}\n` }
  }
  if (parsed.kind === "guard") {
    return runWorkflowGuard(parsed.guardKind, options)
  }
  if (parsed.kind === "implement") {
    return runWorkflowImplement({ ...options, full: parsed.full })
  }
  if (parsed.kind === "test") {
    return runWorkflowTddTest(options)
  }
  if (parsed.kind === "tdd") {
    return runWorkflowTddStatus(options)
  }
  if (parsed.kind === "continue") {
    return runResumeCommand({ ...options, full: parsed.full })
  }
  if (parsed.kind === "loop") {
    return runWorkflowLoopCommand({
      dryRun: parsed.dryRun,
      graceMs: parsed.graceMs,
      json: parsed.json,
      maxIterations: parsed.maxIterations,
      opencodeCommand: parsed.opencodeCommand,
      projectDir: options.projectDir,
      timeoutMs: parsed.timeoutMs,
    })
  }
  if (parsed.kind === "ralph-loop") {
    return runWorkflowRalphLoopCommand({ json: parsed.json, projectDir: options.projectDir })
  }
  if (parsed.kind === "role-boundary") {
    return runWorkflowRoleBoundaryCommand({ json: parsed.json, projectDir: options.projectDir })
  }
  if (parsed.kind === "closure") {
    return runWorkflowClosureCommand(parsed.closureAction, options)
  }
  if (parsed.kind === "relay") {
    return runWorkflowRelayCommand(parsed.relayArgs, { projectDir: options.projectDir }, invocationName)
  }
  if (parsed.kind === "roles") {
    return runWorkflowRolesCommand(options)
  }
  if (parsed.kind === "draft") {
    const encodingFailure = stdinEncodingFailure(options)
    if (encodingFailure !== undefined) {
      return encodingFailure
    }
    return runWorkflowDraft(options)
  }
  if (parsed.kind === "approve-requirements") {
    return runWorkflowApproveRequirements(options)
  }
  if (parsed.kind === "capture") {
    const encodingFailure = stdinEncodingFailure(options)
    if (encodingFailure !== undefined) {
      return encodingFailure
    }
    return runWorkflowCapture(options)
  }
  if (parsed.kind === "split") {
    return runWorkflowSplit(parsed.sourceFile, options)
  }
  if (parsed.kind === "next") {
    return runWorkflowNext(options)
  }
  if (parsed.kind === "archive") {
    return runWorkflowArchive(parsed.ticketId, options)
  }
  if (parsed.kind === "start") {
    return runWorkflowStart(parsed.runnerKind, options)
  }
  if (parsed.kind === "finish") {
    return runWorkflowFinish(parsed.runnerKind, parsed.reverify, parsed.ci, parsed.assurance, options)
  }
  return runWorkflowCheck({ ...options, full: parsed.full })
}
