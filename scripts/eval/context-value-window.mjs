const DIGEST = /^[0-9a-f]{64}$/u
const MATCHED_FIELDS = [
  "valueContractDigest", "startRepositoryDigest", "requirementsDigest", "profileDigest",
  "decisionsDigest", "settingsDigest", "hostVersion", "cacheCondition",
]
const DIGEST_FIELDS = ["artifactDigest", ...MATCHED_FIELDS.filter((field) => field.endsWith("Digest"))]

// Offline arithmetic only: supplied observations require separate source-evidence verification.
export function evaluateContextValueWindow(input) {
  const reasons = new Set()
  const pairs = isRecord(input) && Array.isArray(input.pairs) ? input.pairs : []
  const inconclusive = () => ({
    status: "inconclusive", numericalVerdict: "INCONCLUSIVE", productVerdict: "UNVERIFIED",
    pairs: pairs.length, reasons: [...reasons].sort(),
  })
  if (!isRecord(input) || input.protocol !== "context-value-window.1"
    || !["codex", "claude"].includes(input.host) || !digest(input.registrationDigest)
    || !Array.isArray(input.scenarios) || input.scenarios.length !== 3
    || input.scenarios.some((name) => typeof name !== "string" || !/^[a-z][a-z0-9-]{0,79}$/u.test(name))
    || new Set(input.scenarios).size !== 3 || pairs.length !== 6) {
    reasons.add("window-invalid")
    return inconclusive()
  }
  const keys = new Set()
  const orders = new Map(input.scenarios.map((scenario) => [scenario, new Set()]))
  const artifactsA = new Set()
  const artifactsB = new Set()
  const settings = new Set()
  const versions = new Set()
  const contracts = new Set()
  for (const pair of pairs) {
    if (!isRecord(pair) || !input.scenarios.includes(pair.scenario)
      || ![1, 2].includes(pair.repetition) || !["AB", "BA"].includes(pair.order)
      || !isRecord(pair.a) || !isRecord(pair.b)) {
      reasons.add("pair-invalid")
      continue
    }
    const key = `${pair.scenario}:${pair.repetition}`
    if (keys.has(key)) reasons.add("pair-duplicate")
    keys.add(key)
    orders.get(pair.scenario).add(pair.order)
    for (const run of [pair.a, pair.b]) {
      inspectRun(run, reasons)
      settings.add(run.settingsDigest)
      versions.add(run.hostVersion)
      contracts.add(run.valueContractDigest)
    }
    artifactsA.add(pair.a.artifactDigest)
    artifactsB.add(pair.b.artifactDigest)
    if (MATCHED_FIELDS.some((field) => pair.a[field] !== pair.b[field])) reasons.add("pair-input-mismatch")
  }
  if ([...orders.values()].some((values) => values.size !== 2)) reasons.add("order-unbalanced")
  if ([artifactsA, artifactsB, settings, versions, contracts].some((values) => values.size !== 1)) reasons.add("window-not-frozen")
  if (reasons.size > 0) return inconclusive()

  const medians = {
    harnessA: median(pairs.map((pair) => pair.a.harnessTokens)),
    harnessB: median(pairs.map((pair) => pair.b.harnessTokens)),
    taskA: median(pairs.map((pair) => pair.a.taskTokens)),
    taskB: median(pairs.map((pair) => pair.b.taskTokens)),
  }
  if (medians.harnessA === 0) {
    reasons.add("baseline-harness-zero")
    return inconclusive()
  }
  const nonIncreasingPairs = pairs.filter((pair) => pair.b.taskTokens <= pair.a.taskTokens).length
  const meetsCriteria = medians.harnessB <= medians.harnessA * 0.9
    && medians.taskB <= medians.taskA && nonIncreasingPairs >= 4
  return {
    status: "ready", host: input.host, registrationDigest: input.registrationDigest,
    numericalVerdict: meetsCriteria ? "MEETS_CRITERIA" : "NOT_IMPROVED",
    productVerdict: "UNVERIFIED", pairs: 6, medians, nonIncreasingPairs,
    harnessReductionPercent: (medians.harnessA - medians.harnessB) / medians.harnessA * 100,
  }
}

function inspectRun(run, reasons) {
  if (DIGEST_FIELDS.some((field) => !digest(run[field]))
    || typeof run.hostVersion !== "string" || run.hostVersion.length === 0 || run.hostVersion.length > 128
    || !["cold", "warm", "disabled"].includes(run.cacheCondition)) reasons.add("run-binding-invalid")
  if (run.outcome !== "completed") reasons.add("run-incomplete")
  if (run.profileActive !== true || run.contextActive !== true) reasons.add("personalization-inactive")
  if (run.requiredMeaningPreserved !== true || run.majorQualityRegression !== false) reasons.add("value-unverified-or-lost")
  if (run.accountingComplete !== true || run.usageBasis !== "provider-task-total"
    || run.harnessBasis !== "observed-delivered-tokens") reasons.add("usage-unverified")
  if (![run.harnessTokens, run.taskTokens].every((value) => Number.isSafeInteger(value) && value >= 0)
    || run.taskTokens === 0 || run.harnessTokens > run.taskTokens) reasons.add("usage-invalid")
  if (run.harnessTokens === 0 && !["already-present", "no-relevant-rules"].includes(run.zeroInjectionReason)) reasons.add("zero-injection-unexplained")
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[2] / 2 + sorted[3] / 2
}

function digest(value) {
  return typeof value === "string" && DIGEST.test(value)
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
