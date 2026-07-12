import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { isBlankStringLiteral, methodContainingOffset, parseJavaStructure } from "./java-structure.mjs"

const JUNIT_TEST_ANNOTATIONS = new Set(["org.junit.Test", "org.junit.jupiter.api.Test"])
const PARAMETERIZED_ANNOTATIONS = new Set(["org.junit.jupiter.params.ParameterizedTest"])
const LIFECYCLE_ANNOTATIONS = new Set([
  "org.junit.After",
  "org.junit.Before",
  "org.junit.jupiter.api.AfterEach",
  "org.junit.jupiter.api.AfterAll",
  "org.junit.jupiter.api.BeforeEach",
  "org.junit.jupiter.api.BeforeAll",
])
const DISABLED_ANNOTATIONS = new Set(["org.junit.Ignore", "org.junit.jupiter.api.Disabled"])

export function detectCorpus(corpus, corpusDirectory) {
  const fixtures = new Map()
  const detections = []

  for (const record of corpus.records) {
    const fixture = fixtureForRecord(record, corpusDirectory, fixtures)
    const anchorOffset = fixture.source.indexOf(record.anchor)
    if (anchorOffset === -1) {
      throw new Error(`Missing corpus anchor: ${record.id}`)
    }

    const method = methodContainingOffset(fixture.structure, anchorOffset)
    if (method === undefined) {
      throw new Error(`Corpus anchor is not inside a parsed method: ${record.id}`)
    }

    if (!detectsRule(record.ruleId, method, fixture.structure.tokens)) continue
    detections.push({
      caseId: record.id,
      fixture: record.fixture,
      methodName: method.name,
      ruleId: record.ruleId,
      structuralEvidence: evidenceForRule(record.ruleId),
    })
  }

  return detections
}

export function candidateFromDetections(corpus, detections) {
  return {
    candidateId: "p2-e1-report-only-structural-detector",
    candidateKind: "source-only-structural-report-only",
    corpusId: corpus.corpusId,
    evaluatedCaseIds: corpus.records.map((record) => record.id),
    findings: detections.map((detection) => ({ caseId: detection.caseId, ruleId: detection.ruleId })),
    frozenLabelSetSha256: corpus.mutationPolicy.frozenLabelSetSha256,
    schemaVersion: corpus.evaluationContract.candidateSchemaVersion,
  }
}

function fixtureForRecord(record, corpusDirectory, fixtures) {
  const existing = fixtures.get(record.fixture)
  if (existing !== undefined) return existing

  const source = readFileSync(resolve(corpusDirectory, record.fixture), "utf8")
  const fixture = { source, structure: parseJavaStructure(source) }
  fixtures.set(record.fixture, fixture)
  return fixture
}

function detectsRule(ruleId, method, tokens) {
  if (ruleId === "E1-A1") return detectsAssertionlessTest(method, tokens)
  if (ruleId === "E1-A2") return detectsUndocumentedDisabledTest(method)
  throw new Error(`Unsupported test-integrity rule: ${ruleId}`)
}

function detectsAssertionlessTest(method, tokens) {
  if (!isJUnitTestMethod(method)) return false
  if (hasAnnotation(method, PARAMETERIZED_ANNOTATIONS) || hasAnnotation(method, LIFECYCLE_ANNOTATIONS)) return false
  if (hasVintageExpectedException(method)) return false
  return !containsVerificationCall(tokens, method)
}

function detectsUndocumentedDisabledTest(method) {
  if (!isJUnitTestMethod(method)) return false
  const disabledAnnotation = method.annotations.find((annotation) => DISABLED_ANNOTATIONS.has(annotation.qualifiedName))
  return disabledAnnotation !== undefined && hasMissingReason(disabledAnnotation)
}

function isJUnitTestMethod(method) {
  return hasAnnotation(method, JUNIT_TEST_ANNOTATIONS)
}

function hasAnnotation(method, annotationNames) {
  return method.annotations.some((annotation) => annotationNames.has(annotation.qualifiedName))
}

function hasVintageExpectedException(method) {
  return method.annotations.some(
    (annotation) =>
      annotation.qualifiedName === "org.junit.Test" &&
      annotation.argumentTokens?.some((token) => token.value === "expected") === true,
  )
}

function containsVerificationCall(tokens, method) {
  for (let index = method.bodyOpenIndex + 1; index < method.bodyCloseIndex; index += 1) {
    const token = tokens[index]
    const nextToken = tokens[index + 1]
    if (token.kind !== "identifier" || nextToken?.value !== "(") continue
    if (token.value.startsWith("assert") || token.value === "fail" || token.value === "verify") return true
  }
  return false
}

function hasMissingReason(annotation) {
  const argumentsTokens = annotation.argumentTokens
  if (argumentsTokens === undefined || argumentsTokens.length === 0) return true
  if (argumentsTokens.length === 1) return isBlankStringLiteral(argumentsTokens[0])

  return (
    argumentsTokens.length === 3 &&
    argumentsTokens[0].kind === "identifier" &&
    (argumentsTokens[0].value === "reason" || argumentsTokens[0].value === "value") &&
    argumentsTokens[1].value === "=" &&
    isBlankStringLiteral(argumentsTokens[2])
  )
}

function evidenceForRule(ruleId) {
  if (ruleId === "E1-A1") return "junit-test-without-assertion-or-interaction-verification"
  if (ruleId === "E1-A2") return "junit-disabled-or-ignore-without-usable-reason"
  throw new Error(`Unsupported test-integrity rule: ${ruleId}`)
}
