export const SYNTHETIC_PROBLEM_SET_SCHEMA: "persona-synthetic-ai-problem-set.1"
export const SYNTHETIC_ANSWER_KEY_SCHEMA: "persona-synthetic-ai-answer-key.1"
export const SYNTHETIC_JUDGE_PACKAGE_SCHEMA: "persona-synthetic-ai-judge-package.1"
export const SYNTHETIC_CLAIM_SCOPE: "synthetic-reliability-only"
export const SYNTHETIC_PARTICIPANT_KIND: "synthetic-ai"

export type SyntheticTask = {
  readonly fixtureId: string
  readonly sha256: string
  readonly text: string
}

export type SyntheticProblemCase = {
  readonly caseId: string
  readonly participantKind: "synthetic-ai"
  readonly operatorProfile: string
  readonly operatorInstruction: string
}

export type SyntheticProblemSet = {
  readonly schemaVersion: "persona-synthetic-ai-problem-set.1"
  readonly participantKind: "synthetic-ai"
  readonly claimScope: "synthetic-reliability-only"
  readonly notHumanFeedback: true
  readonly model: { readonly id: string; readonly version: string }
  readonly platform: string
  readonly task: SyntheticTask
  readonly cases: readonly SyntheticProblemCase[]
}

export type SyntheticAnswerKeyCase = {
  readonly caseId: string
  readonly conditionId: string
  readonly repetition: number
  readonly expectedOutcome: Readonly<Record<string, string>>
}

export type SyntheticAnswerKey = {
  readonly schemaVersion: "persona-synthetic-ai-answer-key.1"
  readonly keyScope: string
  readonly problemSetDigest: string
  readonly cases: readonly SyntheticAnswerKeyCase[]
}

export type SyntheticBenchmark = {
  readonly problemSet: SyntheticProblemSet
  readonly problemSetDigest: string
  readonly sealedAnswerKey: SyntheticAnswerKey
}

export type OnOffEvalRun = {
  readonly fixtureId: string
  readonly conditionId: string
  readonly repetition: number
  readonly fixtureHash: string
  readonly syntheticCase: {
    readonly caseId: string
    readonly operatorProfile: string
    readonly instructionSha256: string
  }
  readonly outcomes?: {
    readonly compileBuildOutcome?: string
    readonly gradleTestOutcome?: string
    readonly runtimeSmokeOutcome?: string
  }
  readonly metrics?: {
    readonly stackAlignmentScore?: number
    readonly externalFailureModeLabels?: readonly string[]
  }
}

export type OnOffEvalResults = {
  readonly schemaVersion: string
  readonly model: { readonly id: string; readonly version: string | null }
  readonly environment: { readonly platform: string; readonly os: { readonly arch: string } }
  readonly runs: readonly OnOffEvalRun[]
}

export type SyntheticJudgePackage = {
  readonly schemaVersion: "persona-synthetic-ai-judge-package.1"
  readonly participantKind: "synthetic-ai"
  readonly claimScope: "synthetic-reliability-only"
  readonly notHumanFeedback: true
  readonly task: SyntheticTask
  readonly rubric: Readonly<Record<string, unknown>>
  readonly cases: readonly {
    readonly anonymousId: string
    readonly participantKind: "synthetic-ai"
    readonly observed: {
      readonly build: string
      readonly test: string
      readonly runtime: string
      readonly stackAlignment: number | null
      readonly failureModeCount: number
    }
  }[]
}

export function createSyntheticBenchmark(input: {
  readonly fixtureId: string
  readonly fixtureText: string
  readonly model: string
  readonly modelVersion: string
  readonly platform: string
}): SyntheticBenchmark

export function writeSyntheticBenchmark(root: string, benchmark: SyntheticBenchmark): {
  readonly outputRoot: string
  readonly problemSetPath: string
  readonly answerKeyPath: string
  readonly executionPlanPath: string
  readonly rubricPath: string
  readonly manifestPath: string
}

export function createJudgePackage(
  benchmark: SyntheticBenchmark,
  evalResults: OnOffEvalResults,
  seed?: string,
): SyntheticJudgePackage

export function validateSyntheticReport(report: {
  readonly participantKind: string
  readonly notHumanFeedback: boolean
  readonly claimScope: string
  readonly title?: string
  readonly summary?: string
  readonly claims?: readonly string[]
}): true
