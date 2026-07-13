import { createHash } from "node:crypto"
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { loadHarnessConfigResult, resolveConfiguredPathResult } from "../config/harness-config.js"
import { personaHarnessVersion } from "./version.js"
import { sha256 } from "./ci-reverification-catalog.js"
import type { CiReverificationArtifact } from "./ci-reverification-artifact.js"
import {
  parseVerificationAttempt,
  parseVerificationReceipt,
} from "./workflow-verification-receipt.js"
import type {
  VerificationAttempt,
  VerificationReceipt,
  VerificationResultStatus,
  VerificationWorkspaceIdentity,
} from "./workflow-verification-receipt-types.js"

export type FreshArtifactBinding = {
  readonly attemptId: string
  readonly artifactDigest: string
  readonly command: VerificationReceipt["command"]
  readonly dirtyWorktreeDigest: string
  readonly issuedAt: string
  readonly phVersion: string
  readonly sourceHead: string
  readonly workspaceIdentity: VerificationWorkspaceIdentity
}

export type FreshLifecycleWriteResult = {
  readonly attemptPath?: string
  readonly diagnosticCode?: string
  readonly receiptPath?: string
}

export function buildFreshArtifactBinding(
  artifact: CiReverificationArtifact,
  artifactPath: string,
  now: () => number,
): FreshArtifactBinding | undefined {
  const mutation = artifact.mutationSnapshot
  const git = recordValue(mutation.git)
  const pre = recordValue(mutation.pre)
  const workspaceRoot = recordValue(mutation.workspaceRoot)
  const rootPre = workspaceRoot === undefined ? undefined : recordValue(workspaceRoot.pre)
  const sourceHead = stringValue(git?.preHead)
  const dirtyWorktreeDigest = stringValue(pre?.normalizedPorcelainNameStatusNulSha256)
  const realpath = stringValue(rootPre?.realpath)
  const device = stringValue(rootPre?.dev)
  const inode = stringValue(rootPre?.ino)
  const phVersion = personaHarnessVersion()
  if (
    sourceHead === undefined
    || !/^[0-9a-f]{40,64}$/u.test(sourceHead)
    || dirtyWorktreeDigest === undefined
    || !/^[a-f0-9]{64}$/u.test(dirtyWorktreeDigest)
    || realpath === undefined
    || device === undefined
    || inode === undefined
    || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(phVersion)
  ) {
    return undefined
  }
  return {
    artifactDigest: `sha256:${sha256(readFileSync(artifactPath))}`,
    attemptId: artifact.attemptId,
    command: {
      argvDigest: `sha256:${artifact.commandPlanSha256}`,
      catalogId: artifact.commandCatalogId,
    },
    dirtyWorktreeDigest: `sha256:${dirtyWorktreeDigest}`,
    issuedAt: new Date(now()).toISOString(),
    phVersion,
    sourceHead: sourceHead.toLowerCase(),
    workspaceIdentity: {
      deviceIdentity: `${device}:${inode}`,
      platform: platformName(process.platform),
      rootDigest: digest({ device, inode, realpath }),
    },
  }
}

export function writeFreshLifecycleRecords(
  projectDir: string,
  binding: FreshArtifactBinding,
  finishId: string,
  sessionId: string,
  status: VerificationResultStatus,
  testCount: number,
): FreshLifecycleWriteResult {
  const configResult = loadHarnessConfigResult(projectDir)
  if (!configResult.safe) return { diagnosticCode: "harness-config-invalid" }
  const evidencePath = resolveConfiguredPathResult(projectDir, configResult.config.evidenceDir)
  if (!evidencePath.ok) return { diagnosticCode: "evidence-path-unsafe" }
  const receiptId = `receipt-${binding.attemptId}`
  const provenanceDigest = digest({
    artifactDigest: binding.artifactDigest,
    attemptId: binding.attemptId,
    finishId,
    sessionId,
    status,
    testCount,
  })
  const attempt = buildAttempt(binding, finishId, provenanceDigest, sessionId, status, receiptId)
  const attemptPath = writeAttempt(evidencePath.path, attempt)
  if (attemptPath === undefined) return { diagnosticCode: "fresh-attempt-write-invalid" }
  if (status === "fail") return { attemptPath }

  const receipt = buildReceipt(binding, finishId, provenanceDigest, sessionId, receiptId, testCount)
  const receiptPath = writeReceipt(evidencePath.path, receipt)
  if (receiptPath === undefined) return { attemptPath, diagnosticCode: "fresh-receipt-write-invalid" }
  return { attemptPath, receiptPath }
}

