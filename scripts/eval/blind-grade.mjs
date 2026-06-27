#!/usr/bin/env node
import { anonymizeCapture, aggregateDisagreements, readScores, runLlmJudge } from "./blind-grade-core.mjs"

function usage() {
  return `Usage: node scripts/eval/blind-grade.mjs [options]

Blind review helper for captured eval artifacts.

Options:
  --anonymize <run-dir>      Create anonymized review package from captured raw artifacts
  --output <dir>             Output directory for anonymized package
  --seed <value>             Stable anonymization seed
  --aggregate <scores.json>  Print two-reviewer disagreement aggregate
  --llm-judge <review-dir>   Run external LLM judge command from EVAL_LLM_JUDGE_COMMAND
  --help                     Show this help

This command refuses fake scores. LLM judge requires EVAL_LLM_JUDGE_COMMAND.`
}

function parseArgs(argv) {
  const options = { anonymize: "", output: "", seed: "persona-blind-v1", aggregate: "", llmJudge: "", help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = () => {
      index += 1
      if (index >= argv.length) throw new Error(`${arg} requires a value`)
      return argv[index]
    }
    if (arg === "--help" || arg === "-h") options.help = true
    else if (arg === "--anonymize") options.anonymize = next()
    else if (arg === "--output") options.output = next()
    else if (arg === "--seed") options.seed = next()
    else if (arg === "--aggregate") options.aggregate = next()
    else if (arg === "--llm-judge") options.llmJudge = next()
    else throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  if (options.anonymize) {
    if (!options.output) throw new Error("--output is required with --anonymize")
    const result = anonymizeCapture(options.anonymize, options.output, options.seed)
    console.log(JSON.stringify(result, null, 2))
    return
  }
  if (options.aggregate) {
    console.log(JSON.stringify(aggregateDisagreements(readScores(options.aggregate)), null, 2))
    return
  }
  if (options.llmJudge) {
    const result = runLlmJudge(process.env.EVAL_LLM_JUDGE_COMMAND ?? "", options.llmJudge)
    console.log(result.stdout)
    if (result.stderr) console.error(result.stderr)
    process.exitCode = result.status === 0 ? 0 : 1
    return
  }
  console.log(usage())
  process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
