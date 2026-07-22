import {
  closeSync,
  constants,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { isAbsolute, join, relative } from "node:path"
import { pathToFileURL } from "node:url"

import {
  verifyProjectFinishProducerCheckout,
} from "./verify-project-finish-producer-checkout.mjs"
import {
  deriveProjectFinishProducerContext,
} from "./project-finish-attestation-producer-context.mjs"
import {
  readProjectFinishAttestationProducerOidcClaims,
} from "./project-finish-attestation-oidc.mjs"

const CALLER_CHECKOUT_DIRECTORY = ".project-finish-caller"
const ARTIFACT_DIRECTORY = ".project-finish-attestation-artifacts"
const ARTIFACT_STAGING_DIRECTORY = ".project-finish-attestation-artifacts-staging"
const FAILURE_DIRECTORY = ".project-finish-attestation-failure"

export async function runProjectFinishAttestationBuilder({
  environment = process.env,
  oidcToken,
  producerRoot = process.cwd(),
} = {}) {
  let workspace
  try {
    workspace = resolveProjectFinishAttestationWorkspace(environment)
  } catch (error) {
    return { code: diagnosticCode(error), kind: "blocked" }
  }
  const context = readProjectFinishAttestationProducerContextFromToken(oidcToken, environment)
  if (context.kind === "blocked") return recordBlocked(workspace, context.code)
  try {
    if (!sameWorkspace(workspace)) return recordBlocked(workspace, "project-finish-producer-workspace")
    verifyProducerCheckout(producerRoot, context.value.reusableWorkflowSha)
    const { runProjectFinishAttestationProducer } = await import(
      pathToFileURL(join(producerRoot, "dist", "cli", "project-finish-attestation-producer-runner.js")).href,
    )
    const result = runProjectFinishAttestationProducer(
      workspace.caller.realpath,
      context.value,
      readProducerVersion(producerRoot),
    )
    if (result.kind === "blocked") return recordBlocked(workspace, result.code)
    if (!sameWorkspace(workspace)) return recordBlocked(workspace, "project-finish-producer-workspace")
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
  const claims = readProjectFinishAttestationProducerOidcClaims(oidcToken)
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
    process.stdout.write("Project finish attestation predicate written to .project-finish-attestation-artifacts\n")
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

export function resolveProjectFinishAttestationCallerWorkspace(environment = process.env) {
  return resolveProjectFinishAttestationWorkspace(environment).caller.realpath
}

function resolveProjectFinishAttestationWorkspace(environment) {
  const workspace = requiredEnvironment(environment, "GITHUB_WORKSPACE")
  if (!isAbsolute(workspace)) throw new ProducerScriptError("project-finish-producer-workspace")
  const runner = captureCanonicalDirectory(workspace)
  const callerPath = join(runner.realpath, CALLER_CHECKOUT_DIRECTORY)
  if (!isContained(runner.realpath, callerPath)) throw new ProducerScriptError("project-finish-producer-workspace")
  const caller = captureCanonicalDirectory(callerPath)
  return { caller, runner }
}

function writeArtifacts(workspace, artifacts) {
  if (!sameWorkspace(workspace)) throw new ProducerScriptError("project-finish-producer-workspace")
  const staging = createRunnerDirectory(workspace, ARTIFACT_STAGING_DIRECTORY)
  try {
    writePrivateFile(join(staging.realpath, "receipt.json"), artifacts.receiptBytes)
    writePrivateFile(join(staging.realpath, "predicate.json"), `${JSON.stringify(artifacts.predicate)}\n`)
    if (!sameWorkspace(workspace)) throw new ProducerScriptError("project-finish-producer-workspace")
    const output = join(workspace.runner.realpath, ARTIFACT_DIRECTORY)
    if (pathExists(output)) throw new ProducerScriptError("project-finish-producer-workspace")
    renameSync(staging.realpath, output)
  } catch (error) {
    rmSync(staging.realpath, { force: true, recursive: true })
    throw error
  }
}

function recordBlocked(workspace, code) {
  if (sameRunnerWorkspace(workspace)) writeFailureDiagnostic(workspace, code)
  return { code, kind: "blocked" }
}

function writeFailureDiagnostic(workspace, code) {
  try {
    const output = createRunnerDirectory(workspace, FAILURE_DIRECTORY)
    writePrivateFile(
      join(output.realpath, "failure-diagnostic.json"),
      `${JSON.stringify({
        code,
        schemaVersion: "project-finish-attestation-producer-diagnostic.1",
      })}\n`,
    )
  } catch (error) {
    if (error instanceof Error) return
    return
  }
}

function createRunnerDirectory(workspace, name) {
  if (!sameRunnerWorkspace(workspace)) throw new ProducerScriptError("project-finish-producer-workspace")
  const directory = join(workspace.runner.realpath, name)
  if (!isContained(workspace.runner.realpath, directory)) {
    throw new ProducerScriptError("project-finish-producer-workspace")
  }
  try {
    mkdirSync(directory, { mode: 0o700 })
  } catch {
    throw new ProducerScriptError("project-finish-producer-workspace")
  }
  const captured = captureCanonicalDirectory(directory)
  if (!sameRunnerWorkspace(workspace)) throw new ProducerScriptError("project-finish-producer-workspace")
  return captured
}

function writePrivateFile(path, contents) {
  let descriptor
  try {
    descriptor = openSync(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    )
    writeFileSync(descriptor, contents)
  } catch {
    throw new ProducerScriptError("project-finish-producer-workspace")
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

function captureCanonicalDirectory(path) {
  try {
    const before = lstatSync(path, { bigint: true })
    if (before.isSymbolicLink() || !before.isDirectory()) throw new ProducerScriptError("project-finish-producer-workspace")
    const realpath = realpathSync(path)
    if (realpath !== path) throw new ProducerScriptError("project-finish-producer-workspace")
    const after = lstatSync(path, { bigint: true })
    if (
      after.isSymbolicLink()
      || !after.isDirectory()
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.ctimeNs !== after.ctimeNs
    ) {
      throw new ProducerScriptError("project-finish-producer-workspace")
    }
    return { dev: before.dev.toString(), ino: before.ino.toString(), realpath }
  } catch (error) {
    if (error instanceof ProducerScriptError) throw error
    throw new ProducerScriptError("project-finish-producer-workspace")
  }
}

function sameWorkspace(workspace) {
  return sameRunnerWorkspace(workspace) && sameDirectory(workspace.caller)
}

function sameRunnerWorkspace(workspace) {
  return workspace !== undefined && typeof workspace === "object" && sameDirectory(workspace.runner)
}

function sameDirectory(expected) {
  if (expected === undefined || typeof expected !== "object" || typeof expected.realpath !== "string") return false
  try {
    const stat = lstatSync(expected.realpath, { bigint: true })
    return realpathSync(expected.realpath) === expected.realpath
      && !stat.isSymbolicLink()
      && stat.isDirectory()
      && stat.dev.toString() === expected.dev
      && stat.ino.toString() === expected.ino
  } catch {
    return false
  }
}

function isContained(root, candidate) {
  const path = relative(root, candidate)
  return path === "" || (!path.startsWith("..") && !isAbsolute(path))
}

function pathExists(path) {
  try {
    lstatSync(path, { bigint: true })
    return true
  } catch {
    return false
  }
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
