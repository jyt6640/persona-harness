import https from "node:https"
import { pathToFileURL } from "node:url"

const GITHUB_API_ORIGIN = "https://api.github.com"
const MAX_RESPONSE_BYTES = 512 * 1024
const PRODUCER_REPOSITORY = "jyt6640/persona-harness"
const PRODUCER_WORKFLOW_PATH = ".github/workflows/persona-harness-project-finish.yml"
const REQUEST_TIMEOUT_MS = 15_000
const GITHUB_API_VERSION = "2022-11-28"
const GITHUB_TOKEN_ENV = "PH_AUTHORITY_GITHUB_TOKEN"

export async function readConsumerAuthorityGithubEnrollment(input, request = requestJson) {
  const selection = parseSelection(input)
  if (selection === undefined) throw new ConsumerAuthorityGithubReadbackError("authority-enrollment-invalid")
  const repository = await request(githubApi(`/repos/${selection.repositorySlug}`))
  if (!isRepository(repository, selection.repositorySlug)) {
    throw new ConsumerAuthorityGithubReadbackError("authority-enrollment-repository")
  }
  const workflowPath = `.github/workflows/${selection.workflowPath}`
  const contentsUrl = githubApi(`/repos/${selection.repositorySlug}/contents/${workflowPath}`)
  contentsUrl.searchParams.set("ref", "main")
  const contents = await request(contentsUrl)
  const reusableWorkflowSha = readReusableWorkflowSha(contents, workflowPath)
  if (reusableWorkflowSha === undefined) {
    throw new ConsumerAuthorityGithubReadbackError("authority-enrollment-workflow")
  }
  const confirmedRepository = await request(githubApi(`/repos/${selection.repositorySlug}`))
  if (!sameRepository(repository, confirmedRepository, selection.repositorySlug)) {
    throw new ConsumerAuthorityGithubReadbackError("authority-enrollment-repository")
  }
  return {
    callerWorkflowPath: workflowPath,
    repositoryId: repository.id,
    repositorySlug: selection.repositorySlug,
    reusableWorkflowSha,
  }
}

export class ConsumerAuthorityGithubReadbackError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

function parseSelection(value) {
  if (!record(value) || !exactKeys(value, ["repositorySlug", "workflowPath"]) || !repositorySlug(value.repositorySlug) || !workflowPath(value.workflowPath)) {
    return undefined
  }
  return { repositorySlug: value.repositorySlug, workflowPath: value.workflowPath }
}

function githubApi(path) {
  const url = new URL(path, GITHUB_API_ORIGIN)
  if (url.origin !== GITHUB_API_ORIGIN || !url.pathname.startsWith("/repos/")) {
    throw new ConsumerAuthorityGithubReadbackError("authority-enrollment-network")
  }
  return url
}

function isRepository(value, expectedSlug) {
  return record(value)
    && positiveInteger(value.id)
    && value.full_name === expectedSlug
    && value.private === false
    && value.visibility === "public"
}

function readReusableWorkflowSha(value, expectedPath) {
  if (
    !record(value)
    || value.encoding !== "base64"
    || value.path !== expectedPath
    || value.type !== "file"
    || !positiveInteger(value.size)
    || value.size > MAX_RESPONSE_BYTES
    || typeof value.sha !== "string"
    || !/^[a-f0-9]{40}$/u.test(value.sha)
    || typeof value.content !== "string"
    || value.content.length > MAX_RESPONSE_BYTES * 2
  ) {
    return undefined
  }
  const encoded = value.content.replaceAll(/\s/gu, "")
  if (!canonicalBase64(encoded)) return undefined
  const bytes = Buffer.from(encoded, "base64")
  if (bytes.byteLength !== value.size || bytes.byteLength > MAX_RESPONSE_BYTES) return undefined
  const text = bytes.toString("utf8")
  if (text.length === 0 || !Buffer.from(text, "utf8").equals(bytes)) return undefined
  return reusableWorkflowShaFromJobs(text)
}

