#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { DECISION_POLICIES, decideResults } from "./eval-core.mjs"

function usage() {
  return `Usage: node scripts/eval/decide.mjs [--policy <policy>] <results.json>

Reads ON/OFF eval results and prints PASS, FAIL, or INCONCLUSIVE.
This command does not modify injection-value-status.json or any release state.

Policies:
- ${DECISION_POLICIES.legacyStackHard} (default; preserves previously recorded old-gate verdict semantics)
- ${DECISION_POLICIES.externalPrimaryPreToolchain} (external-outcome-primary pre-toolchain scorer; historical only)
- ${DECISION_POLICIES.externalPrimary} (external-outcome-primary 2-tier gate with generated-toolchain-aware scoring; use only for fresh evals after preregistration)`
}

function main() {
  const { policy, resultsPath, help } = parseArgs(process.argv.slice(2))
  const arg = resultsPath
  if (!arg || help) {
    console.log(usage())
    process.exitCode = help ? 0 : 1
    return
  }

  const results = JSON.parse(readFileSync(arg, "utf8"))
  const decision = decideResults(results, { policy })
  console.log(`Policy: ${decision.policy}`)
  console.log(`Scorer: ${decision.scorer}`)
  console.log(`Verdict: ${decision.verdict}`)
  for (const reason of decision.reasons) {
    console.log(`- ${reason}`)
  }
  process.exitCode = decision.verdict === "FAIL" ? 1 : 0
}

function parseArgs(argv) {
  let policy = DECISION_POLICIES.legacyStackHard
  let resultsPath = ""
  let help = false
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--help" || arg === "-h") {
      help = true
    } else if (arg === "--policy") {
      index += 1
      policy = argv[index] ?? ""
    } else if (!resultsPath) {
      resultsPath = arg
    } else {
      throw new Error(`Unexpected argument: ${arg}`)
    }
  }
  return { policy, resultsPath, help }
}

main()
