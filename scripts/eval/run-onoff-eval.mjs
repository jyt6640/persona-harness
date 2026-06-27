#!/usr/bin/env node
import { aggregateRuns, buildPlan, parseArgs, preflight, runEval } from "./eval-core.mjs"

function usage() {
  return `Usage: node scripts/eval/run-onoff-eval.mjs [options]

Runs Persona Harness ON/OFF evaluation against frozen fixtures.

Options:
  --fixture <id>             Fixture id or all (default: all)
  --condition <id>           plain | claude | agents | ph-on | all (default: all)
  --runs <n>                 Repetitions per fixture/condition (default: 5)
  --concurrency <n>          Max concurrently executing runs (default: 1)
  --model <id>               Required model id for actual/preflight runs
  --model-version <label>    Model version label (default: OPENCODE_MODEL_VERSION or unknown)
  --temperature <value>      Temperature pin (default: OPENCODE_TEMPERATURE or unknown)
  --top-p <value>            top_p pin when supported by the selected CLI surface
  --seed <value>             seed pin when supported by the selected CLI surface
  --opencode-command <cmd>   Command template, supports {model}, {promptFile}, {workspaceDir}, {message}
  --ph-install-command <cmd> Required when --condition ph-on or all includes PH ON
  --runtime-smoke-command <cmd>
  --backend-shape-command <cmd>
  --workflow-finish-command <cmd>
  --timeout-ms <n>           Command timeout in milliseconds (default: 600000)
  --output-root <dir>        Output root (default: experiments/eval-runs)
  --capture                  Store raw workspace/stdout/stderr artifacts under raw/
  --replay <run-dir>         Re-score a captured run without calling the model
  --preflight                Check environment only; writes no results
  --dry-run                  Print selected run plan; writes no results
  --json                     Print JSON for preflight/dry-run
  --help                     Show this help

Preflight failure exits nonzero and creates no results.json.`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }

  const plan = buildPlan(options)
  if (options.dryRun) {
    printPlan(options, plan)
    return
  }

  if (options.preflightOnly) {
    const result = preflight(options, plan)
    if (options.json) {
      console.log(JSON.stringify({ preflight: result, plan }, null, 2))
    } else {
      printPreflight(result)
    }
    process.exitCode = result.ok ? 0 : 1
    return
  }

  const result = await runEval(options)
  if (!result.ok) {
    printPreflight(result.preflight)
    process.exitCode = 1
    return
  }

  console.log(`results: ${result.resultsPath}`)
  printSummary(result.results)
}

function printPlan(options, plan) {
  const payload = {
    fixture: options.fixture,
    condition: options.condition,
    runs: options.runs,
    concurrency: options.concurrency,
    totalRuns: plan.runs.length,
    selectedRuns: plan.runs,
  }
  if (options.json) console.log(JSON.stringify(payload, null, 2))
  else {
    console.log(`Eval dry-run: ${plan.runs.length} run(s) selected`)
    for (const run of plan.runs) {
      console.log(`- ${run.fixtureId} / ${run.conditionId} / r${run.repetition}`)
    }
  }
}

function printPreflight(result) {
  console.log(`Preflight: ${result.ok ? "PASS" : "FAIL"}`)
  for (const error of result.errors) {
    console.log(`- ${error}`)
  }
}

function printSummary(results) {
  const aggregate = results.aggregate ?? aggregateRuns(results.runs)
  console.log("")
  console.log("| fixture | condition | runs | build | test | runtime | stack | failures |")
  console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |")
  for (const row of aggregate.byCondition) {
    console.log(
      `| ${row.fixtureId} | ${row.conditionId} | ${row.runs} | ${pct(row.compileBuildRate)} | ${pct(row.gradleTestRate)} | ${row.runtimeSmokeRate === null ? "n/a" : pct(row.runtimeSmokeRate)} | ${pct(row.stackAlignmentRate)} | ${row.externalFailureModeTotal} |`,
    )
  }
}

function pct(value) {
  if (typeof value !== "number") return "n/a"
  return `${Math.round(value * 100)}%`
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
