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

export type FreshVerificationResult = {
  readonly artifactPath?: string
  readonly attemptPath?: string
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
  const result = runReverification(projectDir, mode, {
    ...options.reverificationOptions,
    now,
  })
  if (result.artifactPath === undefined) {
    return { diagnosticCodes: [...result.diagnosticCodes, "fresh-receipt-unavailable"], finalStatus: result.finalStatus, testCount: 0 }
  }

  const source = readFileSync(result.artifactPath, "utf8")
  const artifact = parseCiReverificationArtifact(source)
  if (artifact === undefined) {
    return {
      artifactPath: result.artifactPath,
      diagnosticCodes: [...result.diagnosticCodes, "fresh-artifact-invalid"],
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
    return {
      artifactPath: result.artifactPath,
      diagnosticCodes: [...diagnosticCodes, "fresh-receipt-binding-unavailable"],
      finalStatus: finalStatus === "passed" ? "artifact-invalid" : finalStatus,
      testCount: testCountResult.testCount,
    }
  }

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
    return {
      artifactPath: result.artifactPath,
      diagnosticCodes: [...diagnosticCodes, lifecycle.diagnosticCode ?? "fresh-attempt-write-invalid"],
      finalStatus: finalStatus === "passed" ? "artifact-invalid" : finalStatus,
      testCount: testCountResult.testCount,
    }
  }
  if (status === "fail") {
    return {
      artifactPath: result.artifactPath,
      attemptPath: lifecycle.attemptPath,
      diagnosticCodes: [...diagnosticCodes, ...(lifecycle.diagnosticCode === undefined ? [] : [lifecycle.diagnosticCode])],
      finalStatus,
      testCount: testCountResult.testCount,
    }
  }
  if (lifecycle.receiptPath === undefined) {
    return {
      artifactPath: result.artifactPath,
      attemptPath: lifecycle.attemptPath,
      diagnosticCodes: [...diagnosticCodes, lifecycle.diagnosticCode ?? "fresh-receipt-write-invalid"],
      finalStatus: "artifact-invalid",
      testCount: testCountResult.testCount,
    }
  }
  return {
    artifactPath: result.artifactPath,
    attemptPath: lifecycle.attemptPath,
    diagnosticCodes,
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
