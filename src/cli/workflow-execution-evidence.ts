import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { isRecord } from "../config/jsonc.js"
import type { ClosureVerification } from "./workflow-closure-verification.js"

export type ExecutionEvidenceVerification = {
  readonly evidenceRef?: string
  readonly observed: boolean
  readonly reason: string
  readonly verification: Exclude<ClosureVerification, "not-run">
}

const EVIDENCE_DIR = ".persona/evidence"
const JUNIT_RESULT_DIRS = ["build/test-results/test", "target/surefire-reports"] as const
const SUCCESS_PATTERNS = [
  /BUILD SUCCESSFUL/i,
  /(?:test|build|runtime smoke|bootRun)\s+PASS/i,
  /Tomcat started/i,
  /Started\s+\w*Application/i,
] as const
const FAILURE_PATTERNS = [
  /BUILD FAILED/i,
  /Could not resolve/i,
  /exit\s+1/i,
  /(?:compile|compilation|test|build|runtime smoke|bootRun)\s+failed/i,
] as const
const COMMAND_MENTION_PATTERN = /\b(?:\.\/)?gradlew(?:\.bat)?\s+(?:test|build|bootRun)\b|\bbootRun\b|\bcurl\b/i
const EXECUTION_SOURCE_PATTERN = /\bbearshell\b|\bnpx\s+ph\s+bearshell\b/i
const STATUS_KEYS = ["status", "exitCode", "exit_code", "code"] as const

export function hasVerificationCommandMention(text: string): boolean {
  return COMMAND_MENTION_PATTERN.test(text)
}

export function hasVerificationSuccessText(text: string): boolean {
  return SUCCESS_PATTERNS.some((pattern) => pattern.test(text))
}

export function readExecutionEvidenceVerification(projectDir: string): ExecutionEvidenceVerification {
  const entries = readEvidenceEntries(join(projectDir, EVIDENCE_DIR), EVIDENCE_DIR)
  const evidenceText = entries.map((entry) => entry.text).join("\n")
  const junit = junitVerification(projectDir)
  if (junit.verification !== "unknown") {
    return junit
  }
  if (FAILURE_PATTERNS.some((pattern) => pattern.test(evidenceText))) {
    return { evidenceRef: entries[0]?.ref ?? EVIDENCE_DIR, observed: true, reason: "explicit verification failure evidence observed", verification: "failed" }
  }
  const structured = structuredExecutionVerification(entries)
  if (structured.verification !== "unknown") {
    return structured
  }
  if (evidenceText.length === 0) {
    return { observed: false, reason: "no structured execution evidence observed", verification: "unknown" }
  }
  if (COMMAND_MENTION_PATTERN.test(evidenceText)) {
    return { evidenceRef: EVIDENCE_DIR, observed: true, reason: "verification commands mentioned without structured success/failure evidence", verification: "unknown" }
  }
  return { evidenceRef: EVIDENCE_DIR, observed: true, reason: "verification evidence is present but inconclusive", verification: "unknown" }
}

type EvidenceEntry = {
  readonly parsed?: unknown
  readonly ref: string
  readonly text: string
}

function readEvidenceEntries(dirPath: string, refPath: string): readonly EvidenceEntry[] {
  if (!existsSync(dirPath)) {
    return []
  }
  return readdirSync(dirPath)
    .sort()
    .flatMap((entry) => {
      const entryPath = join(dirPath, entry)
      const entryRef = `${refPath}/${entry}`
      const stat = statSync(entryPath)
      if (stat.isDirectory()) {
        return readEvidenceEntries(entryPath, entryRef)
      }
      if (!stat.isFile()) {
        return []
      }
      const text = readFileSync(entryPath, "utf8")
      const parsed = parseJson(text)
      if (isCiReverificationArtifact(parsed)) {
        return []
      }
      return [{ parsed, ref: entryRef, text }]
    })
    .filter((entry) => entry.text.length > 0)
}

function isCiReverificationArtifact(value: unknown): boolean {
  return isRecord(value) && value["schemaVersion"] === "ph-ci-reverification.1"
}

function parseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined
    }
    throw error
  }
}

function structuredExecutionVerification(entries: readonly EvidenceEntry[]): ExecutionEvidenceVerification {
  for (const entry of entries) {
    if (!isRecord(entry.parsed)) {
      continue
    }
    const evidenceText = valueText(entry.parsed)
    if (!EXECUTION_SOURCE_PATTERN.test(evidenceText)) {
      continue
    }
    const status = executionStatus(entry.parsed)
    if (status === "failed" || FAILURE_PATTERNS.some((pattern) => pattern.test(evidenceText))) {
      return { evidenceRef: entry.ref, observed: true, reason: "structured verification execution failure evidence observed", verification: "failed" }
    }
    if (
      status === "passed"
      && (COMMAND_MENTION_PATTERN.test(evidenceText) || SUCCESS_PATTERNS.some((pattern) => pattern.test(evidenceText)))
    ) {
      return { evidenceRef: entry.ref, observed: true, reason: "structured verification execution success evidence observed", verification: "passed" }
    }
  }
  return { observed: entries.length > 0, reason: "no structured execution evidence observed", verification: "unknown" }
}

