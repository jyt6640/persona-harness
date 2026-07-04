import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { loadHarnessConfig } from "../config/harness-config.js"
import { isRecord } from "../config/jsonc.js"
import { writeFileAtomic } from "../io/atomic-file.js"
import type { CliRunResult } from "./bearshell.js"
import { runDirectTestVerification, type DirectTestVerificationResult, type JunitTestCase } from "./closure-verification-runner.js"
import { BACKLOG_PATH, pendingTickets } from "./workflow-ticket-model.js"

export type TddClosureFinding =
  | { readonly kind: "disabled" | "no-ticket" | "unavailable" | "passed"; readonly evidenceRef?: string; readonly reason: string }
  | { readonly kind: "red-missing" | "red-without-green"; readonly evidenceRef?: string; readonly reason: string; readonly source: string }

type TddEvidenceStatus = "green" | "red"

type TddEvidence = {
  readonly execution: "ph-direct-gradle-junit"
  readonly generatedBy: "persona-harness"
  readonly headCommit: string | null
  readonly junitRefs: readonly string[]
  readonly junitSnapshots: readonly string[]
  readonly schemaVersion: "tdd-workflow.1"
  readonly sequence: number
  readonly status: TddEvidenceStatus
  readonly testIds: readonly string[]
  readonly ticket: string
  readonly timestamp: string
  readonly verification: {
    readonly command: string
    readonly exitCode: number
    readonly junitSnapshotDigest: string
    readonly junitRefCount: number
  }
}

const TDD_EVIDENCE_DIR = ".persona/evidence/tdd"

