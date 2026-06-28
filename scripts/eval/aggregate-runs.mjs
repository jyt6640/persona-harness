#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, join, relative, resolve } from "node:path"

const DEFAULT_EVAL_ROOT = "experiments/eval-runs"
const DEFAULT_SIGNAL_ROOT = "experiments/eval-signal"
const GENERATED_TOOLCHAIN_SCORER = "generated-toolchain-v1"
const SOURCE_EXTENSIONS = new Set([".java", ".py", ".ts", ".tsx", ".js"])
const EXCLUDED_SOURCE_PARTS = new Set(["node_modules", ".gradle", "build", ".opencode", "vendor", "cache"])
const BULKY_CAPTURE_DIRS = ["raw", "workspaces", "logs"]
const CONDITIONS = ["plain", "claude", "agents", "ph-on"]

export function parseAggregateArgs(argv) {
  const options = {
    evalRoot: DEFAULT_EVAL_ROOT,
    signalRoot: DEFAULT_SIGNAL_ROOT,
    preserveSignal: true,
    pruneCaptures: false,
    projectDir: process.cwd(),
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--eval-root") options.evalRoot = argv[++index]
    else if (arg === "--signal-root") options.signalRoot = argv[++index]
    else if (arg === "--no-preserve-signal") options.preserveSignal = false
    else if (arg === "--prune-captures") options.pruneCaptures = true
    else if (arg === "--project-dir") options.projectDir = argv[++index]
    else if (arg === "--help") {
      options.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return options
}

export function findResultFiles(evalRoot) {
  if (!existsSync(evalRoot)) return []
  return readdirSync(evalRoot)
    .map((entry) => join(evalRoot, entry, "results.json"))
    .filter((path) => existsSync(path))
    .sort()
}

export function aggregateEvalRuns(options) {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const evalRoot = resolve(projectDir, options.evalRoot ?? DEFAULT_EVAL_ROOT)
  const signalRoot = resolve(projectDir, options.signalRoot ?? DEFAULT_SIGNAL_ROOT)
  const loaded = findResultFiles(evalRoot).map((path) => loadResult(path))
  const originals = loaded.filter((entry) => entry.kind === "original")
  const aggregate = buildAggregate(originals, loaded)
  mkdirSync(signalRoot, { recursive: true })
  writeFileSync(join(signalRoot, "aggregate.json"), `${JSON.stringify(aggregate, null, 2)}\n`)
  if (options.preserveSignal !== false) {
    preserveSignalArtifacts(originals, signalRoot)
  }
  if (options.pruneCaptures) {
    pruneCaptureArtifacts(originals)
  }
  return { aggregate, originals, loaded, signalRoot }
}

function loadResult(path) {
  const result = JSON.parse(readFileSync(path, "utf8"))
  return {
    path,
    runDir: dirname(path),
    runDirName: basename(dirname(path)),
    result,
    kind: classifyResult(result),
  }
}

function classifyResult(result) {
  if (result?.replayOf || result?.installSource === "replay") return "replay"
  if (Array.isArray(result?.runs)) return "original"
  return "unknown"
}

function buildAggregate(originals, loaded) {
  const originalRuns = originals.flatMap((entry) =>
    entry.result.runs.map((run) => ({
      ...run,
      resultPath: entry.path,
      resultRunDirName: entry.runDirName,
      resultToolchainScoringVersion: entry.result.toolchainScoringVersion ?? null,
    })),
  )
  const byCondition = CONDITIONS.map((conditionId) => summarizeCondition(originalRuns.filter((run) => run.conditionId === conditionId)))
  return {
    schemaVersion: "persona-eval-signal.1",
    resultCounts: {
      total: loaded.length,
      original: originals.length,
      replay: loaded.filter((entry) => entry.kind === "replay").length,
      unknown: loaded.filter((entry) => entry.kind === "unknown").length,
    },
    originalRunCount: originalRuns.length,
    historicalToolchainConfounded: {
      resultCount: originals.filter((entry) => entry.result.toolchainScoringVersion !== GENERATED_TOOLCHAIN_SCORER).length,
      runCount: originalRuns.filter((run) => run.resultToolchainScoringVersion !== GENERATED_TOOLCHAIN_SCORER).length,
    },
    byCondition,
    deconfounded: buildDeconfounded(byCondition),
  }
}

function summarizeCondition(runs) {
  const compileValues = knownBooleans(runs.map((run) => run.metrics?.compileBuildPass))
  const testValues = knownBooleans(runs.map((run) => run.metrics?.gradleTestPass))
  const runtimeValues = knownBooleans(runs.map((run) => run.metrics?.runtimeSmokePass))
  const workflowValues = knownBooleans(runs.map((run) => run.metrics?.workflowFinishOutcome === "PASS"))
  const stackValues = runs.map((run) => stackAlignmentRate(run)).filter((value) => typeof value === "number")
  return {
    conditionId: runs[0]?.conditionId ?? null,
    runs: runs.length,
    compileBuildKnown: compileValues.length,
    compileBuildRate: rate(compileValues.filter(Boolean).length, compileValues.length),
    testKnown: testValues.length,
    testRate: rate(testValues.filter(Boolean).length, testValues.length),
    runtimeSmokeKnown: runtimeValues.length,
    runtimeSmokeRate: rate(runtimeValues.filter(Boolean).length, runtimeValues.length),
    workflowFinishKnown: workflowValues.length,
    workflowFinishRate: rate(workflowValues.filter(Boolean).length, workflowValues.length),
    stackAlignmentKnown: stackValues.length,
    stackAlignmentRate: average(stackValues),
    externalFailureModeTotal: runs.reduce((sum, run) => sum + (run.metrics?.externalFailureModeCount ?? 0), 0),
    operationalFailureModeTotal: runs.reduce((sum, run) => sum + (run.metrics?.operationalFailureModeCount ?? 0), 0),
    historicalToolchainConfoundedRuns: runs.filter((run) => run.resultToolchainScoringVersion !== GENERATED_TOOLCHAIN_SCORER).length,
  }
}

function buildDeconfounded(byCondition) {
  return Object.fromEntries(
    ["runtimeSmokeRate", "stackAlignmentRate", "workflowFinishRate"].map((metric) => {
      const ph = byCondition.find((row) => row.conditionId === "ph-on")?.[metric] ?? null
      const plain = byCondition.find((row) => row.conditionId === "plain")?.[metric] ?? null
      const baselines = byCondition
        .filter((row) => row.conditionId !== "ph-on" && row[metric] !== null)
        .sort((left, right) => right[metric] - left[metric] || String(left.conditionId).localeCompare(String(right.conditionId)))
      const strongest = baselines[0] ?? null
      return [
        metric,
        {
          phOn: ph,
          plain,
          strongestBaseline: strongest ? strongest[metric] : null,
          phMinusPlain: ph === null || plain === null ? null : ph - plain,
          phMinusStrongest: ph === null || !strongest ? null : ph - strongest[metric],
        },
      ]
    }),
  )
}

function knownBooleans(values) {
  return values.filter((value) => value === true || value === false)
}

function stackAlignmentRate(run) {
  if (typeof run.metrics?.stackAlignmentRate === "number") return run.metrics.stackAlignmentRate
  if (run.metrics?.stackAlignmentScore === 2) return 1
  if (run.metrics?.stackAlignmentScore === 1) return 0.5
  if (run.metrics?.stackAlignmentScore === 0) return 0
  return null
}

function rate(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator
}

function average(values) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
}

function preserveSignalArtifacts(originals, signalRoot) {
  for (const entry of originals) {
    const runSignalRoot = join(signalRoot, "runs", safeSegment(entry.runDirName))
    mkdirSync(runSignalRoot, { recursive: true })
    copyFileSync(entry.path, join(runSignalRoot, "results.json"))
    for (const run of entry.result.runs) {
      preserveRunSources(run, runSignalRoot)
    }
  }
}

function preserveRunSources(run, runSignalRoot) {
  const workspaceDir = run.workspaceDir
  if (!workspaceDir || !existsSync(workspaceDir)) return
  const sourceRoot = join(
    runSignalRoot,
    "sources",
    safeSegment(`${run.fixtureId ?? "unknown"}-${run.conditionId ?? "unknown"}-r${run.repetition ?? "0"}`),
  )
  for (const file of listFiles(workspaceDir)) {
    if (!isPreservedSource(file)) continue
    const destination = join(sourceRoot, file)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(join(workspaceDir, file), destination)
  }
}

function isPreservedSource(file) {
  const normalized = file.replaceAll("\\", "/")
  const parts = normalized.split("/")
  if (parts.some((part) => EXCLUDED_SOURCE_PARTS.has(part))) return false
  return SOURCE_EXTENSIONS.has(normalized.match(/\.[^.]+$/)?.[0] ?? "")
}

function pruneCaptureArtifacts(originals) {
  for (const entry of originals) {
    for (const dirName of BULKY_CAPTURE_DIRS) {
      rmSync(join(entry.runDir, dirName), { recursive: true, force: true })
    }
  }
}

function listFiles(rootDir) {
  if (!existsSync(rootDir)) return []
  const result = []
  const stack = [rootDir]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        if (EXCLUDED_SOURCE_PARTS.has(entry.name)) continue
        stack.push(fullPath)
      } else if (entry.isFile()) {
        result.push(relative(rootDir, fullPath))
      }
    }
  }
  return result.sort()
}

function safeSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "_")
}

export function formatAggregateTable(aggregate) {
  const lines = ["condition,runs,compileBuildRate,testRate,runtimeSmokeRate,stackAlignmentRate,workflowFinishRate,externalFailures,operationalFailures"]
  for (const row of aggregate.byCondition) {
    lines.push(
      [
        row.conditionId,
        row.runs,
        formatNumber(row.compileBuildRate),
        formatNumber(row.testRate),
        formatNumber(row.runtimeSmokeRate),
        formatNumber(row.stackAlignmentRate),
        formatNumber(row.workflowFinishRate),
        row.externalFailureModeTotal,
        row.operationalFailureModeTotal,
      ].join(","),
    )
  }
  return lines.join("\n")
}

function formatNumber(value) {
  return value === null || value === undefined ? "null" : Number(value).toFixed(3)
}

function printHelp() {
  console.log(`Usage: node scripts/eval/aggregate-runs.mjs [options]

Options:
  --eval-root <dir>        Default: experiments/eval-runs
  --signal-root <dir>      Default: experiments/eval-signal
  --no-preserve-signal     Only write aggregate.json
  --prune-captures         Remove raw/workspaces/logs after signal copy
`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseAggregateArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
  } else {
    const { aggregate } = aggregateEvalRuns(options)
    console.log(formatAggregateTable(aggregate))
  }
}
