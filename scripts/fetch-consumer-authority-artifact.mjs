import { createHash } from "node:crypto"
import https from "node:https"
import { pathToFileURL } from "node:url"
import { ConsumerAuthorityArtifactFetchError } from "./consumer-authority-artifact-error.mjs"
import { extractOriginalArtifactMembers } from "./consumer-authority-artifact-archive.mjs"

const API_ORIGIN = "https://api.github.com"
const ARTIFACT_NAME = "project-finish-attestation"
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024
const MAX_JSON_BYTES = 512 * 1024
const REQUEST_TIMEOUT_MS = 15_000
const GITHUB_API_VERSION = "2022-11-28"
const GITHUB_TOKEN_ENV = "PH_AUTHORITY_GITHUB_TOKEN"
const REDIRECT_HOSTS = new Set([
  "pipelines.actions.githubusercontent.com",
  "results-receiver.actions.githubusercontent.com",
])

export { ConsumerAuthorityArtifactFetchError } from "./consumer-authority-artifact-error.mjs"
export { extractOriginalArtifactMembers } from "./consumer-authority-artifact-archive.mjs"

export function authorityGithubRequestHeaders(url, token) {
  const credential = githubToken(token)
  return {
    Accept: "application/vnd.github+json, application/octet-stream",
    "User-Agent": "persona-harness-consumer-authority",
    ...(url instanceof URL && url.origin === API_ORIGIN
      ? {
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
          ...(credential === undefined ? {} : { Authorization: `Bearer ${credential}` }),
        }
      : {}),
  }
}

export async function fetchConsumerAuthorityArtifact(input, transport = defaultTransport()) {
  const selection = parseSelection(input)
  if (selection === undefined) throw new ConsumerAuthorityArtifactFetchError("authority-fetch-invalid")
  const repository = await transport.json(api(`/repositories/${selection.repositoryId}`))
  if (!samePublicRepository(repository, selection)) throw new ConsumerAuthorityArtifactFetchError("authority-fetch-policy")

  const runs = await transport.json(api(`/repos/${selection.repositorySlug}/actions/workflows/${encodeURIComponent(`.github/workflows/${selection.callerWorkflowPath}`)}/runs?event=push&branch=main&head_sha=${selection.sourceHead}&per_page=100`))
  const run = selectRun(runs, selection)
  if (run === undefined) throw new ConsumerAuthorityArtifactFetchError("authority-fetch-evidence")

  const artifacts = await transport.json(api(`/repos/${selection.repositorySlug}/actions/runs/${run.id}/artifacts?per_page=100`))
  const artifact = selectArtifact(artifacts, selection, run.id)
  if (artifact === undefined) throw new ConsumerAuthorityArtifactFetchError("authority-fetch-evidence")

  const archive = await transport.archive(api(`/repos/${selection.repositorySlug}/actions/artifacts/${artifact.id}/zip`))
  const artifactDigest = digest(archive)
  if (archive.byteLength !== artifact.size_in_bytes || artifact.digest !== artifactDigest) {
    throw new ConsumerAuthorityArtifactFetchError("authority-fetch-evidence")
  }
  const members = extractOriginalArtifactMembers(archive)
  return {
    archive,
    artifactDigest,
    bundle: members.bundle,
    predicate: members.predicate,
    receipt: members.receipt,
    runId: String(run.id),
  }
}

function parseSelection(value) {
  if (!record(value) || !exactKeys(value, ["callerWorkflowPath", "repositoryId", "repositorySlug", "sourceHead"]) || !workflowPath(value.callerWorkflowPath) || !positiveInteger(value.repositoryId) || !repositorySlug(value.repositorySlug) || !commit(value.sourceHead)) {
    return undefined
  }
  return { ...value, sourceHead: value.sourceHead.toLowerCase() }
}

function api(path) {
  const url = new URL(path, API_ORIGIN)
  if (url.origin !== API_ORIGIN || (!url.pathname.startsWith("/repos") && !url.pathname.startsWith("/repositories/"))) {
    throw new ConsumerAuthorityArtifactFetchError("authority-fetch-network")
  }
  return url
}

function samePublicRepository(value, expected) {
  return record(value)
    && value.id === expected.repositoryId
    && value.full_name === expected.repositorySlug
    && value.private === false
    && value.visibility === "public"
}

function selectRun(value, expected) {
  const runs = boundedCollection(value, "workflow_runs")
  if (runs === undefined) return undefined
  const matches = runs.filter((run) => record(run)
    && positiveInteger(run.id)
    && run.event === "push"
    && run.head_branch === "main"
    && run.head_sha === expected.sourceHead
    && run.status === "completed"
    && run.conclusion === "success"
    && sameRepositoryIdentity(run.repository, expected)
    && sameRepositoryIdentity(run.head_repository, expected))
  return matches.length === 1 ? matches[0] : undefined
}

function selectArtifact(value, expected, runId) {
  const artifacts = boundedCollection(value, "artifacts")
  if (artifacts === undefined) return undefined
  const matches = artifacts.filter((artifact) => record(artifact)
    && positiveInteger(artifact.id)
    && artifact.name === ARTIFACT_NAME
    && artifact.expired === false
    && positiveInteger(artifact.size_in_bytes)
    && artifact.size_in_bytes <= MAX_ARCHIVE_BYTES
    && isDigest(artifact.digest)
    && record(artifact.workflow_run)
    && artifact.workflow_run.id === runId
    && artifact.workflow_run.repository_id === expected.repositoryId
    && artifact.workflow_run.head_repository_id === expected.repositoryId
    && artifact.workflow_run.head_branch === "main"
    && artifact.workflow_run.head_sha === expected.sourceHead)
  return matches.length === 1 ? matches[0] : undefined
}