type ExecutionStatus = "failed" | "passed" | "unknown"

function executionStatus(record: Readonly<Record<string, unknown>>): ExecutionStatus {
  if (record["success"] === true || stringStatus(record["success"]) === "passed") {
    return "passed"
  }
  if (record["success"] === false || stringStatus(record["success"]) === "failed") {
    return "failed"
  }
  for (const key of STATUS_KEYS) {
    const status = numericStatus(record[key]) ?? stringStatus(record[key])
    if (status !== "unknown") {
      return status
    }
  }
  return "unknown"
}

function numericStatus(value: unknown): ExecutionStatus | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null
  }
  return value === 0 ? "passed" : "failed"
}

function stringStatus(value: unknown): ExecutionStatus {
  if (typeof value !== "string") {
    return "unknown"
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === "0" || normalized === "pass" || normalized === "passed" || normalized === "success" || normalized === "successful") {
    return "passed"
  }
  if (normalized === "1" || normalized === "fail" || normalized === "failed" || normalized === "error") {
    return "failed"
  }
  return "unknown"
}

function valueText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map((item) => valueText(item)).filter((text) => text.length > 0).join("\n")
  }
  if (isRecord(value)) {
    return Object.values(value).map((item) => valueText(item)).filter((text) => text.length > 0).join("\n")
  }
  return ""
}

function junitVerification(projectDir: string): ExecutionEvidenceVerification {
  const files = JUNIT_RESULT_DIRS.flatMap((dir) => junitFiles(join(projectDir, dir), dir))
  if (files.length === 0) {
    return { observed: false, reason: "no JUnit XML verification evidence observed", verification: "unknown" }
  }
  const totals = files
    .map((file) => parseJUnitXml(readFileSync(join(projectDir, file), "utf8")))
    .reduce(
      (total, next) => ({
        errors: total.errors + next.errors,
        failures: total.failures + next.failures,
        tests: total.tests + next.tests,
      }),
      { errors: 0, failures: 0, tests: 0 },
    )
  const evidenceRef = files[0]
  if (totals.errors > 0 || totals.failures > 0) {
    return { evidenceRef, observed: true, reason: `JUnit XML verification failures observed (${totals.failures} failures, ${totals.errors} errors)`, verification: "failed" }
  }
  if (totals.tests > 0) {
    return { evidenceRef, observed: true, reason: `JUnit XML verification success evidence observed (${totals.tests} tests)`, verification: "passed" }
  }
  return { evidenceRef, observed: true, reason: "JUnit XML verification evidence is present but contains no tests", verification: "unknown" }
}

function junitFiles(dirPath: string, refPath: string): readonly string[] {
  if (!existsSync(dirPath)) {
    return []
  }
  return readdirSync(dirPath)
    .sort()
    .flatMap((entry) => {
      const entryPath = join(dirPath, entry)
      const entryRef = `${refPath}/${entry}`
      const stat = statSync(entryPath)
      if (stat.isDirectory()) {
        return junitFiles(entryPath, entryRef)
      }
      return stat.isFile() && entry.endsWith(".xml") ? [entryRef] : []
    })
}

type JunitTotals = {
  readonly errors: number
  readonly failures: number
  readonly tests: number
}

function parseJUnitXml(xmlText: string): JunitTotals {
  const suites = [...xmlText.matchAll(/<testsuite\b([^>]*)>/g)].map((match) => parseJUnitAttributes(match[1] ?? ""))
  if (suites.length > 0) {
    return suites.reduce(
      (total, next) => ({
        errors: total.errors + next.errors,
        failures: total.failures + next.failures,
        tests: total.tests + next.tests,
      }),
      { errors: 0, failures: 0, tests: 0 },
    )
  }
  return {
    errors: [...xmlText.matchAll(/<error\b/g)].length,
    failures: [...xmlText.matchAll(/<failure\b/g)].length,
    tests: [...xmlText.matchAll(/<testcase\b/g)].length,
  }
}

function parseJUnitAttributes(attributeText: string): JunitTotals {
  return {
    errors: parseJUnitInteger(attributeText, "errors"),
    failures: parseJUnitInteger(attributeText, "failures"),
    tests: parseJUnitInteger(attributeText, "tests"),
  }
}

function parseJUnitInteger(attributeText: string, name: string): number {
  const match = attributeText.match(new RegExp(`\\b${name}="(\\d+)"`))
  return match?.[1] === undefined ? 0 : Number.parseInt(match[1], 10)
}
