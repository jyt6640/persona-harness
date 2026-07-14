import { existsSync } from "node:fs"
import { join } from "node:path"

import { runBoundedProcess } from "./bounded-process.js"
import {
  discoverJUnitResults,
  type JunitResultFile,
} from "./junit-result-discovery.js"
import { readProfileIntent } from "./stack-alignment-profile.js"
import type { ClosureVerificationSummary } from "./workflow-closure-verification.js"

const DIRECT_VERIFICATION_TIMEOUT_MS = 120_000

export type VerificationCommand = {
  readonly args: readonly string[]
  readonly command: string
  readonly display: string
}

export type JunitTestCaseOutcome = "error" | "failure" | "passed"

export type JunitTestCase = {
  readonly classname: string
  readonly name: string
  readonly outcome: JunitTestCaseOutcome
  readonly ref: string
  readonly testId: string
}

type JunitTotals = {
  readonly errors: number
  readonly failures: number
  readonly tests: number
}

export type DirectTestVerificationResult = {
  readonly command?: VerificationCommand
  readonly diagnosticCodes: readonly string[]
  readonly evidenceRef?: string
  readonly exitCode?: number
  readonly junitCases: readonly JunitTestCase[]
  readonly junitRefs: readonly string[]
  readonly output: string
  readonly reason: string
  readonly verification: ClosureVerificationSummary["verification"]
}

export function runDirectClosureVerification(projectDir: string): ClosureVerificationSummary {
  const result = runDirectTestVerification(projectDir)
  if (result.command === undefined) {
    return { reason: result.reason, verification: result.verification }
  }
  if (result.verification === "failed") {
    return {
      evidenceRef: result.evidenceRef,
      reason: result.reason,
      verification: "failed",
    }
  }
  if (result.verification === "passed") {
    return {
      evidenceRef: result.evidenceRef,
      reason: result.reason,
      verification: "passed",
    }
  }
  return {
    evidenceRef: result.evidenceRef,
    reason: result.reason,
    verification: "unknown",
  }
}

export function runDirectTestVerification(projectDir: string): DirectTestVerificationResult {
  const verificationCommand = resolveVerificationCommand(projectDir)
  if (verificationCommand === undefined) {
    return {
      diagnosticCodes: [],
      junitCases: [],
      junitRefs: [],
      output: "",
      reason: "PH direct verification is enabled, but no supported Java/Spring/Gradle verification command was found",
      verification: "unknown",
    }
  }

  const startedAtMs = Date.now()
  const result = runBoundedProcess({
    args: verificationCommand.args,
    command: verificationCommand.command,
    cwd: projectDir,
    graceMs: 5_000,
    timeoutMs: DIRECT_VERIFICATION_TIMEOUT_MS,
  })
  const status = result.status
  const output = [result.stdout, result.stderr].filter((text) => text.length > 0).join("\n")
  const evidenceRef = `PH direct verification: ${verificationCommand.display}`
  const junit = discoverJUnitResults(projectDir, {
    minimumMtimeMs: startedAtMs,
    minimumMtimeToleranceMs: 1_000,
  })
  const junitFiles = junit.files
  const junitRefs = junitFiles.map((file) => file.ref)
  const junitCases = junitFiles.flatMap((file) => parseJUnitTestCases(file.text, file.ref))
  if (!junit.safe) {
    const discoveryReason = `JUnit result discovery failed closed (${junit.diagnostics.join(", ")})`
    return {
      command: verificationCommand,
      diagnosticCodes: junit.diagnostics,
      evidenceRef,
      exitCode: status,
      junitCases: [],
      junitRefs: [],
      output,
      reason: status !== 0
        ? `PH direct verification failed: ${discoveryReason}${processOutcomeReason(result.outcome, DIRECT_VERIFICATION_TIMEOUT_MS)}${outputReason(output)}`
        : `PH direct verification could not be verified: ${discoveryReason}`,
      verification: status !== 0 ? "failed" : "unknown",
    }
  }
  if (status !== 0) {
    const verification = junitVerificationFromFiles(junitFiles)
    if (verification.verification === "failed") {
      return {
        command: verificationCommand,
        diagnosticCodes: [],
        evidenceRef: verification.evidenceRef,
        exitCode: status,
        junitCases,
        junitRefs,
        output,
        reason: `PH direct verification failed: ${verification.reason}`,
        verification: "failed",
      }
    }
    return {
      command: verificationCommand,
      diagnosticCodes: [],
      evidenceRef,
      exitCode: status,
      junitCases,
      junitRefs,
      output,
      reason: `PH direct verification failed (${verificationCommand.display}, exit ${status})${processOutcomeReason(result.outcome, DIRECT_VERIFICATION_TIMEOUT_MS)}${outputReason(output)}`,
      verification: "failed",
    }
  }

  const verification = junitVerificationFromFiles(junitFiles)
  if (verification.verification === "failed") {
    return {
      command: verificationCommand,
      diagnosticCodes: [],
      evidenceRef: verification.evidenceRef,
      exitCode: status,
      junitCases,
      junitRefs,
      output,
      reason: `PH direct verification failed: ${verification.reason}`,
      verification: "failed",
    }
  }
  return {
    command: verificationCommand,
    diagnosticCodes: [],
    evidenceRef: verification.evidenceRef ?? evidenceRef,
    exitCode: status,
    junitCases,
    junitRefs,
    output,
    reason: verification.verification === "passed"
      ? `PH direct verification passed (${verificationCommand.display}); ${verification.reason}`
      : `PH direct verification passed (${verificationCommand.display}, exit 0)`,
    verification: "passed",
  }
}

