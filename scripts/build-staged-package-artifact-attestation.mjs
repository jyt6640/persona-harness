import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { get } from "node:https"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { captureSourceIdentity } from "./build-clean-ci-source-identity.mjs"
import { MAX_STAGED_TARBALL_BYTES } from "./staged-package-artifact-tarball.mjs"
import {
  createStagedPackageArtifactPredicate,
  FIXED_STAGED_PACKAGE_ARTIFACT_COMMAND_PLAN,
  STAGED_PACKAGE_ARTIFACT_CHANNELS,
  STAGED_PACKAGE_ARTIFACT_PACKAGE,
  STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN,
  STAGED_PACKAGE_ARTIFACT_WORKFLOW_REF,
  stagedPackageTarballUrl,
  StagedPackageArtifactProducerError,
  validateStagedPackageArtifactContext,
} from "./staged-package-artifact-attestation-core.mjs"

const OUTPUT_DIRECTORY = ".ci/staged-package-artifact-attestation"
const MAX_REGISTRY_METADATA_BYTES = 2 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 15_000

async function main() {
  try {
    const args = readArguments(process.argv.slice(2))
    const tarballUrl = stagedPackageTarballUrl(args.version)
    const context = readGitHubContext()
    const registryIndex = await readRegistryJson(`/${STAGED_PACKAGE_ARTIFACT_PACKAGE}`)
    const registryVersion = await readRegistryJson(`/${STAGED_PACKAGE_ARTIFACT_PACKAGE}/${encodeURIComponent(args.version)}`)
    const tarballBytes = await readRegistryBytes(tarballUrl, MAX_STAGED_TARBALL_BYTES)
    const result = createStagedPackageArtifactPredicate({
      channel: args.channel,
      commandPlan: FIXED_STAGED_PACKAGE_ARTIFACT_COMMAND_PLAN,
      context,
      now: new Date(),
      registryIndex,
      registryVersion,
      tarballBytes,
      version: args.version,
    })
    writeOutput(context.workspaceRoot, result)
    process.stdout.write("Staged package artifact predicate written to .ci/staged-package-artifact-attestation\n")
  } catch (error) {
    const code = error instanceof StagedPackageArtifactProducerError
      ? error.code
      : "staged-package-artifact-producer-failed"
    process.stderr.write(`${code}\n`)
    process.exitCode = 1
  }
}

function readArguments(args) {
  if (args.length !== 4 || args[0] !== "--channel" || args[2] !== "--version") {
    throw new StagedPackageArtifactProducerError("staged-producer-arguments")
  }
  const channel = args[1]
  const version = args[3]
  if (channel === undefined || version === undefined || !STAGED_PACKAGE_ARTIFACT_CHANNELS.includes(channel)) {
    throw new StagedPackageArtifactProducerError("staged-producer-arguments")
  }
  return { channel, version }
}

export function readGitHubContext() {
  if (process.env.GITHUB_ACTIONS !== "true") throw new StagedPackageArtifactProducerError("staged-producer-github-actions")

  const workspaceRoot = gitText(["rev-parse", "--show-toplevel"])
  const sourceHead = gitText(["rev-parse", "HEAD"])
  const canonicalMainHead = gitText(["rev-parse", "refs/remotes/origin/main"])
  const cleanStatus = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
    cwd: workspaceRoot,
    encoding: "buffer",
  })
  const context = {
    canonicalMainHead,
    cleanStatusDigest: `sha256:${createHash("sha256").update(cleanStatus).digest("hex")}`,
    contextHead: requiredEnv("GITHUB_SHA"),
    event: requiredEnv("GITHUB_EVENT_NAME"),
    ref: requiredEnv("GITHUB_REF"),
    repository: requiredEnv("GITHUB_REPOSITORY"),
    repositoryId: requiredEnv("GITHUB_REPOSITORY_ID"),
    runAttempt: requiredEnv("GITHUB_RUN_ATTEMPT"),
    runId: requiredEnv("GITHUB_RUN_ID"),
    runnerEnvironment: requiredEnv("RUNNER_ENVIRONMENT"),
    runnerLabel: "ubuntu-latest",
    runnerOs: requiredEnv("RUNNER_OS"),
    sourceHead,
    sourceIdentity: captureSourceIdentity(workspaceRoot),
    workflowRef: requiredEnv("GITHUB_WORKFLOW_REF"),
    workflowSha: requiredEnv("GITHUB_WORKFLOW_SHA"),
    workspaceRoot,
  }

  if (workspaceRoot !== process.cwd() || cleanStatus.byteLength !== 0 || sourceHead !== canonicalMainHead) {
    throw new StagedPackageArtifactProducerError("staged-producer-source-state")
  }
  validateStagedPackageArtifactContext(context)
  return context
}

async function readRegistryJson(path) {
  const bytes = await readRegistryBytes(`${STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN}${path}`, MAX_REGISTRY_METADATA_BYTES)
  try {
    return JSON.parse(bytes.toString("utf8"))
  } catch {
    throw new StagedPackageArtifactProducerError("staged-producer-registry-json")
  }
}

async function readRegistryBytes(value, maximumBytes) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new StagedPackageArtifactProducerError("staged-producer-registry-url")
  }
  if (url.origin !== STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN || url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
    throw new StagedPackageArtifactProducerError("staged-producer-registry-url")
  }

  return new Promise((resolve, reject) => {
    const request = get(url, { headers: { accept: "application/json, application/octet-stream" } }, (response) => {
      const chunks = []
      let total = 0
      if (response.statusCode !== 200 || response.headers.location !== undefined) {
        response.resume()
        reject(new StagedPackageArtifactProducerError("staged-producer-registry-response"))
        return
      }
      response.on("data", (chunk) => {
        total += chunk.length
        if (total > maximumBytes) {
          request.destroy(new StagedPackageArtifactProducerError("staged-producer-registry-bounds"))
          return
        }
        chunks.push(chunk)
      })
      response.on("end", () => resolve(Buffer.concat(chunks)))
      response.on("error", () => reject(new StagedPackageArtifactProducerError("staged-producer-registry-response")))
    })
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new StagedPackageArtifactProducerError("staged-producer-registry-timeout")))
    request.on("error", () => reject(new StagedPackageArtifactProducerError("staged-producer-registry-response")))
  })
}

function writeOutput(workspaceRoot, result) {
  const output = join(workspaceRoot, OUTPUT_DIRECTORY)
  mkdirSync(join(workspaceRoot, ".ci"), { recursive: true })
  mkdirSync(output, { recursive: false })
  writeFileSync(join(output, "package.tgz"), result.tarballBytes, { flag: "wx", mode: 0o600 })
  writeFileSync(join(output, "predicate.json"), `${JSON.stringify(result.predicate)}\n`, { flag: "wx", mode: 0o600 })
}

function gitText(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim()
}

function requiredEnv(name) {
  const value = process.env[name]
  if (value === undefined || value.length === 0) throw new StagedPackageArtifactProducerError("staged-producer-context-missing")
  return value
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
