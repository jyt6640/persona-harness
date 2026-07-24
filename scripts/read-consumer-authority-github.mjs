import https from "node:https"

const GITHUB_API_ORIGIN = "https://api.github.com"
const MAX_RESPONSE_BYTES = 512 * 1024
const PRODUCER_REPOSITORY = "jyt6640/persona-harness"
const PRODUCER_WORKFLOW_PATH = ".github/workflows/persona-harness-project-finish.yml"
const REQUEST_TIMEOUT_MS = 15_000

export async function readConsumerAuthorityGithubEnrollment(input, request = requestJson) {
  const selection = parseSelection(input)
  if (selection === undefined) throw new ConsumerAuthorityGithubReadbackError("authority-enrollment-invalid")
  const repository = await request(githubApi(`/repos/${selection.repositorySlug}`))
  if (!isRepository(repository, selection.repositorySlug)) {
    throw new ConsumerAuthorityGithubReadbackError("authority-enrollment-repository")
  }
  const contents = await request(githubApi(`/repos/${selection.repositorySlug}/contents/.github/workflows/${selection.workflowPath}`))
  const reusableWorkflowSha = readReusableWorkflowSha(contents)
  if (reusableWorkflowSha === undefined) {
    throw new ConsumerAuthorityGithubReadbackError("authority-enrollment-workflow")
  }
  return {
    callerWorkflowPath: `.github/workflows/${selection.workflowPath}`,
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

function readReusableWorkflowSha(value) {
  if (!record(value) || value.encoding !== "base64" || typeof value.content !== "string" || value.content.length > MAX_RESPONSE_BYTES * 2) {
    return undefined
  }
  let text
  try {
    text = Buffer.from(value.content.replaceAll(/\s/gu, ""), "base64").toString("utf8")
  } catch {
    return undefined
  }
  if (text.length === 0 || Buffer.byteLength(text) > MAX_RESPONSE_BYTES) return undefined
  const pattern = new RegExp(`^\\s*uses:\\s*${escapeRegExp(PRODUCER_REPOSITORY)}/${escapeRegExp(PRODUCER_WORKFLOW_PATH)}@([a-f0-9]{40})\\s*(?:#.*)?$`, "gimu")
  const matches = [...text.matchAll(pattern)]
  return matches.length === 1 && matches[0]?.[1] !== undefined ? matches[0][1].toLowerCase() : undefined
}

function requestJson(url) {
  if (!(url instanceof URL) || url.origin !== GITHUB_API_ORIGIN || url.protocol !== "https:") {
    return Promise.reject(new ConsumerAuthorityGithubReadbackError("authority-enrollment-network"))
  }
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "persona-harness-consumer-authority",
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
  return typeof value === "string" && value.length > 0 && value.length <= 256 && !value.includes("\\") && value.endsWith(".yml") && !value.split("/").some((part) => part === "" || part === "." || part === "..")
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
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

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main()
}
