import { randomUUID } from "node:crypto"
import { loadHarnessConfigResult, resolveConfiguredPathResult } from "../config/harness-config.js"
import { runBoundedProcess, type BoundedProcessOptions, type BoundedProcessResult } from "./bounded-process.js"
import {
  serializeCiReverificationArtifact,
  writeAndRereadCiReverificationArtifact,
  type CiReverificationArtifact,
  type CiReverificationCommandRecord,
} from "./ci-reverification-artifact.js"
import {
  commandPlanSha256,
  createCommandRecord,
  mutationSnapshotData,
  overflowArtifact,
  preflightDiagnostic,
  profileSha256,
  REVERIFICATION_COMMAND_CATALOG_ID,
  REVERIFICATION_COMMANDS,
  safeGradleWrapper,
  sha256,
} from "./ci-reverification-catalog.js"
import {
  captureEvidenceParentIdentity,
  captureGitIdentity,
  captureWorkspaceIdentity,
  samePathIdentity,
} from "./ci-reverification-identity.js"
import { determineCiReverificationFinalStatus, type CiReverificationFinalStatus } from "./ci-reverification-model.js"
import { discoverJUnitResults } from "./junit-result-discovery.js"

export type CiReverificationMode = "ci" | "local"

export type CiReverificationResult = {
  readonly artifactPath?: string
  readonly diagnosticCodes: readonly string[]
  readonly finalStatus: CiReverificationFinalStatus
}

export type CiReverificationRunnerOptions = {
  readonly attemptBudgetMs?: number
  readonly beforeArtifactWrite?: () => void
  readonly beforePostCapture?: () => void
  readonly captureEvidenceParent?: typeof captureEvidenceParentIdentity
  readonly captureGit?: typeof captureGitIdentity
  readonly captureWorkspace?: typeof captureWorkspaceIdentity
  readonly commandTimeoutMs?: number
  readonly now?: () => number
  readonly platform?: NodeJS.Platform
  readonly runProcess?: (options: BoundedProcessOptions) => BoundedProcessResult
  readonly writeArtifact?: typeof writeAndRereadCiReverificationArtifact
}

