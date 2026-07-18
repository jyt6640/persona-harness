import { mkdirSync, realpathSync, writeFileSync } from "node:fs"
import { isAbsolute, join, relative } from "node:path"
import { pathToFileURL } from "node:url"

import {
  assessProjectFinishProducerContextDiagnostic,
} from "./project-finish-attestation-producer-context-diagnostic.mjs"
import {
  readProjectFinishAttestationOidc,
} from "./project-finish-attestation-oidc.mjs"
import {
  verifyProjectFinishProducerCheckout,
} from "./verify-project-finish-producer-checkout.mjs"

const OUTPUT_DIRECTORY = ".ci/project-finish-attestation-context-diagnostic"
const FAILURE_CODE = "project-finish-producer-context-diagnostic-failed"

async function main() {
  const workspace = workspaceRoot()
  const oidc = await readProjectFinishAttestationOidc()
  const result = assessProjectFinishProducerContextDiagnostic({
    claims: oidc.claims,
    environment: process.env,
    oidcEndpointStatus: oidc.endpointStatus,
    oidcRequestAttempted: oidc.requestAttempted,
    producerCheckout: producerCheckoutStatus(process.cwd(), process.env.PERSONA_HARNESS_PRODUCER_SHA),
  })
  writeSummary(workspace, result)
  process.stdout.write(`${JSON.stringify(result)}\n`)
  if (result.outcome !== "match") process.exitCode = 1
}

function producerCheckoutStatus(producerRoot, producerSha) {
  if (typeof producerSha !== "string" || producerSha.length === 0) return "missing"
  return verifyProjectFinishProducerCheckout(producerRoot, producerSha).kind === "verified"
    ? "match"
    : "mismatch"
}

function workspaceRoot() {
  const workspace = process.env.GITHUB_WORKSPACE
  if (typeof workspace !== "string" || !isAbsolute(workspace)) {
    throw new Error("project-finish-producer-context-diagnostic-workspace")
  }
  const root = realpathSync(workspace)
  if (relative(root, workspace) !== "") {
    throw new Error("project-finish-producer-context-diagnostic-workspace")
  }
  return root
}

function writeSummary(workspace, result) {
  const output = join(workspace, OUTPUT_DIRECTORY)
  if (relative(workspace, output).startsWith("..")) {
    throw new Error("project-finish-producer-context-diagnostic-workspace")
  }
  mkdirSync(output, { recursive: true, mode: 0o700 })
  writeFileSync(join(output, "summary.json"), `${JSON.stringify(result)}\n`, { flag: "w", mode: 0o600 })
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch(() => {
    process.stderr.write(`${FAILURE_CODE}\n`)
    process.exitCode = 1
  })
}
