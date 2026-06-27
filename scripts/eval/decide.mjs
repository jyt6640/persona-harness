#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { decideResults } from "./eval-core.mjs"

function usage() {
  return `Usage: node scripts/eval/decide.mjs <results.json>

Reads ON/OFF eval results and prints PASS, FAIL, or INCONCLUSIVE.
This command does not modify injection-value-status.json or any release state.`
}

function main() {
  const [arg] = process.argv.slice(2)
  if (!arg || arg === "--help" || arg === "-h") {
    console.log(usage())
    process.exitCode = arg ? 0 : 1
    return
  }

  const results = JSON.parse(readFileSync(arg, "utf8"))
  const decision = decideResults(results)
  console.log(`Verdict: ${decision.verdict}`)
  for (const reason of decision.reasons) {
    console.log(`- ${reason}`)
  }
  process.exitCode = decision.verdict === "FAIL" ? 1 : 0
}

main()