export function runCiReverification(
  projectDir: string,
  mode: CiReverificationMode,
  options: CiReverificationRunnerOptions = {},
): CiReverificationResult {
  const now = options.now ?? Date.now
  const platform = options.platform ?? process.platform
  const runProcess = options.runProcess ?? runBoundedProcess
  const captureWorkspace = options.captureWorkspace ?? captureWorkspaceIdentity
  const configResult = loadHarnessConfigResult(projectDir)
  if (!configResult.safe) {
    return { diagnosticCodes: ["harness-config-invalid"], finalStatus: "unavailable" }
  }
  const evidencePath = resolveConfiguredPathResult(projectDir, configResult.config.evidenceDir)
  if (!evidencePath.ok) {
    return { diagnosticCodes: ["evidence-path-unsafe"], finalStatus: "unavailable" }
  }
  const captureEvidenceParent = options.captureEvidenceParent
    ?? ((workspaceRoot) => captureEvidenceParentIdentity(workspaceRoot, evidencePath.relativePath))
  const captureGit = options.captureGit ?? captureGitIdentity
  const writeArtifact = options.writeArtifact ?? writeAndRereadCiReverificationArtifact
  const commandTimeoutMs = options.commandTimeoutMs ?? 120_000
  const attemptBudgetMs = options.attemptBudgetMs ?? 300_000
  const diagnostics: string[] = []
  const attemptId = `${new Date(now()).toISOString().replace(/[:.]/gu, "-")}-${randomUUID()}`
  const profileDigest = profileSha256(projectDir)

  const preRootResult = captureWorkspace(projectDir)
  if (preRootResult.status === "unavailable") {
    return { diagnosticCodes: [preRootResult.diagnosticCode], finalStatus: "unavailable" }
  }
  const preParentResult = captureEvidenceParent(preRootResult.value)
  if (preParentResult.status === "unavailable") {
    return { diagnosticCodes: [preParentResult.diagnosticCode], finalStatus: "unavailable" }
  }
  const preGit = captureGit(projectDir, preRootResult.value)
  const preflight = preflightDiagnostic(projectDir, mode, platform)
    ?? (mode === "ci" && !preGit.available ? preGit.diagnosticCode : undefined)
  if (preflight !== undefined) diagnostics.push(preflight)

  const commandRecords: CiReverificationCommandRecord[] = []
  const attemptStartedAt = now()
  if (preflight === undefined) {
    const wrapper = safeGradleWrapper(projectDir)
    if (wrapper !== undefined) {
      for (const [index, command] of REVERIFICATION_COMMANDS.entries()) {
        const remaining = attemptBudgetMs - (now() - attemptStartedAt)
        if (remaining <= 0) {
          commandRecords.push({
            durationMs: 0,
            exitCode: 1,
            fixedArgvId: command.fixedArgvId,
            junitRefs: [],
            ordinal: index + 1,
            outcome: "unavailable",
            stderrBytes: 0,
            stderrSha256: sha256(""),
            stdoutBytes: 0,
            stdoutSha256: sha256(""),
          })
          diagnostics.push("attempt-budget-exhausted")
          break
        }
        const startedAt = now()
        const result = runProcess({
          args: [command.task],
          command: wrapper,
          cwd: projectDir,
          graceMs: 5_000,
          timeoutMs: Math.min(commandTimeoutMs, remaining),
        })
        if (result.outcome === "output-limit") diagnostics.push("verification-output-limit")
        if (result.outcome === "signal") diagnostics.push("verification-signal")
        if (result.outcome === "spawn-failure") diagnostics.push("verification-spawn-failure")
        if (result.outcome === "timeout") diagnostics.push("verification-timeout")
        const junitDiscovery = discoverJUnitResults(projectDir, {
          minimumMtimeMs: startedAt,
          minimumMtimeToleranceMs: 1_000,
        })
        diagnostics.push(...junitDiscovery.diagnostics)
        const record = createCommandRecord(
          projectDir,
          index + 1,
          command.fixedArgvId,
          startedAt,
          now(),
          result,
          junitDiscovery,
        )
        commandRecords.push(record)
        if (record.outcome !== "passed") break
      }
    }
  }

  options.beforePostCapture?.()
  const postRootResult = captureWorkspace(projectDir)
  const postRoot = postRootResult.status === "available" ? postRootResult.value : undefined
  const postGit = postRoot === undefined
    ? { available: false, diagnosticCode: "workspace-root-post-unavailable" }
    : captureGit(projectDir, postRoot)
  if (postRootResult.status === "unavailable") diagnostics.push(postRootResult.diagnosticCode)
  if (!postGit.available && preGit.available) diagnostics.push(postGit.diagnosticCode)
  const postParentResult = captureEvidenceParent(postRoot ?? preRootResult.value)
  const postParent = postParentResult.status === "available" ? postParentResult.value : undefined
  if (postParentResult.status === "unavailable") diagnostics.push(postParentResult.diagnosticCode)

  const mutationSnapshot = mutationSnapshotData(
    mode,
    preRootResult.value,
    postRoot,
    preParentResult.value,
    postParent,
    preGit,
    postGit,
  )
  const disallowed = Array.isArray(mutationSnapshot.disallowedTracked)
    ? mutationSnapshot.disallowedTracked.length > 0
    : false
  const identityPartial = commandRecords.length > 0 && (
    postRoot === undefined
    || !samePathIdentity(preRootResult.value, postRoot)
    || (preGit.available && (!postGit.available || preGit.head !== postGit.head))
  )
  const parentValid = postParent !== undefined && samePathIdentity(preParentResult.value, postParent)
  let finalStatus = determineCiReverificationFinalStatus({
    artifactValid: parentValid,
    ciDisallowedTrackedMutation: mode === "ci" && disallowed,
    commands: commandRecords.map((command) => ({ outcome: command.outcome, started: command.outcome !== "unavailable" })),
    identityPartial,
    preflightAvailable: preflight === undefined,
  })
  if (!parentValid) diagnostics.push("evidence-parent-post-mismatch")

  let artifact: CiReverificationArtifact = {
    attemptId,
    commandCatalogId: REVERIFICATION_COMMAND_CATALOG_ID,
    commandPlanSha256: commandPlanSha256(),
    commands: commandRecords,
    diagnosticCodes: [...new Set(diagnostics)].sort(),
    finalStatus,
    mode,
    mutationSnapshot,
    profileSha256: profileDigest,
    schemaVersion: "ph-ci-reverification.1",
  }
  let source = serializeCiReverificationArtifact(artifact)
  if (source === undefined) {
    artifact = overflowArtifact(artifact)
    source = serializeCiReverificationArtifact(artifact)
    finalStatus = "artifact-invalid"
  }
  options.beforeArtifactWrite?.()
  if (source === undefined || !parentValid) {
    return { diagnosticCodes: artifact.diagnosticCodes, finalStatus }
  }
  const currentParent = captureEvidenceParent(preRootResult.value)
  if (currentParent.status === "unavailable" || !samePathIdentity(preParentResult.value, currentParent.value)) {
    return {
      diagnosticCodes: [...artifact.diagnosticCodes, "evidence-parent-prewrite-mismatch"],
      finalStatus: finalStatus === "timeout" ? "timeout" : "artifact-invalid",
    }
  }
  const written = writeArtifact(currentParent.value.realpath, attemptId, source)
  if (!written.valid) {
    return {
      artifactPath: written.path,
      diagnosticCodes: [...artifact.diagnosticCodes, "artifact-write-reread-invalid"],
      finalStatus: finalStatus === "timeout" ? "timeout" : "artifact-invalid",
    }
  }
  return { artifactPath: written.path, diagnosticCodes: artifact.diagnosticCodes, finalStatus }
}
