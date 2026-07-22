import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { isAbsolute, join, relative } from "node:path"
import { pathToFileURL } from "node:url"

import {
  verifyProjectFinishProducerCheckout,
} from "./verify-project-finish-producer-checkout.mjs"
import {
  deriveProjectFinishProducerContext,
} from "./project-finish-attestation-producer-context.mjs"
import {
  readProjectFinishAttestationOidcToken,
} from "./project-finish-attestation-oidc.mjs"

const OUTPUT_DIRECTORY = ".ci/project-finish-attestation"

export async function runProjectFinishAttestationBuilder({
  environment = process.env,
  oidcToken,
  producerRoot = process.cwd(),
} = {}) {
  let workspace
  try {
    workspace = workspaceRoot(environment)
  } catch (error) {
    return { code: diagnosticCode(error), kind: "blocked" }
  }
  const context = readProjectFinishAttestationProducerContextFromToken(oidcToken, environment)
  if (context.kind === "blocked") return recordBlocked(workspace, context.code)
  try {
    verifyProducerCheckout(producerRoot, context.value.reusableWorkflowSha)
    const { runProjectFinishAttestationProducer } = await import(
      pathToFileURL(join(producerRoot, "dist", "cli", "project-finish-attestation-producer-runner.js")).href,
    )
    const result = runProjectFinishAttestationProducer(
      workspace,
      context.value,
      readProducerVersion(producerRoot),
    )
    if (result.kind === "blocked") return recordBlocked(workspace, result.code)
    writeArtifacts(workspace, result.value)
    return { kind: "passed" }
  } catch (error) {
    return recordBlocked(workspace, diagnosticCode(error))
  }
}

export function readProjectFinishAttestationProducerContextFromToken(oidcToken, environment = process.env) {
  if (environment.GITHUB_ACTIONS !== "true") {
    return { code: "project-finish-producer-github-actions", kind: "blocked" }
  }
  const claims = readProjectFinishAttestationOidcToken(oidcToken)
  if (claims === undefined) return { code: "project-finish-producer-oidc", kind: "blocked" }
  try {
    return { kind: "ready", value: deriveProjectFinishProducerContext(claims, environment) }
  } catch {
    return { code: "project-finish-producer-context", kind: "blocked" }
  }
}

async function main() {
  let result
  try {
    result = await runProjectFinishAttestationBuilder()
  } catch (error) {
    process.stderr.write(`${diagnosticCode(error)}\n`)
    process.exitCode = 1
    return
  }
  if (result.kind === "passed") {
    process.stdout.write("Project finish attestation predicate written to .ci/project-finish-attestation\n")
    return
  }
  process.stderr.write(`${result.code}\n`)
  process.exitCode = 1
}

function verifyProducerCheckout(producerRoot, reusableWorkflowSha) {
  if (verifyProjectFinishProducerCheckout(producerRoot, reusableWorkflowSha).kind === "blocked") {
    throw new ProducerScriptError("project-finish-producer-checkout")
  }
}

function readProducerVersion(producerRoot) {
  try {
    const value = JSON.parse(readFileSync(join(producerRoot, "package.json"), "utf8"))
    if (!isRecord(value) || typeof value.version !== "string") {
      throw new ProducerScriptError("project-finish-producer-version")
    }
    return value.version
  } catch (error) {
    if (error instanceof ProducerScriptError) throw error
    throw new ProducerScriptError("project-finish-producer-version")
  }
}

function workspaceRoot(environment) {
  const workspace = requiredEnvironment(environment, "GITHUB_WORKSPACE")
  if (!isAbsolute(workspace)) throw new ProducerScriptError("project-finish-producer-workspace")
  try {
    const root = realpathSync(workspace)
    if (relative(root, workspace) !== "") throw new ProducerScriptError("project-finish-producer-workspace")
    return root
  } catch {
    throw new ProducerScriptError("project-finish-producer-workspace")
  }
}

function writeArtifacts(workspace, artifacts) {
  const output = outputDirectory(workspace)
  mkdirSync(output, { recursive: true })
  writeFileSync(join(output, "receipt.json"), artifacts.receiptBytes, { flag: "wx", mode: 0o600 })
  writeFileSync(join(output, "predicate.json"), `${JSON.stringify(artifacts.predicate)}\n`, { flag: "wx", mode: 0o600 })
}

function recordBlocked(workspace, code) {
  writeFailureDiagnostic(workspace, code)
  return { code, kind: "blocked" }
}

function writeFailureDiagnostic(workspace, code) {
  try {
    const output = outputDirectory(workspace)
    mkdirSync(output, { recursive: true })
    writeFileSync(
      join(output, "failure-diagnostic.json"),
      `${JSON.stringify({
        code,
        schemaVersion: "project-finish-attestation-producer-diagnostic.1",
      })}\n`,
      { flag: "w", mode: 0o600 },
    )
  } catch (error) {
    if (error instanceof Error) return
    return
  }
}

function outputDirectory(workspace) {
  const output = join(workspace, OUTPUT_DIRECTORY)
  if (relative(workspace, output).startsWith("..")) {
    throw new ProducerScriptError("project-finish-producer-workspace")
  }
  return output
}

function requiredEnvironment(environment, name) {
  const value = environment[name]
  if (value === undefined || value.length === 0 || value.length > 512 || /[\u0000\r\n]/u.test(value)) {
    throw new ProducerScriptError("project-finish-producer-context")
  }
  return value
}

function diagnosticCode(error) {
  return error instanceof ProducerScriptError && /^[a-z0-9-]{1,128}$/u.test(error.code)
    ? error.code
    : "project-finish-producer-failed"
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

class ProducerScriptError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
