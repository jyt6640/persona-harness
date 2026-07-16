import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { isAbsolute, join, relative } from "node:path"

import { readBoundedTextFile } from "../io/bounded-path-walker.js"
import { parseCiReverificationArtifact, type CiReverificationArtifact } from "./ci-reverification-artifact.js"
import {
  runCiReverification,
  type CiReverificationRunnerOptions,
} from "./ci-reverification-runner.js"
import type { CiReverificationFinalStatus } from "./ci-reverification-model.js"
import {
  buildFreshArtifactBinding,
  writeFreshLifecycleRecords,
} from "./fresh-verification-lifecycle.js"
import { sameSourceIdentity } from "./source-identity.js"
import {
  captureSemanticTddSourceSnapshot,
  persistSemanticTddSourceSnapshot,
} from "./workflow-semantic-tdd-source-snapshot.js"
import { diagnosticVerificationDecision, type VerificationDecision } from "./workflow-verification-decision.js"

export type FreshVerificationResult = {
  readonly artifactPath?: string
  readonly attemptPath?: string
  readonly decision: VerificationDecision
  readonly diagnosticCodes: readonly string[]
  readonly finalStatus: CiReverificationFinalStatus
  readonly receiptPath?: string
  readonly testCount: number
}

export type FreshVerificationRunnerOptions = {
  readonly finishId?: string
  readonly idFactory?: () => string
  readonly now?: () => number
  readonly reverificationOptions?: CiReverificationRunnerOptions
  readonly runReverification?: typeof runCiReverification
}

