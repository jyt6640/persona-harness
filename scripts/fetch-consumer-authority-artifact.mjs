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
const REDIRECT_HOSTS = new Set([
  "pipelines.actions.githubusercontent.com",
  "results-receiver.actions.githubusercontent.com",
])

export { ConsumerAuthorityArtifactFetchError } from "./consumer-authority-artifact-error.mjs"
export { extractOriginalArtifactMembers } from "./consumer-authority-artifact-archive.mjs"

export async function fetchConsumerAuthorityArtifact(input, transport = defaultTransport()) {
  const selection = parseSelection(input)
  if (selection === undefined) throw new ConsumerAuthorityArtifactFetchError("authority-fetch-invalid")
  const repository = await transport.json(api(`/repositories/${selection.repositoryId}`))
  if (!samePublicRepository(repository, selection)) throw new ConsumerAuthorityArtifactFetchError("authority-fetch-policy")

  const runs = await transport.json(api(`/repos/${selection.repositorySlug}/actions/workflows/${encodeURIComponent(`.github/workflows/${selection.callerWorkflowPath}`)}/runs?event=push&branch=main&head_sha=${selection.sourceHead}&per_page=100`))
  const run = selectRun(runs, selection.sourceHead)
  if (run === undefined) throw new ConsumerAuthorityArtifactFetchError("authority-fetch-evidence")

  const artifacts = await transport.json(api(`/repos/${selection.repositorySlug}/actions/runs/${run.id}/artifacts?per_page=100`))
  const artifact = selectArtifact(artifacts)
  if (artifact === undefined) throw new ConsumerAuthorityArtifactFetchError("authority-fetch-evidence")

  const archive = await transport.archive(api(`/repos/${selection.repositorySlug}/actions/artifacts/${artifact.id}/zip`))
  const members = extractOriginalArtifactMembers(archive)
  return {
    artifactDigest: digest(archive),
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
  return value
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

function selectRun(value, sourceHead) {
  if (!record(value) || !Array.isArray(value.workflow_runs) || value.workflow_runs.length > 100) return undefined
  const matches = value.workflow_runs.filter((run) => record(run)
    && positiveInteger(run.id)
    && run.event === "push"
    && run.head_branch === "main"
    && run.head_sha === sourceHead
    && run.status === "completed"
    && run.conclusion === "success")
  return matches.length === 1 ? matches[0] : undefined
}

function selectArtifact(value) {
  if (!record(value) || !Array.isArray(value.artifacts) || value.artifacts.length > 100) return undefined
  const matches = value.artifacts.filter((artifact) => record(artifact)
    && positiveInteger(artifact.id)
    && artifact.name === ARTIFACT_NAME
    && artifact.expired === false
    && positiveInteger(artifact.size_in_bytes)
    && artifact.size_in_bytes <= MAX_ARCHIVE_BYTES)
  return matches.length === 1 ? matches[0] : undefined
}

function defaultTransport() {
  return { archive: requestArchive, json: requestJson }
}

function requestJson(url) {
  return request(url, MAX_JSON_BYTES, false).then((bytes) => {
    try {
      return JSON.parse(bytes.toString("utf8"))
    } catch {
      throw new ConsumerAuthorityArtifactFetchError("authority-fetch-network")
    }
  })
}

function requestArchive(url) {
  return request(url, MAX_ARCHIVE_BYTES, true)
}

function request(url, limit, allowArtifactRedirect) {
  if (
    !(url instanceof URL)
    || url.protocol !== "https:"
    || url.port !== ""
    || url.username !== ""
    || url.password !== ""
    || (url.origin !== API_ORIGIN && !REDIRECT_HOSTS.has(url.hostname))
  ) {
    return Promise.reject(new ConsumerAuthorityArtifactFetchError("authority-fetch-network"))
  }
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        Accept: "application/vnd.github+json, application/octet-stream",
        "User-Agent": "persona-harness-consumer-authority",
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
        if (redirect === undefined || redirect.protocol !== "https:" || !REDIRECT_HOSTS.has(redirect.hostname) || redirect.port !== "" || redirect.username !== "" || redirect.password !== "") {
          reject(new ConsumerAuthorityArtifactFetchError("authority-fetch-network"))
          return
        }
        request(redirect, limit, false).then(resolve, reject)
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
          request.destroy()
          reject(new ConsumerAuthorityArtifactFetchError("authority-fetch-network"))
          return
        }
        chunks.push(chunk)
      })
      response.on("end", () => resolve(Buffer.concat(chunks)))
      response.on("error", () => reject(new ConsumerAuthorityArtifactFetchError("authority-fetch-network")))
    })
    request.on("timeout", () => request.destroy(new ConsumerAuthorityArtifactFetchError("authority-fetch-network")))
    request.on("error", () => reject(new ConsumerAuthorityArtifactFetchError("authority-fetch-network")))
  })
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

function repositorySlug(value) {
  return typeof value === "string" && value.length <= 256 && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value) && !value.split("/").some((part) => part === "." || part === "..")
}

function workflowPath(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256 && !value.includes("\\") && value.endsWith(".yml") && !value.split("/").some((part) => part === "" || part === "." || part === "..")
}

function commit(value) {
  return typeof value === "string" && /^[a-f0-9]{40}$/iu.test(value)
}

function digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
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
      artifactDigest: value.artifactDigest,
      bundle: value.bundle.toString("base64"),
      ok: true,
      predicate: value.predicate.toString("base64"),
      receipt: value.receipt.toString("base64"),
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