export function runWorkflowTddTest(options: { readonly projectDir?: string }): CliRunResult {
  const projectDir = options.projectDir ?? process.cwd()
  const config = loadHarnessConfig(projectDir)
  if (!config.enforce.executeVerification) {
    return {
      status: 0,
      stdout: [
        "TDD red evidence unavailable: enforce.executeVerification is false.",
        "Enable strict PH-run verification before using `ph workflow test`; no red/green evidence was written.",
      ].join("\n") + "\n",
      stderr: "",
    }
  }
  const ticket = currentTicketId(projectDir)
  if (ticket === null) {
    return { status: 1, stdout: "", stderr: "TDD red evidence requires a pending workflow ticket.\n" }
  }

  const result = runDirectTestVerification(projectDir)
  const failedCases = result.junitCases.filter((testCase) => testCase.outcome === "failure")
  if (failedCases.length === 0) {
    return notRedResult(result)
  }

  const evidence = writeTddEvidence(projectDir, ticket, "red", failedCases, result)
  return {
    status: 0,
    stdout: [
      `TDD red evidence recorded for ${ticket}.`,
      `Failing tests: ${failedCases.map((testCase) => testCase.testId).join(", ")}`,
      `Evidence: ${evidence}`,
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function recordTddGreenForCurrentTicket(projectDir: string): void {
  const ticket = currentTicketId(projectDir)
  if (ticket !== null) {
    readTddClosureFinding(projectDir, ticket, { recordGreenEvidence: true })
  }
}

export function readTddClosureFinding(
  projectDir: string,
  ticketId: string | null,
  options: { readonly recordGreenEvidence?: boolean } = {},
): TddClosureFinding {
  const config = loadHarnessConfig(projectDir)
  if (!config.enforce.tdd) {
    return { kind: "disabled", reason: "enforce.tdd is disabled" }
  }
  if (!config.enforce.executeVerification) {
    return {
      kind: "unavailable",
      reason: "enforce.tdd requires enforce.executeVerification; TDD closure is advisory without strict PH-run verification",
    }
  }
  if (ticketId === null) {
    return { kind: "no-ticket", reason: "no active workflow ticket requires TDD evidence" }
  }

  const redEvidence = readValidTddEvidence(projectDir, ticketId, "red")
  if (redEvidence.length === 0) {
    return {
      kind: "red-missing",
      reason: `${ticketId} has no PH-run red evidence from \`ph workflow test\``,
      source: evidenceDirRef(ticketId),
    }
  }

  const greenEvidence = options.recordGreenEvidence === true
    ? ensureGreenEvidence(projectDir, ticketId, redEvidence)
    : readValidTddEvidence(projectDir, ticketId, "green")
  const missingGreen = redEvidenceTestIds(redEvidence).filter((testId) => !hasGreenAfterRed(testId, redEvidence, greenEvidence))
  if (missingGreen.length > 0) {
    return {
      evidenceRef: redEvidence[0]?.ref,
      kind: "red-without-green",
      reason: `${ticketId} red tests have not gone green after red evidence: ${missingGreen.join(", ")}`,
      source: evidenceDirRef(ticketId),
    }
  }
  return {
    evidenceRef: greenEvidence[0]?.ref ?? redEvidence[0]?.ref,
    kind: "passed",
    reason: `${ticketId} has PH-run red→green evidence for ${redEvidenceTestIds(redEvidence).join(", ")}`,
  }
}

function notRedResult(result: DirectTestVerificationResult): CliRunResult {
  const hasErrorCase = result.junitCases.some((testCase) => testCase.outcome === "error")
  if (result.verification === "passed") {
    return {
      status: 1,
      stdout: [
        "TDD red evidence was not recorded because the PH-run tests are already green.",
        "Write a failing behavior test first, then rerun `ph workflow test` before implementation.",
      ].join("\n") + "\n",
      stderr: "",
    }
  }
  if (hasErrorCase) {
    return {
      status: 1,
      stdout: "",
      stderr: "Invalid TDD red: JUnit error cases are not accepted as behavior/assertion failures.\n",
    }
  }
  return {
    status: 1,
    stdout: "",
    stderr: "Invalid TDD red: PH direct verification failed without a failing JUnit testcase.\n",
  }
}

function currentTicketId(projectDir: string): string | null {
  const backlogPath = join(projectDir, BACKLOG_PATH)
  if (!existsSync(backlogPath)) {
    return null
  }
  return pendingTickets(readFileSync(backlogPath, "utf8"))[0]?.ticket ?? null
}

function ensureGreenEvidence(projectDir: string, ticket: string, redEvidence: readonly TddEvidenceWithRef[]): readonly TddEvidenceWithRef[] {
  const existing = readValidTddEvidence(projectDir, ticket, "green")
  const redTestIds = redEvidenceTestIds(redEvidence)
  if (redTestIds.every((testId) => hasGreenAfterRed(testId, redEvidence, existing))) {
    return existing
  }

  const result = runDirectTestVerification(projectDir)
  if (result.verification !== "passed") {
    return existing
  }
  const passingRedCases = result.junitCases.filter((testCase) => testCase.outcome === "passed" && redTestIds.includes(testCase.testId))
  if (passingRedCases.length === 0) {
    return existing
  }
  writeTddEvidence(projectDir, ticket, "green", passingRedCases, result)
  return readValidTddEvidence(projectDir, ticket, "green")
}

type TddEvidenceWithRef = TddEvidence & {
  readonly ref: string
}

function readValidTddEvidence(projectDir: string, ticket: string, status: TddEvidenceStatus): readonly TddEvidenceWithRef[] {
  const dir = join(projectDir, evidenceDirRef(ticket))
  if (!existsSync(dir)) {
    return []
  }
  return readdirSync(dir)
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .flatMap((entry) => {
      const ref = `${evidenceDirRef(ticket)}/${entry}`
      const evidence = parseTddEvidence(projectDir, readFileSync(join(dir, entry), "utf8"), ref)
      if (evidence === undefined || evidence.ticket !== ticket || evidence.status !== status) {
        return []
      }
      return [evidence]
    })
    .sort((left, right) => left.sequence - right.sequence)
}

function parseTddEvidence(projectDir: string, text: string, ref: string): TddEvidenceWithRef | undefined {
  const parsed = parseJson(text)
  if (!isRecord(parsed) || !isRecord(parsed.verification)) {
    return undefined
  }
  const testIds = readStringArray(parsed.testIds)
  const junitRefs = readStringArray(parsed.junitRefs)
  if (
    parsed.schemaVersion !== "tdd-workflow.1"
    || parsed.generatedBy !== "persona-harness"
    || parsed.execution !== "ph-direct-gradle-junit"
    || (parsed.status !== "red" && parsed.status !== "green")
    || typeof parsed.ticket !== "string"
    || typeof parsed.timestamp !== "string"
    || typeof parsed.sequence !== "number"
    || testIds.length === 0
    || junitRefs.length === 0
    || typeof parsed.verification.command !== "string"
    || typeof parsed.verification.exitCode !== "number"
    || typeof parsed.verification.junitSnapshotDigest !== "string"
    || typeof parsed.verification.junitRefCount !== "number"
  ) {
    return undefined
  }
  const junitSnapshots = readStringArray(parsed.junitSnapshots)
  if (junitSnapshots.length === 0 || parsed.verification.junitSnapshotDigest !== junitSnapshotDigest(projectDir, junitSnapshots)) {
    return undefined
  }
  return {
    execution: parsed.execution,
    generatedBy: parsed.generatedBy,
    headCommit: typeof parsed.headCommit === "string" ? parsed.headCommit : null,
    junitRefs,
    junitSnapshots,
    ref,
    schemaVersion: parsed.schemaVersion,
    sequence: parsed.sequence,
    status: parsed.status,
    testIds,
    ticket: parsed.ticket,
    timestamp: parsed.timestamp,
    verification: {
      command: parsed.verification.command,
      exitCode: parsed.verification.exitCode,
      junitSnapshotDigest: parsed.verification.junitSnapshotDigest,
      junitRefCount: parsed.verification.junitRefCount,
    },
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []
}

function redEvidenceTestIds(evidence: readonly TddEvidence[]): readonly string[] {
  return [...new Set(evidence.flatMap((item) => item.testIds))].sort()
}

function hasGreenAfterRed(testId: string, redEvidence: readonly TddEvidence[], greenEvidence: readonly TddEvidence[]): boolean {
  const redSequence = redEvidence
    .filter((item) => item.testIds.includes(testId))
    .map((item) => item.sequence)
    .sort((left, right) => left - right)[0]
  if (redSequence === undefined) {
    return false
  }
  return greenEvidence.some((item) => item.testIds.includes(testId) && item.sequence > redSequence)
}

function writeTddEvidence(
  projectDir: string,
  ticket: string,
  status: TddEvidenceStatus,
  cases: readonly JunitTestCase[],
  result: DirectTestVerificationResult,
): string {
  const safeTicket = safeSegment(ticket)
  const dir = join(projectDir, TDD_EVIDENCE_DIR, safeTicket)
  mkdirSync(dir, { recursive: true })
  const timestamp = new Date().toISOString()
  const filename = `${status}-${timestamp.replaceAll(/[:.]/g, "-")}.json`
  const ref = `${TDD_EVIDENCE_DIR}/${safeTicket}/${filename}`
  const commandDisplay = result.command?.display ?? "unknown verification command"
  const sequence = nextEvidenceSequence(dir)
  const junitSnapshots = writeJunitSnapshots(projectDir, safeTicket, status, timestamp, result.junitRefs)
  const evidence: TddEvidence = {
    execution: "ph-direct-gradle-junit",
    generatedBy: "persona-harness",
    headCommit: gitHead(projectDir),
    junitRefs: result.junitRefs,
    junitSnapshots,
    schemaVersion: "tdd-workflow.1",
    sequence,
    status,
    testIds: [...new Set(cases.map((testCase) => testCase.testId))].sort(),
    ticket,
    timestamp,
    verification: {
      command: commandDisplay,
      exitCode: result.exitCode ?? -1,
      junitSnapshotDigest: junitSnapshotDigest(projectDir, junitSnapshots),
      junitRefCount: result.junitRefs.length,
    },
  }
  writeFileAtomic(join(projectDir, ref), `${JSON.stringify(evidence, null, 2)}\n`)
  return ref
}

function writeJunitSnapshots(
  projectDir: string,
  safeTicket: string,
  status: TddEvidenceStatus,
  timestamp: string,
  refs: readonly string[],
): readonly string[] {
  const snapshotDirRef = `${TDD_EVIDENCE_DIR}/${safeTicket}/junit`
  const snapshotDir = join(projectDir, snapshotDirRef)
  mkdirSync(snapshotDir, { recursive: true })
  return refs.flatMap((ref, index) => {
    const source = join(projectDir, ref)
    if (!existsSync(source)) {
      return []
    }
    const filename = `${status}-${timestamp.replaceAll(/[:.]/g, "-")}-${index}.xml`
    copyFileSync(source, join(snapshotDir, filename))
    return [`${snapshotDirRef}/${filename}`]
  })
}

function nextEvidenceSequence(dir: string): number {
  const existing = readdirSync(dir)
    .filter((entry) => entry.endsWith(".json"))
    .flatMap((entry) => {
      const parsed = parseJson(readFileSync(join(dir, entry), "utf8"))
      return isRecord(parsed) && typeof parsed.sequence === "number" ? [parsed.sequence] : []
    })
  const latest = existing.sort((left, right) => right - left)[0]
  return latest === undefined ? Date.now() : Math.max(Date.now(), latest + 1)
}

function junitSnapshotDigest(projectDir: string, refs: readonly string[]): string {
  const hash = createHash("sha256")
  for (const ref of refs) {
    hash.update(ref)
    hash.update("\0")
    if (existsSync(join(projectDir, ref))) {
      hash.update(readFileSync(join(projectDir, ref)))
    }
    hash.update("\0")
  }
  return hash.digest("hex")
}


function gitHead(projectDir: string): string | null {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: projectDir, encoding: "utf8", timeout: 5_000, windowsHide: true })
  return result.status === 0 ? result.stdout.trim() : null
}

function safeSegment(value: string): string {
  const safe = value.toLowerCase().replaceAll(/[^a-z0-9._-]+/g, "-").replaceAll(/^-+|-+$/g, "")
  return safe.length > 0 ? safe : "ticket"
}

function evidenceDirRef(ticket: string): string {
  return `${TDD_EVIDENCE_DIR}/${safeSegment(ticket)}`
}
