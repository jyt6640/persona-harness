import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { isAbsolute, join, relative } from "node:path"
import { pathToFileURL } from "node:url"

import {
  runProjectFinishAttestationProducer,
} from "../dist/cli/project-finish-attestation-producer-runner.js"
import {
  verifyProjectFinishProducerCheckout,
} from "./verify-project-finish-producer-checkout.mjs"
import {
  deriveProjectFinishProducerContext,
} from "./project-finish-attestation-producer-context.mjs"
import {
  readProjectFinishAttestationOidcClaims,
} from "./project-finish-attestation-oidc.mjs"

const OUTPUT_DIRECTORY = ".ci/project-finish-attestation"

class ProducerScriptError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

async function main() {
  const workspace = workspaceRoot()
  try {
    if (process.argv.length !== 2) throw new ProducerScriptError("project-finish-producer-arguments")
    const context = await readProducerContext()
    verifyProducerCheckout(process.cwd(), context.reusableWorkflowSha)
    const result = runProjectFinishAttestationProducer(
      workspace,
      context,
      readProducerVersion(process.cwd()),
    )
    if (result.kind === "blocked") throw new ProducerScriptError(result.code)
    writeArtifacts(workspace, result.value)
    process.stdout.write("Project finish attestation predicate written to .ci/project-finish-attestation\n")
  } catch (error) {
    const code = diagnosticCode(error)
    writeFailureDiagnostic(workspace, code)
    process.stderr.write(`${code}\n`)
    process.exitCode = 1
  }
}

async function readProducerContext() {
  if (process.env.GITHUB_ACTIONS !== "true") {
    throw new ProducerScriptError("project-finish-producer-github-actions")
  }
  const claims = await readProjectFinishAttestationOidcClaims()
  if (claims === undefined) throw new ProducerScriptError("project-finish-producer-oidc")
  try {
    return deriveProjectFinishProducerContext(claims, process.env)
  } catch {
    throw new ProducerScriptError("project-finish-producer-context")
  }
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

function workspaceRoot() {
  const workspace = requiredEnv("GITHUB_WORKSPACE")
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
  } catch {
    // The caller receives the bounded process exit code even when its workspace is unusable.
  }
}

function outputDirectory(workspace) {
  const output = join(workspace, OUTPUT_DIRECTORY)
  if (relative(workspace, output).startsWith("..")) {
    throw new ProducerScriptError("project-finish-producer-workspace")
  }
  return output
}

function requiredEnv(name) {
  const value = process.env[name]
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

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
