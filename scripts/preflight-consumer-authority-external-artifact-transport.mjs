import { realpathSync } from "node:fs"
import { dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { readV087AcceptanceManifest } from "./consumer-authority-v087-acceptance-schema.mjs"
import { runExternalArtifactTransportPreflight } from "./consumer-authority-external-artifact-transport-plan.mjs"

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))

async function main() {
  const argumentsList = process.argv.slice(2)
  if (argumentsList.length > 1 || (argumentsList.length === 1 && argumentsList[0] !== "--json")) {
    process.stderr.write("Usage: node preflight-consumer-authority-external-artifact-transport.mjs [--json]\n")
    process.exitCode = 1
    return
  }
  readV087AcceptanceManifest(packageRoot)
  const result = await runExternalArtifactTransportPreflight()
  process.stdout.write(`${JSON.stringify(result)}\n`)
  process.exitCode = result.state === "ready" ? 0 : 1
}

if (isDirectInvocation()) {
  main().catch(() => {
    process.stdout.write(`${JSON.stringify({
      artifactAccess: false,
      authorityEligible: false,
      code: "external-artifact-transport-plan-unavailable",
      credential: "absent",
      crypto: "not-run",
      networkAccess: false,
      schemaVersion: "consumer-authority-external-artifact-transport-preflight.1",
      state: "blocked",
    })}\n`)
    process.exitCode = 1
  })
}

function isDirectInvocation() {
  if (process.argv[1] === undefined) return false
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
  } catch {
    return false
  }
}