function buildAttempt(
  binding: FreshArtifactBinding,
  finishId: string,
  provenanceDigest: string,
  sessionId: string,
  status: VerificationResultStatus,
  receiptId: string,
): VerificationAttempt {
  const completed = status === "pass"
  return {
    attemptId: binding.attemptId,
    command: binding.command,
    completedAt: completed ? binding.issuedAt : null,
    dirtyWorktreeDigest: binding.dirtyWorktreeDigest,
    finishId,
    phVersion: binding.phVersion,
    provenanceDigest,
    receiptId: completed ? receiptId : null,
    schemaVersion: "verification-attempt.1",
    sessionId,
    sourceHead: binding.sourceHead,
    startedAt: binding.issuedAt,
    status: completed ? "completed" : "failed",
    workspaceIdentity: binding.workspaceIdentity,
  }
}

function buildReceipt(
  binding: FreshArtifactBinding,
  finishId: string,
  provenanceDigest: string,
  sessionId: string,
  receiptId: string,
  testCount: number,
): VerificationReceipt {
  return {
    attemptId: binding.attemptId,
    authorityClass: "local-fresh-cooperative",
    command: binding.command,
    dirtyWorktreeDigest: binding.dirtyWorktreeDigest,
    expiresAt: new Date(Date.parse(binding.issuedAt) + 60 * 60 * 1000).toISOString(),
    finishId,
    issuedAt: binding.issuedAt,
    issuer: { id: "persona-harness", kind: "persona-harness" },
    issuerVerificationState: "cooperative-unverified",
    phVersion: binding.phVersion,
    provenanceDigest,
    receiptId,
    result: { artifactDigests: [binding.artifactDigest], status: "pass", testCount },
    schemaVersion: "verification-receipt.1",
    sessionId,
    sourceHead: binding.sourceHead,
    workspaceIdentity: binding.workspaceIdentity,
  }
}

function writeAttempt(evidenceRoot: string, attempt: VerificationAttempt): string | undefined {
  const result = writeRecord(evidenceRoot, "verification-attempts", `${attempt.attemptId}.json`, attempt)
  return result?.valid === true ? result.path : undefined
}

function writeReceipt(evidenceRoot: string, receipt: VerificationReceipt): string | undefined {
  const result = writeRecord(evidenceRoot, "verification-receipts", `${receipt.receiptId}.json`, receipt)
  return result?.valid === true ? result.path : undefined
}

function writeRecord(
  evidenceRoot: string,
  relativeDirectory: string,
  filename: string,
  value: VerificationAttempt | VerificationReceipt,
): { readonly path: string; readonly valid: boolean } | undefined {
  const directory = join(evidenceRoot, relativeDirectory)
  mkdirSync(directory, { recursive: true })
  try {
    const directoryStat = lstatSync(directory)
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) return undefined
    const path = join(directory, filename)
    const descriptor = openSync(path, "wx", 0o600)
    try {
      writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8")
      fsyncSync(descriptor)
    } finally {
      closeSync(descriptor)
    }
    const source = readFileSync(path, "utf8")
    const parsed = value.schemaVersion === "verification-receipt.1"
      ? parseVerificationReceipt(source, path)
      : parseVerificationAttempt(source, path)
    return { path, valid: parsed.ok }
  } catch (error) {
    if (error instanceof Error) return undefined
    throw error
  }
}

function recordValue(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return isRecord(value) ? value : undefined
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function digest(value: Readonly<Record<string, unknown>>): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`
}

function platformName(platform: NodeJS.Platform): VerificationWorkspaceIdentity["platform"] {
  if (platform === "darwin" || platform === "linux" || platform === "win32") return platform
  return "unknown"
}
