import { mkdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import {
  SYNTHETIC_ANSWER_KEY_SCHEMA,
  SYNTHETIC_CASE_COUNT,
  SYNTHETIC_CLAIM_SCOPE,
  SYNTHETIC_JUDGE_PACKAGE_SCHEMA,
  SYNTHETIC_PARTICIPANT_KIND,
  SYNTHETIC_PROBLEM_SET_SCHEMA,
  requiredText,
  requireAnswerKey,
  requireProblemSet,
  sha256Text,
  validateSyntheticReport,
} from "./synthetic-ai-benchmark-contract.mjs"
import { createJudgePackage as buildJudgePackage, judgeRubric } from "./synthetic-ai-benchmark-judge.mjs"

export {
  SYNTHETIC_ANSWER_KEY_SCHEMA,
  SYNTHETIC_CLAIM_SCOPE,
  SYNTHETIC_JUDGE_PACKAGE_SCHEMA,
  SYNTHETIC_PARTICIPANT_KIND,
  SYNTHETIC_PROBLEM_SET_SCHEMA,
  validateSyntheticReport,
}

const OPERATOR_PROFILES = [
  { id: "requirements-first", instruction: "Prioritize acceptance criteria before implementation details." },
  { id: "api-contract-first", instruction: "Make the externally visible API contract explicit before implementation details." },
  { id: "domain-first", instruction: "Keep the domain model and application boundaries explicit while implementing the fixture." },
  { id: "test-first", instruction: "Prioritize focused automated tests that demonstrate the requested behavior." },
  { id: "failure-mode-first", instruction: "Prioritize explicit failure modes and actionable validation behavior." },
]
export function createSyntheticBenchmark(input) {
  const fixtureId = requiredText(input?.fixtureId, "fixtureId")
  const fixtureText = requiredText(input?.fixtureText, "fixtureText")
  const model = requiredText(input?.model, "model")
  const modelVersion = requiredText(input?.modelVersion, "modelVersion")
  const platform = requiredText(input?.platform, "platform")
  const task = {
    fixtureId,
    sha256: sha256Text(fixtureText),
    text: fixtureText,
  }
  const problemSet = {
    schemaVersion: SYNTHETIC_PROBLEM_SET_SCHEMA,
    participantKind: SYNTHETIC_PARTICIPANT_KIND,
    claimScope: SYNTHETIC_CLAIM_SCOPE,
    notHumanFeedback: true,
    model: { id: model, version: modelVersion },
    platform,
    task,
    cases: Array.from({ length: SYNTHETIC_CASE_COUNT }, (_, index) => publicCase(index + 1)),
  }
  const problemSetDigest = sha256Text(JSON.stringify(problemSet))
  const sealedAnswerKey = {
    schemaVersion: SYNTHETIC_ANSWER_KEY_SCHEMA,
    keyScope: "local-input-exclusion-only",
    problemSetDigest,
    cases: Array.from({ length: SYNTHETIC_CASE_COUNT }, (_, index) => sealedCase(task, index + 1)),
  }

  return { problemSet, problemSetDigest, sealedAnswerKey }
}

export function writeSyntheticBenchmark(root, benchmark) {
  const outputRoot = resolve(requiredText(root, "root"))
  const problemSet = requireProblemSet(benchmark?.problemSet)
  const answerKey = requireAnswerKey(benchmark?.sealedAnswerKey)
  const problemSetDigest = sha256Text(JSON.stringify(problemSet))
  if (benchmark?.problemSetDigest !== problemSetDigest || answerKey.problemSetDigest !== problemSetDigest) {
    throw new Error("sealed answer key does not bind the problem set")
  }
  const runPlan = executionPlan(problemSet, answerKey)
  const publicRoot = join(outputRoot, "public")
  const sealedRoot = join(outputRoot, "sealed")
  const judgeRoot = join(outputRoot, "judge")
  mkdirSync(publicRoot, { recursive: true })
  mkdirSync(sealedRoot, { recursive: true })
  mkdirSync(judgeRoot, { recursive: true })

  const problemSetPath = join(publicRoot, "problem-set.json")
  const answerKeyPath = join(sealedRoot, "answer-key.json")
  const rubricPath = join(judgeRoot, "rubric.json")
  const executionPlanPath = join(sealedRoot, "execution-plan.json")
  const manifestPath = join(outputRoot, "benchmark-manifest.json")
  writeJson(problemSetPath, problemSet)
  writeJson(answerKeyPath, answerKey)
  writeJson(executionPlanPath, runPlan)
  writeJson(rubricPath, judgeRubric())
  writeJson(manifestPath, {
    schemaVersion: "persona-synthetic-ai-benchmark-manifest.1",
    participantKind: SYNTHETIC_PARTICIPANT_KIND,
    claimScope: SYNTHETIC_CLAIM_SCOPE,
    notHumanFeedback: true,
    problemSetDigest,
    publicProblemSet: "public/problem-set.json",
    sealedAnswerKey: "sealed/answer-key.json",
    executionPlan: "sealed/execution-plan.json",
    judgeRubric: "judge/rubric.json",
  })
  return { outputRoot, problemSetPath, answerKeyPath, executionPlanPath, rubricPath, manifestPath }
}

export function createJudgePackage(benchmark, evalResults, seed = "persona-synthetic-ai-v1") {
  const problemSet = requireProblemSet(benchmark?.problemSet)
  const answerKey = requireAnswerKey(benchmark?.sealedAnswerKey)
  const problemSetDigest = sha256Text(JSON.stringify(problemSet))
  if (benchmark?.problemSetDigest !== problemSetDigest || answerKey.problemSetDigest !== problemSetDigest) {
    throw new Error("sealed answer key does not bind the problem set")
  }
  return buildJudgePackage(problemSet, answerKey, evalResults, seed)
}

function publicCase(index) {
  const profile = operatorProfile(index)
  return {
    caseId: `synthetic-ai-${String(index).padStart(2, "0")}`,
    participantKind: SYNTHETIC_PARTICIPANT_KIND,
    operatorProfile: profile.id,
    operatorInstruction: profile.instruction,
  }
}

function sealedCase(task, index) {
  return {
    caseId: `synthetic-ai-${String(index).padStart(2, "0")}`,
    conditionId: index <= SYNTHETIC_CASE_COUNT / 2 ? "plain" : "ph-on",
    repetition: ((index - 1) % (SYNTHETIC_CASE_COUNT / 2)) + 1,
    expectedOutcome: expectedOutcome(task.fixtureId),
  }
}

function executionPlan(problemSet, answerKey) {
  const publicCaseById = new Map(problemSet.cases.map((entry) => [entry.caseId, entry]))
  return {
    schemaVersion: "persona-onoff-eval-run-plan.1",
    inputScope: "local-executor-only",
    problemSetDigest: answerKey.problemSetDigest,
    runs: answerKey.cases.map((assignment) => {
      const publicCase = publicCaseById.get(assignment.caseId)
      if (!publicCase) throw new Error(`missing public synthetic case: ${assignment.caseId}`)
      return {
        caseId: assignment.caseId,
        fixtureId: problemSet.task.fixtureId,
        conditionId: assignment.conditionId,
        repetition: assignment.repetition,
        operatorProfile: publicCase.operatorProfile,
        operatorInstruction: publicCase.operatorInstruction,
      }
    }),
  }
}

function operatorProfile(index) {
  return OPERATOR_PROFILES[(index - 1) % OPERATOR_PROFILES.length]
}

function expectedOutcome(fixtureId) {
  const javaSpringGradle = fixtureId === "multi-step-backend" || fixtureId === "multi-step-backend-small"
  return {
    build: "recorded",
    test: "recorded",
    runtime: "recorded",
    stack: javaSpringGradle ? "java" : "any",
    framework: javaSpringGradle ? "spring" : "any",
    buildTool: javaSpringGradle ? "gradle" : "any",
  }
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}
