import { realpathSync } from "node:fs"
import { dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { readBeta34AcceptanceManifest } from "./consumer-authority-beta34-acceptance-schema.mjs"
import { runExternalAttestationGrammarPreflight } from "./consumer-authority-external-attestation-command-plan.mjs"

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const PLACEHOLDER_SHA = "0".repeat(40)

function main() {
  const argumentsList = process.argv.slice(2)
  if (argumentsList.length !== 3 || argumentsList[0] !== "--json" || argumentsList[1] !== "--observer-gh" || !isAbsoluteToolPath(argumentsList[2])) {
    process.stderr.write("Usage: node preflight-consumer-authority-external-attestation.mjs --json --observer-gh /absolute/gh\n")
    process.exitCode = 1
    return
  }
  const manifest = readBeta34AcceptanceManifest(packageRoot)
  const result = runExternalAttestationGrammarPreflight(
    manifest.externalAttestationCommandPlan,
    grammarOnlyTopology(manifest),
    { ghPath: argumentsList[2] },
  )
  process.stdout.write(`${JSON.stringify(result)}\n`)
  process.exitCode = result.state === "ready" ? 0 : 1
}

function isAbsoluteToolPath(value) {
  return typeof value === "string" && value.startsWith("/") && value.length <= 4096 && !value.includes("\0")
}

function grammarOnlyTopology(manifest) {
  const authority = manifest.authority
  return {
    callerEnrollment: {
      repositoryId: authority.binding.callerEnrollment.repositoryId,
      repositorySlug: authority.binding.callerEnrollment.repositorySlug,
      workflowPath: authority.binding.callerEnrollment.workflowPath,
      workflowRef: authority.binding.callerEnrollment.workflowRef,
      workflowSha: PLACEHOLDER_SHA,
    },
    callerSource: {
      ref: authority.hostedFixture.ref,
      sourceSha: PLACEHOLDER_SHA,
    },
    reusableSigner: {
      repositorySlug: "jyt6640/persona-harness",
      workflowPath: authority.binding.reusableSigner.workflowPath,
      workflowSha: PLACEHOLDER_SHA,
    },
  }
}

if (isDirectInvocation()) {
  try {
    main()
  } catch {
    process.stdout.write(`${JSON.stringify({
      artifactAccess: false,
      authorityEligible: false,
      code: "gh-command-plan-unavailable",
      credential: "absent",
      exit: "execution-failed",
      networkAccess: false,
      schemaVersion: "consumer-authority-external-attestation-preflight.2",
      state: "blocked",
    })}\n`)
    process.exitCode = 1
  }
}

function isDirectInvocation() {
  if (process.argv[1] === undefined) return false
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
  } catch {
    return false
  }
}
