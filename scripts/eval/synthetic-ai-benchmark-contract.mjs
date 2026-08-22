import { createHash } from "node:crypto"

export const SYNTHETIC_PROBLEM_SET_SCHEMA = "persona-synthetic-ai-problem-set.1"
export const SYNTHETIC_ANSWER_KEY_SCHEMA = "persona-synthetic-ai-answer-key.1"
export const SYNTHETIC_JUDGE_PACKAGE_SCHEMA = "persona-synthetic-ai-judge-package.1"
export const SYNTHETIC_CLAIM_SCOPE = "synthetic-reliability-only"
export const SYNTHETIC_PARTICIPANT_KIND = "synthetic-ai"
export const SYNTHETIC_CASE_COUNT = 10

const FORBIDDEN_CLAIM_TERMS = [
  "human feedback",
  "user review",
  "testimonial",
  "independent review",
  "contest participant",
  "실사용자 후기",
  "사용자 리뷰",
  "독립 인간 검토",
]

export function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex")
}

export function requiredText(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name} is required`)
  return value
}

export function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function requireProblemSet(value) {
  if (
    !isRecord(value) ||
    value.schemaVersion !== SYNTHETIC_PROBLEM_SET_SCHEMA ||
    value.participantKind !== SYNTHETIC_PARTICIPANT_KIND ||
    value.claimScope !== SYNTHETIC_CLAIM_SCOPE ||
    value.notHumanFeedback !== true ||
    !validTask(value.task) ||
    !validModel(value.model) ||
    typeof value.platform !== "string" ||
    value.platform.trim() === "" ||
    !Array.isArray(value.cases) ||
    value.cases.length !== SYNTHETIC_CASE_COUNT ||
    !value.cases.every(validPublicCase) ||
    hasDuplicates(value.cases.map((entry) => entry.caseId))
  ) {
    throw new Error("invalid synthetic problem set")
  }
  return value
}

export function requireAnswerKey(value) {
  if (
    !isRecord(value) ||
    value.schemaVersion !== SYNTHETIC_ANSWER_KEY_SCHEMA ||
    value.keyScope !== "local-input-exclusion-only" ||
    typeof value.problemSetDigest !== "string" ||
    value.problemSetDigest.length !== 64 ||
    !Array.isArray(value.cases) ||
    value.cases.length !== SYNTHETIC_CASE_COUNT ||
    !value.cases.every(validAnswerKeyCase) ||
    !validAnswerKeyDistribution(value.cases)
  ) {
    throw new Error("invalid synthetic answer key")
  }
  return value
}

export function validateSyntheticReport(report) {
  if (!isRecord(report)) throw new Error("report must be an object")
  if (report.participantKind !== SYNTHETIC_PARTICIPANT_KIND) {
    throw new Error("participantKind must be synthetic-ai")
  }
  if (report.notHumanFeedback !== true) {
    throw new Error("notHumanFeedback must be true")
  }
  if (report.claimScope !== SYNTHETIC_CLAIM_SCOPE) {
    throw new Error("claimScope must be synthetic-reliability-only")
  }
  const claimText = reportText(report).toLowerCase()
  const forbidden = FORBIDDEN_CLAIM_TERMS.find((term) => claimText.includes(term))
  if (forbidden) throw new Error(`synthetic report contains forbidden claim: ${forbidden}`)
  return true
}

function validTask(value) {
  return (
    isRecord(value) &&
    typeof value.fixtureId === "string" &&
    value.fixtureId.trim() !== "" &&
    typeof value.sha256 === "string" &&
    value.sha256.length === 64 &&
    typeof value.text === "string" &&
    value.text.trim() !== ""
  )
}

function validModel(value) {
  return isRecord(value) && typeof value.id === "string" && value.id.trim() !== "" && typeof value.version === "string" && value.version.trim() !== ""
}

function validPublicCase(value) {
  return (
    isRecord(value) &&
    !Object.hasOwn(value, "conditionId") &&
    typeof value.caseId === "string" &&
    value.caseId.trim() !== "" &&
    value.participantKind === SYNTHETIC_PARTICIPANT_KIND &&
    typeof value.operatorProfile === "string" &&
    value.operatorProfile.trim() !== "" &&
    typeof value.operatorInstruction === "string" &&
    value.operatorInstruction.trim() !== ""
  )
}

function validAnswerKeyCase(value) {
  return (
    isRecord(value) &&
    typeof value.caseId === "string" &&
    value.caseId.trim() !== "" &&
    (value.conditionId === "plain" || value.conditionId === "ph-on") &&
    Number.isInteger(value.repetition) &&
    value.repetition > 0 &&
    isRecord(value.expectedOutcome)
  )
}

function hasDuplicates(values) {
  return new Set(values).size !== values.length
}

function validAnswerKeyDistribution(cases) {
  const plain = cases.filter((entry) => entry.conditionId === "plain")
  const phOn = cases.filter((entry) => entry.conditionId === "ph-on")
  return (
    plain.length === SYNTHETIC_CASE_COUNT / 2 &&
    phOn.length === SYNTHETIC_CASE_COUNT / 2 &&
    !hasDuplicates(cases.map((entry) => entry.caseId)) &&
    !hasDuplicates(cases.map((entry) => `${entry.conditionId}:${entry.repetition}`))
  )
}

function reportText(report) {
  const values = [report.title, report.summary, ...(Array.isArray(report.claims) ? report.claims : [])]
  return values.filter((value) => typeof value === "string").join("\n")
}
