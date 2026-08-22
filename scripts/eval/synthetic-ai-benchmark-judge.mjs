import { stableAnonymousId } from "./blind-grade-core.mjs"
import {
  SYNTHETIC_CLAIM_SCOPE,
  SYNTHETIC_JUDGE_PACKAGE_SCHEMA,
  SYNTHETIC_PARTICIPANT_KIND,
  isRecord,
  requiredText,
  sha256Text,
} from "./synthetic-ai-benchmark-contract.mjs"

const ALLOWED_OUTCOMES = new Set(["PASS", "FAIL", "NOT RUN", "NOT RUNNABLE", "UNKNOWN", "INCOMPLETE", "NOT APPLICABLE"])

export function createJudgePackage(problemSet, answerKey, evalResults, seed = "persona-synthetic-ai-v1") {
  const runs = requireEvalResults(evalResults, problemSet)
  const runByKey = indexRuns(runs)
  const publicCaseById = new Map(problemSet.cases.map((entry) => [entry.caseId, entry]))
  const cases = answerKey.cases.map((assignment) => {
    const run = runByKey.get(runKey(problemSet.task.fixtureId, assignment.conditionId, assignment.repetition))
    if (!run) throw new Error(`missing eval result for ${assignment.caseId}`)
    if (run.fixtureHash !== problemSet.task.sha256) throw new Error(`fixture hash mismatch for ${assignment.caseId}`)
    requireSyntheticCaseBinding(run, publicCaseById.get(assignment.caseId), assignment.caseId)
    return {
      anonymousId: stableAnonymousId(seed, assignment.caseId),
      participantKind: SYNTHETIC_PARTICIPANT_KIND,
      observed: observedMetrics(run),
    }
  })
  return {
    schemaVersion: SYNTHETIC_JUDGE_PACKAGE_SCHEMA,
    participantKind: SYNTHETIC_PARTICIPANT_KIND,
    claimScope: SYNTHETIC_CLAIM_SCOPE,
    notHumanFeedback: true,
    task: problemSet.task,
    rubric: judgeRubric(),
    cases,
  }
}

export function judgeRubric() {
  return {
    schemaVersion: "persona-synthetic-ai-judge-rubric.1",
    claimScope: SYNTHETIC_CLAIM_SCOPE,
    categories: ["build", "test", "runtime", "stackAlignment", "failureModeCount"],
    outputRequirement: "bounded-synthetic-assessment-only",
  }
}

function requireSyntheticCaseBinding(run, publicCase, caseId) {
  if (!publicCase || !isRecord(run.syntheticCase)) throw new Error(`missing synthetic case binding for ${caseId}`)
  if (run.syntheticCase.caseId !== caseId) throw new Error(`synthetic case mismatch for ${caseId}`)
  if (run.syntheticCase.operatorProfile !== publicCase.operatorProfile) throw new Error(`synthetic profile mismatch for ${caseId}`)
  if (run.syntheticCase.instructionSha256 !== sha256Text(publicCase.operatorInstruction)) {
    throw new Error(`synthetic instruction mismatch for ${caseId}`)
  }
}

function indexRuns(runs) {
  const indexed = new Map()
  for (const run of runs) {
    if (!isRecord(run)) throw new Error("eval result run must be an object")
    const key = runKey(run.fixtureId, run.conditionId, run.repetition)
    if (indexed.has(key)) throw new Error(`duplicate eval result: ${key}`)
    indexed.set(key, run)
  }
  return indexed
}

function requireEvalResults(value, problemSet) {
  if (!isRecord(value) || value.schemaVersion !== "persona-onoff-eval.1" || !Array.isArray(value.runs)) {
    throw new Error("invalid ON/OFF eval results")
  }
  const model = isRecord(value.model) ? value.model : null
  if (model?.id !== problemSet.model.id) throw new Error("model id mismatch")
  if (model.version !== problemSet.model.version) throw new Error("model version mismatch")
  if (evalPlatform(value.environment) !== problemSet.platform) throw new Error("platform mismatch")
  return value.runs
}

function evalPlatform(environment) {
  if (!isRecord(environment) || !isRecord(environment.os)) return ""
  const platform = environment.platform
  const arch = environment.os.arch
  return typeof platform === "string" && typeof arch === "string" ? `${platform}-${arch}` : ""
}

function runKey(fixtureId, conditionId, repetition) {
  return `${requiredText(fixtureId, "fixtureId")}:${requiredText(conditionId, "conditionId")}:${requiredPositiveInteger(repetition, "repetition")}`
}

function observedMetrics(run) {
  const outcomes = isRecord(run?.outcomes) ? run.outcomes : {}
  const metrics = isRecord(run?.metrics) ? run.metrics : {}
  return {
    build: boundedOutcome(outcomes.compileBuildOutcome),
    test: boundedOutcome(outcomes.gradleTestOutcome),
    runtime: boundedOutcome(outcomes.runtimeSmokeOutcome),
    stackAlignment: boundedScore(metrics.stackAlignmentScore),
    failureModeCount: Array.isArray(metrics.externalFailureModeLabels) ? metrics.externalFailureModeLabels.length : 0,
  }
}

function boundedOutcome(value) {
  return typeof value === "string" && ALLOWED_OUTCOMES.has(value) ? value : "UNKNOWN"
}

function boundedScore(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2 ? value : null
}

function requiredPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`)
  return value
}
