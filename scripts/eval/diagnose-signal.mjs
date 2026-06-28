#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

const DEFAULT_SIGNAL_ROOT = "experiments/eval-signal"
const WORKFLOW_PROVIDER_LIMITED = "provider-limit-timeout"
const WORKFLOW_PH_DEAD_END = "ph-workflow-dead-end"
const WORKFLOW_AMBIGUOUS = "timeout-ambiguous"
const WORKFLOW_PASS = "pass"

export function diagnoseEvalSignal(options = {}) {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const signalRoot = resolve(projectDir, options.signalRoot ?? DEFAULT_SIGNAL_ROOT)
  const resultFiles = findSignalResultFiles(signalRoot)
  const runs = resultFiles.flatMap((resultPath) => {
    const result = JSON.parse(readFileSync(resultPath, "utf8"))
    return Array.isArray(result.runs) ? result.runs.map((run) => normalizeRun(resultPath, result, run)) : []
  })
  const phOnRuns = runs.filter((run) => run.conditionId === "ph-on")
  const diagnosis = {
    schemaVersion: "persona-eval-signal-diagnosis.1",
    resultFiles: resultFiles.length,
    totalRuns: runs.length,
    phOnRuns: phOnRuns.map(diagnosePhOnRun),
    workflowFinishFailureSummary: summarizeWorkflowFailures(phOnRuns),
    labelBreakdown: {
      byCondition: labelCountsByCondition(runs),
      phOnMinusPlain: labelDelta(runs, "ph-on", "plain"),
    },
  }
  const outputPath = join(signalRoot, "diagnosis.json")
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(diagnosis, null, 2)}\n`)
  return { diagnosis, outputPath }
}

function findSignalResultFiles(signalRoot) {
  const runsDir = join(signalRoot, "runs")
  if (!existsSync(runsDir)) return []
  return readdirSync(runsDir)
    .map((entry) => join(runsDir, entry, "results.json"))
    .filter((path) => existsSync(path))
    .sort()
}

function normalizeRun(resultPath, result, run) {
  const metrics = isObject(run.metrics) ? run.metrics : {}
  const outcomes = isObject(run.outcomes) ? run.outcomes : {}
  const provider = providerCompletion(run, metrics, outcomes)
  return {
    resultPath,
    resultId: result.createdAt ?? resultPath.split("/").at(-2) ?? "unknown",
    fixtureId: run.fixtureId ?? "unknown",
    conditionId: run.conditionId ?? "unknown",
    repetition: run.repetition ?? null,
    workspaceDir: run.workspaceDir ?? null,
    logsDir: run.logsDir ?? null,
    rawOutputPaths: isObject(run.metadata?.rawOutputPaths) ? run.metadata.rawOutputPaths : {},
    workflowFinishOutcome: metrics.workflowFinishOutcome ?? outcomes.workflowFinishOutcome ?? "UNKNOWN",
    externalFailureModeCount: numberOrZero(metrics.externalFailureModeCount),
    operationalFailureModeCount: numberOrZero(metrics.operationalFailureModeCount),
    externalFailureModeLabels: stringArray(metrics.externalFailureModeLabels),
    operationalFailureModeLabels: stringArray(metrics.operationalFailureModeLabels),
    providerToolCompletion: provider,
  }
}

function providerCompletion(run, metrics, outcomes) {
  if (isObject(run.providerToolCompletion)) return run.providerToolCompletion
  if (isObject(outcomes.providerToolCompletion)) return outcomes.providerToolCompletion
  const outcome = typeof metrics.providerToolCompletionOutcome === "string" ? metrics.providerToolCompletionOutcome : null
  const reason = typeof metrics.providerToolCompletionFailureReason === "string" ? metrics.providerToolCompletionFailureReason : null
  if (outcome) return { completionOutcome: outcome, completionFailureReason: reason }
  return { completionOutcome: "UNKNOWN", completionFailureReason: legacyProviderReason(metrics) }
}

function legacyProviderReason(metrics) {
  const labels = stringArray(metrics.externalFailureModeLabels).concat(stringArray(metrics.operationalFailureModeLabels))
  if (labels.some((label) => /provider|timeout|token|context/i.test(label))) return "provider-limit"
  return null
}

function diagnosePhOnRun(run) {
  const classification = classifyWorkflowRun(run)
  return {
    resultId: run.resultId,
    fixtureId: run.fixtureId,
    repetition: run.repetition,
    workflowFinishOutcome: run.workflowFinishOutcome,
    classification,
    providerToolCompletion: run.providerToolCompletion,
    externalFailureModeCount: run.externalFailureModeCount,
    operationalFailureModeCount: run.operationalFailureModeCount,
    externalFailureModeLabels: run.externalFailureModeLabels,
    operationalFailureModeLabels: run.operationalFailureModeLabels,
    evidencePaths: {
      resultPath: run.resultPath,
      workspaceDir: run.workspaceDir,
      logsDir: run.logsDir,
      rawOutputPaths: run.rawOutputPaths,
    },
  }
}

function classifyWorkflowRun(run) {
  if (run.workflowFinishOutcome === "PASS") return WORKFLOW_PASS
  if (providerLimited(run)) return WORKFLOW_PROVIDER_LIMITED
  if (run.externalFailureModeLabels.some((label) => /workflow (?:dead-end|lifecycle failure)/i.test(label))) return WORKFLOW_PH_DEAD_END
  if (run.workflowFinishOutcome === "FAIL" || run.workflowFinishOutcome === "INCOMPLETE") return WORKFLOW_AMBIGUOUS
  return WORKFLOW_AMBIGUOUS
}

function providerLimited(run) {
  const outcome = run.providerToolCompletion?.completionOutcome
  const reason = run.providerToolCompletion?.completionFailureReason
  const labels = run.externalFailureModeLabels.concat(run.operationalFailureModeLabels)
  return (
    outcome === "PROVIDER_LIMITED" ||
    outcome === "TIMED_OUT" ||
    reason === "provider-timeout" ||
    reason === "provider-limit" ||
    labels.some((label) => /provider|timeout|token|context/i.test(label))
  )
}

function summarizeWorkflowFailures(phOnRuns) {
  const counts = { pass: 0, [WORKFLOW_PROVIDER_LIMITED]: 0, [WORKFLOW_PH_DEAD_END]: 0, [WORKFLOW_AMBIGUOUS]: 0 }
  for (const run of phOnRuns) {
    counts[classifyWorkflowRun(run)] += 1
  }
  return counts
}

function labelCountsByCondition(runs) {
  const grouped = {}
  for (const run of runs) {
    grouped[run.conditionId] ??= {}
    for (const label of run.externalFailureModeLabels.concat(run.operationalFailureModeLabels)) {
      grouped[run.conditionId][label] = (grouped[run.conditionId][label] ?? 0) + 1
    }
  }
  return grouped
}

function labelDelta(runs, leftCondition, rightCondition) {
  const counts = labelCountsByCondition(runs)
  const labels = new Set([...Object.keys(counts[leftCondition] ?? {}), ...Object.keys(counts[rightCondition] ?? {})])
  return Object.fromEntries(
    [...labels].sort().map((label) => [label, (counts[leftCondition]?.[label] ?? 0) - (counts[rightCondition]?.[label] ?? 0)]),
  )
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : []
}

function numberOrZero(value) {
  return typeof value === "number" ? value : 0
}

function formatTable(diagnosis) {
  const lines = ["fixture,rep,workflow,classification,externalFailures,operationalFailures,resultId"]
  for (const run of diagnosis.phOnRuns) {
    lines.push(
      [run.fixtureId, run.repetition ?? "", run.workflowFinishOutcome, run.classification, run.externalFailureModeCount, run.operationalFailureModeCount, run.resultId].join(","),
    )
  }
  return lines.join("\n")
}

function parseArgs(argv) {
  const options = { signalRoot: DEFAULT_SIGNAL_ROOT }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--signal-root") options.signalRoot = argv[++index]
    else if (arg === "--help") options.help = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return options
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log("Usage: node scripts/eval/diagnose-signal.mjs [--signal-root <dir>]")
  } else {
    const { diagnosis, outputPath } = diagnoseEvalSignal(options)
    console.log(formatTable(diagnosis))
    console.log(`diagnosis: ${outputPath}`)
  }
}