function resolveVerificationCommand(projectDir: string): VerificationCommand | undefined {
  if (!looksLikeGradleProject(projectDir)) {
    return undefined
  }
  if (process.platform === "win32" && existsSync(join(projectDir, "gradlew.bat"))) {
    return { args: ["/d", "/s", "/c", "gradlew.bat", "test"], command: "cmd.exe", display: "gradlew.bat test" }
  }
  if (existsSync(join(projectDir, "gradlew"))) {
    return { args: ["test"], command: "./gradlew", display: "./gradlew test" }
  }
  return { args: ["test"], command: "gradle", display: "gradle test" }
}

function looksLikeGradleProject(projectDir: string): boolean {
  const profile = readProfileIntent(projectDir)
  return profile?.buildTool.includes("gradle") === true
    || existsSync(join(projectDir, "build.gradle"))
    || existsSync(join(projectDir, "build.gradle.kts"))
    || existsSync(join(projectDir, "settings.gradle"))
    || existsSync(join(projectDir, "settings.gradle.kts"))
    || existsSync(join(projectDir, "gradlew"))
    || existsSync(join(projectDir, "gradlew.bat"))
}

function junitVerificationFromFiles(files: readonly JunitResultFile[]): ClosureVerificationSummary {
  if (files.length === 0) {
    return { reason: "no JUnit XML verification evidence observed", verification: "unknown" }
  }
  const totals = files
    .map((file) => parseJUnitXml(file.text))
    .reduce(
      (total, next) => ({
        errors: total.errors + next.errors,
        failures: total.failures + next.failures,
        tests: total.tests + next.tests,
      }),
      { errors: 0, failures: 0, tests: 0 },
    )
  const evidenceRef = files[0]?.ref
  if (totals.errors > 0 || totals.failures > 0) {
    return { evidenceRef, reason: `JUnit XML verification failures observed (${totals.failures} failures, ${totals.errors} errors)`, verification: "failed" }
  }
  if (totals.tests > 0) {
    return { evidenceRef, reason: `JUnit XML verification success evidence observed (${totals.tests} tests)`, verification: "passed" }
  }
  return { evidenceRef, reason: "JUnit XML verification evidence is present but contains no tests", verification: "unknown" }
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

function parseJUnitTestCases(xmlText: string, ref: string): readonly JunitTestCase[] {
  const nestedCases = [...xmlText.matchAll(/<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g)].map((match) =>
    parseJUnitTestCase(match[1] ?? "", match[2] ?? "", ref)
  )
  const selfClosingCases = [...xmlText.matchAll(/<testcase\b([^>]*)\/>/g)].map((match) => parseJUnitTestCase(match[1] ?? "", "", ref))
  return [...nestedCases, ...selfClosingCases]
}

function parseJUnitTestCase(attributeText: string, body: string, ref: string): JunitTestCase {
  const classname = parseJUnitString(attributeText, "classname")
  const name = parseJUnitString(attributeText, "name")
  const fallbackName = name.length > 0 ? name : "unnamed"
  const testId = classname.length > 0 ? `${classname}#${fallbackName}` : fallbackName
  return {
    classname,
    name: fallbackName,
    outcome: body.includes("<failure") ? "failure" : body.includes("<error") ? "error" : "passed",
    ref,
    testId,
  }
}

function parseJUnitInteger(attributeText: string, name: string): number {
  const match = attributeText.match(new RegExp(`\\b${name}="(\\d+)"`))
  return match?.[1] === undefined ? 0 : Number.parseInt(match[1], 10)
}

function parseJUnitString(attributeText: string, name: string): string {
  const match = attributeText.match(new RegExp(`\\b${name}="([^"]*)"`))
  return match?.[1] === undefined ? "" : decodeXmlAttribute(match[1])
}

function decodeXmlAttribute(value: string): string {
  return value
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
}

function outputReason(output: string): string {
  const firstLine = output.split(/\r?\n/u).find((line) => line.trim().length > 0)
  if (firstLine === undefined) {
    return ""
  }
  const trimmed = firstLine.trim()
  return trimmed.length <= 256
    ? `: ${trimmed}`
    : `: ${trimmed.slice(0, 160)}...[truncated]...${trimmed.slice(-64)}`
}

function processOutcomeReason(
  outcome: ReturnType<typeof runBoundedProcess>["outcome"],
  timeoutMs: number,
): string {
  switch (outcome) {
    case "output-limit":
      return ": bounded output limit reached"
    case "signal":
      return ": process terminated by signal"
    case "spawn-failure":
      return ": process spawn failed"
    case "timeout":
      return `: process timed out after ${timeoutMs}ms`
    case "failed":
    case "passed":
      return ""
    default:
      return assertNever(outcome)
  }
}

function assertNever(value: never): never {
  throw new TypeError(`Unknown bounded process outcome: ${String(value)}`)
}
