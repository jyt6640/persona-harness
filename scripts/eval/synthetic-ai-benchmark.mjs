#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { FIXTURE_PATHS } from "./eval-core.mjs"
import { createJudgePackage, createSyntheticBenchmark, writeSyntheticBenchmark } from "./synthetic-ai-benchmark-core.mjs"

function usage() {
  return `Usage: node scripts/eval/synthetic-ai-benchmark.mjs [options]

Prepares a synthetic AI benchmark task pack and sealed local answer key.

Options:
  --fixture <id>          Frozen evaluation fixture (default: multi-step-backend-small)
  --model <id>            Required execution model identifier
  --model-version <text>  Required execution model version label
  --platform <text>       Required platform label
  --output <dir>          Write public, sealed, and judge preparation files
  --results <path>        Add an anonymized judge package from local eval results
  --dry-run               Print the handoff summary without writing files
  --help                  Print this help

This command prepares synthetic-only evaluation material. It does not call a model,
does not publish feedback, and does not create human or independent evidence.`
}

function parseArgs(argv) {
  const options = {
    fixture: "multi-step-backend-small",
    model: "",
    modelVersion: "",
    platform: "",
    output: "",
    results: "",
    dryRun: false,
    help: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = () => {
      index += 1
      if (index >= argv.length) throw new Error(`${arg} requires a value`)
      return argv[index]
    }
    if (arg === "--fixture") options.fixture = next()
    else if (arg === "--model") options.model = next()
    else if (arg === "--model-version") options.modelVersion = next()
    else if (arg === "--platform") options.platform = next()
    else if (arg === "--output") options.output = next()
    else if (arg === "--results") options.results = next()
    else if (arg === "--dry-run") options.dryRun = true
    else if (arg === "--help" || arg === "-h") options.help = true
    else throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

function prepare(options) {
  const fixturePath = FIXTURE_PATHS[options.fixture]
  if (!fixturePath) throw new Error(`Unknown fixture: ${options.fixture}`)
  const fixtureText = readFileSync(resolve(fixturePath), "utf8")
  return createSyntheticBenchmark({
    fixtureId: options.fixture,
    fixtureText,
    model: options.model,
    modelVersion: options.modelVersion,
    platform: options.platform,
  })
}

function dryRunSummary(benchmark) {
  return {
    schemaVersion: "persona-synthetic-ai-dry-run.1",
    caseCount: benchmark.problemSet.cases.length,
    participantKind: benchmark.problemSet.participantKind,
    claimScope: benchmark.problemSet.claimScope,
    executionInput: "public-problem-set-only",
    answerKey: "withheld",
    judgeInput: "anonymized-observations-and-bounded-rubric",
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  const benchmark = prepare(options)
  if (options.dryRun) {
    console.log(JSON.stringify(dryRunSummary(benchmark), null, 2))
    return
  }
  if (!options.output) throw new Error("--output is required unless --dry-run is used")
  const paths = writeSyntheticBenchmark(options.output, benchmark)
  let judgePackagePath = null
  if (options.results) {
    const results = JSON.parse(readFileSync(resolve(options.results), "utf8"))
    const judgePackage = createJudgePackage(benchmark, results)
    judgePackagePath = resolve(paths.outputRoot, "judge", "judge-package.json")
    writeFileSync(judgePackagePath, `${JSON.stringify(judgePackage, null, 2)}\n`)
  }
  console.log(
    JSON.stringify(
      {
        schemaVersion: "persona-synthetic-ai-preparation.1",
        outputRoot: paths.outputRoot,
        problemSetPath: paths.problemSetPath,
        answerKeyPath: paths.answerKeyPath,
        executionPlanPath: paths.executionPlanPath,
        rubricPath: paths.rubricPath,
        judgePackagePath,
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
