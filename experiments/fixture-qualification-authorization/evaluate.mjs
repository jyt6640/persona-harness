import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { evaluateAuthorization } from "./contract.mjs"

const root = dirname(fileURLToPath(import.meta.url))

if (process.argv[1] !== undefined) {
  const args = process.argv.slice(2)
  if (args[0] === "--help" || args[0] === "-h") {
    process.stdout.write("Usage: node evaluate.mjs [--evaluate]\n")
  } else {
    const output = safelyEvaluate(root, args)
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
    process.exitCode = output.ok ? 0 : 1
  }
}

function safelyEvaluate(rootPath, args) {
  try {
    if (args.length > 1 || (args.length === 1 && args[0] !== "--evaluate")) {
      return {
        schemaVersion: "fixture-qualification-validation.1",
        authorizationStatus: "authorization-only-not-executed",
        qualificationOperationAllowed: false,
        qualificationAllowed: false,
        executionAllowed: false,
        finishAuthority: "trusted-authority-required",
        sourceInspectionExecuted: false,
        mirrorCreated: false,
        decision: "invalid-authorization",
        errors: [{ code: "SELECTION_INVALID", path: "argv", message: "only --evaluate is supported" }],
        ok: false,
      }
    }
    return evaluateAuthorization(rootPath)
  } catch {
    return {
      schemaVersion: "fixture-qualification-validation.1",
      authorizationStatus: "authorization-only-not-executed",
      qualificationOperationAllowed: false,
      qualificationAllowed: false,
      executionAllowed: false,
      finishAuthority: "trusted-authority-required",
      sourceInspectionExecuted: false,
      mirrorCreated: false,
      decision: "invalid-authorization",
      errors: [{ code: "INTERNAL_EVALUATION_ERROR", path: "evaluator", message: "evaluation failed without exposing filesystem details" }],
      ok: false,
    }
  }
}