function requestJson(url) {
  if (!(url instanceof URL) || url.origin !== GITHUB_API_ORIGIN || url.protocol !== "https:") {
    return Promise.reject(new ConsumerAuthorityGithubReadbackError("authority-enrollment-network"))
  }
  const token = githubToken(process.env[GITHUB_TOKEN_ENV])
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
          "User-Agent": "persona-harness-consumer-authority",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
      timeout: REQUEST_TIMEOUT_MS,
    }, (response) => {
      const chunks = []
      let size = 0
      const contentLength = Number(response.headers["content-length"] ?? "0")
      if (response.statusCode !== 200 || !Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > MAX_RESPONSE_BYTES) {
        response.resume()
        reject(new ConsumerAuthorityGithubReadbackError("authority-enrollment-network"))
        return
      }
      response.on("data", (chunk) => {
        size += chunk.length
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy()
          reject(new ConsumerAuthorityGithubReadbackError("authority-enrollment-network"))
          return
        }
        chunks.push(chunk)
      })
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")))
        } catch {
          reject(new ConsumerAuthorityGithubReadbackError("authority-enrollment-network"))
        }
      })
      response.on("error", () => reject(new ConsumerAuthorityGithubReadbackError("authority-enrollment-network")))
    })
    request.on("timeout", () => request.destroy(new ConsumerAuthorityGithubReadbackError("authority-enrollment-network")))
    request.on("error", () => reject(new ConsumerAuthorityGithubReadbackError("authority-enrollment-network")))
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
  return typeof value === "string"
    && value.length > 0
    && value.length <= 256
    && /^[A-Za-z0-9_.-]+\.yml$/u.test(value)
}

function sameRepository(left, right, expectedSlug) {
  return isRepository(left, expectedSlug)
    && isRepository(right, expectedSlug)
    && left.id === right.id
}

function reusableWorkflowShaFromJobs(source) {
  const pattern = new RegExp(`^ {4}uses:\\s*${escapeRegExp(PRODUCER_REPOSITORY)}/${escapeRegExp(PRODUCER_WORKFLOW_PATH)}@([a-f0-9]{40})\\s*(?:#.*)?$`, "iu")
  const matches = []
  let inJobs = false
  let currentJob = false
  let jobsCount = 0
  for (const line of source.split(/\r?\n/u)) {
    if (/^jobs:\s*(?:#.*)?$/u.test(line)) {
      jobsCount += 1
      inJobs = true
      currentJob = false
      continue
    }
    if (inJobs && /^(?:\S| {0,1}\S)/u.test(line) && !/^\s*(?:#.*)?$/u.test(line)) {
      inJobs = false
      currentJob = false
    }
    if (!inJobs) continue
    if (/^ {2}[A-Za-z_][A-Za-z0-9_-]*:\s*(?:#.*)?$/u.test(line)) {
      currentJob = true
      continue
    }
    const match = currentJob ? pattern.exec(line) : null
    if (match?.[1] !== undefined) matches.push(match[1].toLowerCase())
  }
  return jobsCount === 1 && matches.length === 1 ? matches[0] : undefined
}

function canonicalBase64(value) {
  return value.length > 0
    && value.length % 4 === 0
    && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}

function githubToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,4096}$/u.test(value) ? value : undefined
}

async function main() {
  let input
  try {
    input = JSON.parse(await new Promise((resolve, reject) => {
      const chunks = []
      process.stdin.on("data", (chunk) => chunks.push(chunk))
      process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
      process.stdin.on("error", reject)
    }))
    const value = await readConsumerAuthorityGithubEnrollment(input)
    process.stdout.write(`${JSON.stringify({ ok: true, value })}\n`)
  } catch (error) {
    const code = error instanceof ConsumerAuthorityGithubReadbackError ? error.code : "authority-enrollment-network"
    process.stdout.write(`${JSON.stringify({ code, ok: false })}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
