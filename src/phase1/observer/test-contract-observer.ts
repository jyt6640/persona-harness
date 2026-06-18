import {
  collectJavaStringLiterals,
  getJavaFileName,
  hasJavaClassOrRecord,
  stripJavaComments,
  unique,
} from "./java-source.js"
import { checkStep1Anchors, checkStep23Anchors } from "./test-contract-anchor-matchers.js"
import type { AnchorCheck } from "./test-contract-anchor-matchers.js"

export type TestContractScenario = "step1" | "step2-3"

export type TestContractFinding = "PASS" | "INFO" | "WARN" | "UNKNOWN"

export type TestContractConfidence = "HIGH" | "MEDIUM" | "LOW"

export type TestContractEvidence = {
  readonly presentAnchors: readonly string[]
  readonly missingAnchors: readonly string[]
  readonly evidence: readonly string[]
}

export type TestContractObservation = {
  readonly scenario: TestContractScenario
  readonly finding: TestContractFinding
  readonly confidence?: TestContractConfidence
  readonly evidence: TestContractEvidence
  readonly limitations: readonly string[]
}

export type ObserveTestContractAnchorsInput = {
  readonly filePath: string
  readonly scenario: TestContractScenario
  readonly source: string
}

const STRING_BASED_LIMITATION =
  "String-based report-only observation; false positives or false negatives remain possible for helper methods, constants, custom DSLs, and unusual Java formatting."

const WARN_LIMITATION = "WARN is a missing-anchor report-only signal, not a test-quality verdict."

export function observeTestContractAnchors(input: ObserveTestContractAnchorsInput): TestContractObservation {
  const fileName = getJavaFileName(input.filePath)
  if (!isGeneratedJavaTestFile(fileName)) {
    return unknownObservation(input.scenario, "Target is not a Java/Spring generated test file.")
  }

  const className = fileName.replace(/\.java$/, "")
  const sourceWithoutComments = stripJavaComments(input.source)
  if (!hasJavaClassOrRecord(sourceWithoutComments, className)) {
    return unknownObservation(input.scenario, "Java test class or record was not recognized.")
  }

  const literals = unique(collectJavaStringLiterals(sourceWithoutComments).map(normalizeLiteral))
  const checks = input.scenario === "step1"
    ? checkStep1Anchors(sourceWithoutComments, literals)
    : checkStep23Anchors(sourceWithoutComments, literals)
  const presentChecks = checks.filter((check) => check.present)
  const missingAnchors = checks
    .filter((check) => !check.present)
    .map((check) => check.missingAnchor ?? check.anchor)
  const evidence = {
    presentAnchors: unique(presentChecks.map((check) => check.anchor)),
    missingAnchors: unique(missingAnchors),
    evidence: unique(presentChecks.flatMap((check) => check.evidence)),
  } satisfies TestContractEvidence

  if (evidence.missingAnchors.length > 0) {
    return observation(input.scenario, "WARN", strongestConfidence(presentChecks) ?? "LOW", evidence, [WARN_LIMITATION])
  }
  if (evidence.presentAnchors.length === 0) {
    return observation(input.scenario, "INFO", "LOW", evidence)
  }
  return observation(input.scenario, "PASS", weakestConfidence(presentChecks), evidence)
}

function observation(
  scenario: TestContractScenario,
  finding: TestContractFinding,
  confidence: TestContractConfidence | undefined,
  evidence: TestContractEvidence,
  extraLimitations: readonly string[] = [],
): TestContractObservation {
  return {
    scenario,
    finding,
    ...(confidence === undefined ? {} : { confidence }),
    evidence,
    limitations: [STRING_BASED_LIMITATION, ...extraLimitations],
  }
}

function unknownObservation(scenario: TestContractScenario, reason: string): TestContractObservation {
  return observation(scenario, "UNKNOWN", undefined, { presentAnchors: [], missingAnchors: [], evidence: [] }, [reason])
}

function weakestConfidence(checks: readonly AnchorCheck[]): TestContractConfidence {
  if (checks.some((check) => check.confidence === "LOW")) return "LOW"
  if (checks.some((check) => check.confidence === "MEDIUM")) return "MEDIUM"
  return "HIGH"
}

function strongestConfidence(checks: readonly AnchorCheck[]): TestContractConfidence | undefined {
  if (checks.some((check) => check.confidence === "HIGH")) return "HIGH"
  if (checks.some((check) => check.confidence === "MEDIUM")) return "MEDIUM"
  if (checks.some((check) => check.confidence === "LOW")) return "LOW"
  return undefined
}

function isGeneratedJavaTestFile(fileName: string): boolean {
  return /(?:Test|Tests|IntegrationTest)\.java$/.test(fileName)
}

function normalizeLiteral(literal: string): string {
  return literal.replace(/\s+/g, " ").trim()
}
