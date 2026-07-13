import { fileURLToPath } from "node:url"
import { dirname } from "node:path"

import { validateCorpus } from "./contract.mjs"

const root = dirname(fileURLToPath(import.meta.url))

if (process.argv[1] !== undefined) {
  const args = process.argv.slice(2)
  if (args[0] === "--help" || args[0] === "-h") {
    process.stdout.write("Usage: node validate.mjs [--base|--successor|--all]\n")
  } else {
    const selection = select(args)
    const output = safelyValidate(root, selection)
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

function safelyValidate(corpusRoot, selection) {
  try {
    return validateCorpus(corpusRoot, selection)
  } catch {
    return {
      schemaVersion: "filesystem-residue-validation.1",
      selection,
      authorityEligible: false,
      childProcessInvocations: 0,
      enforcement: false,
      networkAccess: false,
      productCliInvocations: 0,
      realProjectAccess: false,
      reportOnly: true,
      writeOperations: 0,
      errors: [{ code: "INTERNAL_VALIDATION_ERROR", path: "validator", message: "validation failed without exposing filesystem details" }],
      ok: false,
    }
  }
}
