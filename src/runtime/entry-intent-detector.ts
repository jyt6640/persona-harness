export type EntryIntentRationale = {
  readonly codeNoun: string | null
  readonly language: "en" | "ko" | "unknown"
  readonly mode: "explicit" | "implicit-attached" | "none"
  readonly verb: string | null
}

export type EntryIntentDecision = {
  readonly detected: boolean
  readonly rationale: EntryIntentRationale
}

export type EntryIntentCorpusRecord = {
  readonly expected: boolean
  readonly projectAttached: boolean
  readonly prompt: string
}

export type EntryIntentThresholds = {
  readonly falseNegativeCost: number
  readonly falsePositiveCost: number
  readonly maximumWeightedErrorRate: number
  readonly minimumPrecision: number
  readonly minimumRecall: number
}

export type EntryIntentMetrics = {
  readonly decision: "fail" | "pass"
  readonly falseNegatives: number
  readonly falsePositives: number
  readonly precision: number
  readonly recall: number
  readonly trueNegatives: number
  readonly truePositives: number
  readonly weightedErrorRate: number
}

const ENGLISH_VERBS = ["implement", "build", "create", "add", "fix", "refactor", "update", "change", "write", "make"] as const
const KOREAN_VERBS = ["구현해줘", "만들어줘", "추가해줘", "고쳐줘", "수정해줘", "리팩터링해줘", "작성해줘"] as const
const ENGLISH_CODE_NOUNS = ["api", "endpoint", "service", "controller", "repository", "feature", "function", "class", "code", "test", "bug", "application", "app", "readme"] as const
const KOREAN_CODE_NOUNS = ["api", "엔드포인트", "서비스", "컨트롤러", "리포지토리", "기능", "함수", "클래스", "코드", "테스트", "버그", "애플리케이션", "앱", "readme", "요구사항"] as const
const EXCLUDED_INTENTS = ["explain", "review", "summarize", "설명", "리뷰", "요약"] as const

function normalizedPrompt(prompt: string): string {
  return prompt.normalize("NFKC").trim().toLowerCase()
}

function firstMatch(text: string, values: readonly string[]): string | null {
  return values.find((value) => text.includes(value)) ?? null
}

function languageOf(text: string): EntryIntentRationale["language"] {
  if (/[가-힣]/u.test(text)) {
    return "ko"
  }
  return /[a-z]/u.test(text) ? "en" : "unknown"
}

function isQuestion(text: string): boolean {
  return text.includes("?") || /(?:뭐야|할까|인가요|나요)$/u.test(text)
}

export function detectEntryIntent(
  prompt: string,
  context: { readonly projectAttached: boolean },
): EntryIntentDecision {
  const text = normalizedPrompt(prompt)
  const language = languageOf(text)
  if (firstMatch(text, EXCLUDED_INTENTS) !== null || isQuestion(text)) {
    return { detected: false, rationale: { codeNoun: null, language, mode: "none", verb: null } }
  }
  const implicit = text === "그냥 해줘" || text === "just do it"
  if (implicit && context.projectAttached) {
    return {
      detected: true,
      rationale: { codeNoun: "attached-project", language, mode: "implicit-attached", verb: language === "ko" ? "해줘" : "do" },
    }
  }
  const verbs = language === "ko" ? KOREAN_VERBS : ENGLISH_VERBS
  const nouns = language === "ko" ? [...KOREAN_CODE_NOUNS, ...ENGLISH_CODE_NOUNS] : ENGLISH_CODE_NOUNS
  const verb = firstMatch(text, verbs)
  const codeNoun = firstMatch(text, nouns)
  return {
    detected: verb !== null && codeNoun !== null,
    rationale: {
      codeNoun,
      language,
      mode: verb !== null && codeNoun !== null ? "explicit" : "none",
      verb,
    },
  }
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}

export function measureEntryIntentCorpus(
  records: readonly EntryIntentCorpusRecord[],
  thresholds: EntryIntentThresholds,
): EntryIntentMetrics {
  let truePositives = 0
  let trueNegatives = 0
  let falsePositives = 0
  let falseNegatives = 0
  for (const record of records) {
    const detected = detectEntryIntent(record.prompt, { projectAttached: record.projectAttached }).detected
    if (record.expected && detected) truePositives += 1
    else if (!record.expected && !detected) trueNegatives += 1
    else if (detected) falsePositives += 1
    else falseNegatives += 1
  }
  const precision = ratio(truePositives, truePositives + falsePositives)
  const recall = ratio(truePositives, truePositives + falseNegatives)
  const weightedErrors = falseNegatives * thresholds.falseNegativeCost + falsePositives * thresholds.falsePositiveCost
  const weightedCapacity = records.length * Math.max(thresholds.falseNegativeCost, thresholds.falsePositiveCost)
  const weightedErrorRate = ratio(weightedErrors, weightedCapacity)
  const passed = precision >= thresholds.minimumPrecision
    && recall >= thresholds.minimumRecall
    && weightedErrorRate <= thresholds.maximumWeightedErrorRate
  return {
    decision: passed ? "pass" : "fail",
    falseNegatives,
    falsePositives,
    precision,
    recall,
    trueNegatives,
    truePositives,
    weightedErrorRate,
  }
}
