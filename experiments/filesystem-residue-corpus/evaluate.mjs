import { fileURLToPath } from "node:url"
import { dirname } from "node:path"

import { evaluateCorpus } from "./contract.mjs"

const root = dirname(fileURLToPath(import.meta.url))

if (process.argv[1] !== undefined) {
  const args = process.argv.slice(2)
  if (args[0] === "--help" || args[0] === "-h") {
    process.stdout.write("Usage: node evaluate.mjs [--base|--successor|--all]\n")
  } else {
    const selection = select(args)
    const output = safelyEvaluate(root, selection)
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
    process.exitCode = output.ok ? 0 : 1
  }
}

function select(args) {
  if (args.length === 0 || args[0] === "--all") return "all"
  if (args[0] === "--base") return "base"
  if (args[0] === "--successor") return "successor"
  return "invalid"
}

function safelyEvaluate(corpusRoot, selection) {
  try {
    return evaluateCorpus(corpusRoot, selection)
  } catch {
    return {
      schemaVersion: "filesystem-residue-evaluation.1",
      selection,
      authorityEligible: false,
      childProcessInvocations: 0,
      enforcement: false,
      networkAccess: false,
      productCliInvocations: 0,
      realProjectAccess: false,
      reportOnly: true,
      writeOperations: 0,
      errors: [{ code: "INTERNAL_EVALUATION_ERROR", path: "evaluator", message: "evaluation failed without exposing filesystem details" }],
      ok: false,
      decision: "invalid-corpus",
    }
  }
}