export function runFreshFixedVerification(
  projectDir: string,
  mode: "ci" | "local",
  options: FreshVerificationRunnerOptions = {},
): FreshVerificationResult {
  const now = options.now ?? Date.now
  const runReverification = options.runReverification ?? runCiReverification
  const sourceSnapshotCapturedAt = new Date(now()).toISOString()
  const sourceSnapshot = captureSemanticTddSourceSnapshot(projectDir, sourceSnapshotCapturedAt)
  const result = runReverification(projectDir, mode, {
    ...options.reverificationOptions,
    now,
  })
  if (result.artifactPath === undefined) {
    const diagnosticCodes = [...result.diagnosticCodes, "fresh-receipt-unavailable"]
    return {
      decision: freshDiagnosticDecision(result.finalStatus, diagnosticCodes),
      diagnosticCodes,
      finalStatus: result.finalStatus,
      testCount: 0,
    }
  }

  const source = readFileSync(result.artifactPath, "utf8")
  const artifact = parseCiReverificationArtifact(source)
  if (artifact === undefined) {
    const diagnosticCodes = [...result.diagnosticCodes, "fresh-artifact-invalid"]
    return {
      artifactPath: result.artifactPath,
      decision: freshDiagnosticDecision("artifact-invalid", diagnosticCodes),
      diagnosticCodes,
      finalStatus: "artifact-invalid",
      testCount: 0,
    }
  }
  const testCountResult = countFreshTests(projectDir, artifact)
  const diagnosticCodes = [...result.diagnosticCodes, ...testCountResult.diagnosticCodes]
  const finalStatus = result.finalStatus === "passed" && testCountResult.testCount === 0
    ? "failed"
    : result.finalStatus
  const binding = buildFreshArtifactBinding(artifact, result.artifactPath, now)
  if (binding === undefined) {
    const nextFinalStatus = finalStatus === "passed" ? "artifact-invalid" : finalStatus
    const nextDiagnosticCodes = [...diagnosticCodes, "fresh-receipt-binding-unavailable"]
    return {
      artifactPath: result.artifactPath,
      decision: freshDiagnosticDecision(nextFinalStatus, nextDiagnosticCodes),
      diagnosticCodes: nextDiagnosticCodes,
      finalStatus: nextFinalStatus,
      testCount: testCountResult.testCount,
    }
  }
  const snapshotDiagnosticCodes = sourceSnapshot.status === "unavailable"
    ? [`semantic-${sourceSnapshot.diagnosticCode}`]
    : sourceSnapshot.value.sourceHead !== binding.sourceHead
      || sourceSnapshot.value.dirtyWorktreeDigest !== binding.dirtyWorktreeDigest
      || !sameSourceIdentity(sourceSnapshot.value.snapshot.sourceIdentity, binding.sourceIdentity)
      ? ["semantic-source-snapshot-binding-mismatch"]
      : []
  const snapshotCaptureValid = snapshotDiagnosticCodes.length === 0

  const idFactory = options.idFactory ?? randomUUID
  const sessionId = `session-${idFactory()}`
  const finishId = options.finishId ?? `finish-${idFactory()}`
  const status = finalStatus === "passed" ? "pass" : "fail"
  const lifecycle = writeFreshLifecycleRecords(
    projectDir,
    binding,
    finishId,
    sessionId,
    status,
    testCountResult.testCount,
  )
  if (lifecycle.attemptPath === undefined) {
    const nextFinalStatus = finalStatus === "passed" ? "artifact-invalid" : finalStatus
    const nextDiagnosticCodes = [
      ...diagnosticCodes,
      ...snapshotDiagnosticCodes,
      lifecycle.diagnosticCode ?? "fresh-attempt-write-invalid",
    ]
    return {
      artifactPath: result.artifactPath,
      decision: freshDiagnosticDecision(nextFinalStatus, nextDiagnosticCodes),
      diagnosticCodes: nextDiagnosticCodes,
      finalStatus: nextFinalStatus,
      testCount: testCountResult.testCount,
    }
  }
  if (status === "fail") {
    const snapshot = snapshotCaptureValid
      ? persistSemanticTddSourceSnapshot(projectDir, binding.attemptId, "red", sourceSnapshotCapturedAt, sourceSnapshot)
      : {}
    const nextDiagnosticCodes = [
      ...diagnosticCodes,
      ...snapshotDiagnosticCodes,
      ...(snapshot.diagnosticCode === undefined ? [] : [snapshot.diagnosticCode]),
      ...(lifecycle.diagnosticCode === undefined ? [] : [lifecycle.diagnosticCode]),
    ]
    return {
      artifactPath: result.artifactPath,
      attemptPath: lifecycle.attemptPath,
      decision: freshDiagnosticDecision(finalStatus, nextDiagnosticCodes),
      diagnosticCodes: nextDiagnosticCodes,
      finalStatus,
      testCount: testCountResult.testCount,
    }
  }
  if (lifecycle.receiptPath === undefined) {
    const nextDiagnosticCodes = [
      ...diagnosticCodes,
      lifecycle.diagnosticCode ?? "fresh-receipt-write-invalid",
    ]
    return {
      artifactPath: result.artifactPath,
      attemptPath: lifecycle.attemptPath,
      decision: freshDiagnosticDecision("artifact-invalid", nextDiagnosticCodes),
      diagnosticCodes: nextDiagnosticCodes,
      finalStatus: "artifact-invalid",
      testCount: testCountResult.testCount,
    }
  }
  const snapshot = snapshotCaptureValid
    ? persistSemanticTddSourceSnapshot(projectDir, binding.attemptId, "green", sourceSnapshotCapturedAt, sourceSnapshot)
    : {}
  return {
    artifactPath: result.artifactPath,
    attemptPath: lifecycle.attemptPath,
    decision: freshDiagnosticDecision(finalStatus, [
      ...diagnosticCodes,
      ...snapshotDiagnosticCodes,
      ...(snapshot.diagnosticCode === undefined ? [] : [snapshot.diagnosticCode]),
    ]),
    diagnosticCodes: [
      ...diagnosticCodes,
      ...snapshotDiagnosticCodes,
      ...(snapshot.diagnosticCode === undefined ? [] : [snapshot.diagnosticCode]),
    ],
    finalStatus,
    receiptPath: lifecycle.receiptPath,
    testCount: testCountResult.testCount,
  }
}

function countFreshTests(projectDir: string, artifact: CiReverificationArtifact): { readonly diagnosticCodes: readonly string[]; readonly testCount: number } {
  const refs = [...new Set(artifact.commands.flatMap((command) => command.junitRefs))]
  let testCount = 0
  const diagnosticCodes: string[] = []
  for (const ref of refs) {
    const target = join(projectDir, ref)
    const path = relative(projectDir, target)
    if (isAbsolute(ref) || path.startsWith("../") || path === "..") {
      diagnosticCodes.push("junit-ref-outside-workspace")
      continue
    }
    const read = readBoundedTextFile(target, projectDir, ref)
    if (!read.ok) {
      diagnosticCodes.push("junit-read-failed")
      continue
    }
    testCount += [...read.text.matchAll(/<testcase\b/gu)].length
  }
  if (testCount === 0) diagnosticCodes.push("zero-test-count")
  return { diagnosticCodes: [...new Set(diagnosticCodes)].sort(), testCount }
}

function freshDiagnosticDecision(
  finalStatus: CiReverificationFinalStatus,
  diagnosticCodes: readonly string[],
): VerificationDecision {
  const code = diagnosticCodes[0] ?? `fresh-${finalStatus}`
  return diagnosticVerificationDecision(
    code,
    `Fresh verification result ${finalStatus} is diagnostic-only until a trusted authority path consumes it.`,
  )
}
