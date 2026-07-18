import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import { get } from "node:https"
import { isAbsolute, join, relative } from "node:path"
import { pathToFileURL } from "node:url"

import {
  runProjectFinishAttestationProducer,
} from "../dist/cli/project-finish-attestation-producer-runner.js"
import {
  PROJECT_FINISH_ATTESTATION_POLICY,
} from "../dist/cli/project-finish-attestation-types.js"
import {
  verifyProjectFinishProducerCheckout,
} from "./verify-project-finish-producer-checkout.mjs"

const OUTPUT_DIRECTORY = ".ci/project-finish-attestation"
const MAX_OIDC_RESPONSE_BYTES = 64 * 1024

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
  const claims = await readOidcClaims()
  const repository = requiredClaim(claims, "repository")
  const sourceHead = requiredEnv("GITHUB_SHA")
  const callerWorkflowRef = requiredClaim(claims, "workflow_ref")
  const callerWorkflowSha = requiredClaim(claims, "workflow_sha")
  const reusableWorkflowRef = requiredClaim(claims, "job_workflow_ref")
  const reusableWorkflowSha = requiredClaim(claims, "job_workflow_sha")
  if (
    requiredEnv("GITHUB_EVENT_NAME") !== "push"
    || requiredEnv("GITHUB_REF") !== "refs/heads/main"
    || requiredEnv("GITHUB_REPOSITORY") !== repository
    || requiredEnv("GITHUB_REPOSITORY_ID") !== requiredClaim(claims, "repository_id")
    || requiredEnv("GITHUB_REPOSITORY_VISIBILITY") !== "public"
    || requiredEnv("PERSONA_HARNESS_PRODUCER_SHA") !== reusableWorkflowSha
    || sourceHead !== callerWorkflowSha
    || reusableWorkflowRef !== `${PROJECT_FINISH_ATTESTATION_POLICY.producerRepository}/${PROJECT_FINISH_ATTESTATION_POLICY.workflowPath}@${reusableWorkflowSha}`
  ) {
    throw new ProducerScriptError("project-finish-producer-context")
  }
  return {
    callerWorkflowRef,
    callerWorkflowSha,
    issuedAt: new Date().toISOString(),
    repository: {
      id: positiveInteger(requiredClaim(claims, "repository_id")),
      slug: repository,
      visibility: "public",
    },
    reusableWorkflowSha,
    runAttempt: positiveInteger(requiredEnv("GITHUB_RUN_ATTEMPT")),
    runId: requiredEnv("GITHUB_RUN_ID"),
    sourceHead,
  }
}

async function readOidcClaims() {
  const endpoint = requiredEnv("ACTIONS_ID_TOKEN_REQUEST_URL")
  const requestToken = requiredEnv("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
  const url = new URL(endpoint)
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.hash !== "") {
    throw new ProducerScriptError("project-finish-producer-oidc")
  }
  url.searchParams.set("audience", "persona-harness-project-finish-attestation")
  const response = await readJson(url, requestToken)
  if (!isRecord(response) || typeof response.value !== "string") {
    throw new ProducerScriptError("project-finish-producer-oidc")
  }
  const parts = response.value.split(".")
  if (parts.length !== 3 || parts[1] === undefined) {
    throw new ProducerScriptError("project-finish-producer-oidc")
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))
    if (!isRecord(payload)) throw new ProducerScriptError("project-finish-producer-oidc")
    return payload
  } catch {
    throw new ProducerScriptError("project-finish-producer-oidc")
  }
}

function readJson(url, requestToken) {
  return new Promise((resolve, reject) => {
    const request = get(url, {
      headers: {
        accept: "application/json",
        authorization: `bearer ${requestToken}`,
      },
    }, (response) => {
      const chunks = []
      let total = 0
      if (response.statusCode !== 200 || response.headers.location !== undefined) {
        response.resume()
        reject(new ProducerScriptError("project-finish-producer-oidc"))
        return
      }
      response.on("data", (chunk) => {
        total += chunk.length
        if (total > MAX_OIDC_RESPONSE_BYTES) {
          request.destroy(new ProducerScriptError("project-finish-producer-oidc"))
          return
        }
        chunks.push(chunk)
      })
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")))
        } catch {
          reject(new ProducerScriptError("project-finish-producer-oidc"))
        }
      })
      response.on("error", () => reject(new ProducerScriptError("project-finish-producer-oidc")))
    })
    request.setTimeout(15_000, () => request.destroy(new ProducerScriptError("project-finish-producer-oidc")))
    request.on("error", () => reject(new ProducerScriptError("project-finish-producer-oidc")))
  })
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

function requiredClaim(claims, key) {
  const value = claims[key]
  if (typeof value !== "string" || value.length === 0 || value.length > 512 || /[\u0000\r\n]/u.test(value)) {
    throw new ProducerScriptError("project-finish-producer-oidc")
  }
  return value
}

function requiredEnv(name) {
  const value = process.env[name]
  if (value === undefined || value.length === 0 || value.length > 512 || /[\u0000\r\n]/u.test(value)) {
    throw new ProducerScriptError("project-finish-producer-context")
  }
  return value
}

function positiveInteger(value) {
  if (!/^[1-9][0-9]*$/u.test(value)) throw new ProducerScriptError("project-finish-producer-context")
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) throw new ProducerScriptError("project-finish-producer-context")
  return parsed
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
