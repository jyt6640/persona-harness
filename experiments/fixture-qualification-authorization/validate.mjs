import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { validateAuthorization } from "./contract.mjs"

const root = dirname(fileURLToPath(import.meta.url))

if (process.argv[1] !== undefined) {
  const args = process.argv.slice(2)
  if (args[0] === "--help" || args[0] === "-h") {
    process.stdout.write("Usage: node validate.mjs [--validate]\n")
  } else {
    const output = safelyValidate(root, args)
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
    process.exitCode = output.ok ? 0 : 1
  }
}

function safelyValidate(rootPath, args) {
  try {
    if (args.length > 1 || (args.length === 1 && args[0] !== "--validate")) {
      return {
        schemaVersion: "fixture-qualification-validation.1",
        authorizationStatus: "authorization-only-not-executed",
        qualificationOperationAllowed: false,
        qualificationAllowed: false,
        executionAllowed: false,
        finishAuthority: "trusted-authority-required",
        sourceInspectionExecuted: false,
        mirrorCreated: false,
        errors: [{ code: "SELECTION_INVALID", path: "argv", message: "only --validate is supported" }],
        ok: false,
      }
    }
    return validateAuthorization(rootPath)
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
      errors: [{ code: "INTERNAL_VALIDATION_ERROR", path: "validator", message: "validation failed without exposing filesystem details" }],
      ok: false,
    }
  }
}