function defaultTransport() {
  const token = githubToken(process.env[GITHUB_TOKEN_ENV])
  return {
    archive: (url) => requestArchive(url, token),
    json: (url) => requestJson(url, token),
  }
}

function requestJson(url, token) {
  return requestBytes(url, MAX_JSON_BYTES, false, token).then((bytes) => {
    try {
      return JSON.parse(bytes.toString("utf8"))
    } catch {
      throw new ConsumerAuthorityArtifactFetchError("authority-fetch-network")
    }
  })
}

function requestArchive(url, token) {
  return requestBytes(url, MAX_ARCHIVE_BYTES, true, token)
}

function requestBytes(url, limit, allowArtifactRedirect, token) {
  if (
    !(url instanceof URL)
    || url.protocol !== "https:"
    || url.port !== ""
    || url.username !== ""
    || url.password !== ""
    || (url.origin !== API_ORIGIN && !isArtifactRedirectHost(url.hostname))
  ) {
    return Promise.reject(new ConsumerAuthorityArtifactFetchError("authority-fetch-network"))
  }
  return new Promise((resolve, reject) => {
    const headers = authorityGithubRequestHeaders(url, token)
    const clientRequest = https.get(url, {
      headers: {
        ...headers,
      },
      timeout: REQUEST_TIMEOUT_MS,
    }, (response) => {
      if (allowArtifactRedirect && response.statusCode === 302) {
        const location = response.headers.location
        response.resume()
        let redirect
        try {
          redirect = location === undefined ? undefined : new URL(location)
        } catch {
          redirect = undefined
        }
        if (redirect === undefined || redirect.protocol !== "https:" || !isArtifactRedirectHost(redirect.hostname) || redirect.port !== "" || redirect.username !== "" || redirect.password !== "") {
          reject(new ConsumerAuthorityArtifactFetchError("authority-fetch-network"))
          return
        }
        requestBytes(redirect, limit, false, undefined).then(resolve, reject)
        return
      }
      const length = Number(response.headers["content-length"] ?? "0")
      if (response.statusCode !== 200 || !Number.isSafeInteger(length) || length < 0 || length > limit) {
        response.resume()
        reject(new ConsumerAuthorityArtifactFetchError("authority-fetch-network"))
        return
      }
      const chunks = []
      let size = 0
      response.on("data", (chunk) => {
        size += chunk.length
        if (size > limit) {
          clientRequest.destroy()
          reject(new ConsumerAuthorityArtifactFetchError("authority-fetch-network"))
          return
        }
        chunks.push(chunk)
      })
      response.on("end", () => resolve(Buffer.concat(chunks)))
      response.on("error", () => reject(new ConsumerAuthorityArtifactFetchError("authority-fetch-network")))
    })
    clientRequest.on("timeout", () => clientRequest.destroy(new ConsumerAuthorityArtifactFetchError("authority-fetch-network")))
    clientRequest.on("error", () => reject(new ConsumerAuthorityArtifactFetchError("authority-fetch-network")))
  })
}

function boundedCollection(value, key) {
  if (!record(value) || !nonNegativeInteger(value.total_count) || value.total_count > 100 || !Array.isArray(value[key])) {
    return undefined
  }
  return value[key].length === value.total_count ? value[key] : undefined
}

function sameRepositoryIdentity(value, expected) {
  return record(value)
    && value.id === expected.repositoryId
    && value.full_name === expected.repositorySlug
}

function isArtifactRedirectHost(hostname) {
  if (REDIRECT_HOSTS.has(hostname)) return true
  const labels = hostname.split(".")
  return labels.length === 5
    && /^[a-z0-9-]{1,63}$/u.test(labels[0] ?? "")
    && labels.slice(1).join(".") === "blob.core.windows.net"
}

function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function exactKeys(value, keys) {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === keys[index])
}

function positiveInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function nonNegativeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function repositorySlug(value) {
  return typeof value === "string" && value.length <= 256 && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value) && !value.split("/").some((part) => part === "." || part === "..")
}

function workflowPath(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 256
    && /^[A-Za-z0-9_.-]+\.yml$/u.test(value)
}

function commit(value) {
  return typeof value === "string" && /^[a-f0-9]{40}$/iu.test(value)
}

function digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function isDigest(value) {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value)
}

function githubToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,4096}$/u.test(value) ? value : undefined
}

async function main() {
  try {
    const text = await new Promise((resolve, reject) => {
      const chunks = []
      process.stdin.on("data", (chunk) => chunks.push(chunk))
      process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
      process.stdin.on("error", reject)
    })
    const value = await fetchConsumerAuthorityArtifact(JSON.parse(text))
    process.stdout.write(`${JSON.stringify({
      archive: value.archive.toString("base64"),
      artifactDigest: value.artifactDigest,
      ok: true,
      runId: value.runId,
    })}\n`)
  } catch (error) {
    const code = error instanceof ConsumerAuthorityArtifactFetchError ? error.code : "authority-fetch-network"
    process.stdout.write(`${JSON.stringify({ code, ok: false })}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
