import https from "node:https"

const API_ORIGIN = "https://api.github.com"
const API_VERSION = "2022-11-28"
const FIXTURE_REPOSITORY = "jyt6640/persona-harness-attestation-claim-fixture"
const MAX_RESPONSE_BYTES = 64 * 1024
const REQUEST_TIMEOUT_MS = 15_000
const SENTINEL_NAME = "persona-harness-observer-preflight-sentinel-v1"

export async function assessGithubActionsReadiness(token, request = requestGithubJson) {
  if (!isGithubToken(token)) return blocked("host-gh-token-invalid", "host-github-authentication")
  const headers = githubHeaders(token)
  let user
  try {
    user = await request(authenticatedUserUrl(), headers)
  } catch {
    return blocked("github-auth-unusable", "host-github-authentication")
  }
  if (user.statusCode !== 200 || !isAuthenticatedUser(user.body)) {
    return blocked("github-auth-unusable", "host-github-authentication")
  }

  let sentinel
  try {
    sentinel = await request(actionsSentinelUrl(), headers)
  } catch {
    return blocked("github-actions-read-unusable", "github-actions-read-preflight")
  }
  if (sentinel.statusCode !== 200 || !isArtifactList(sentinel.body)) {
    return blocked("github-actions-read-unusable", "github-actions-read-preflight")
  }
  if (sentinel.body.total_count !== 0 || sentinel.body.artifacts.length !== 0) {
    return blocked("github-actions-sentinel-not-empty", "github-actions-read-preflight")
  }
  return ready()
}

export function isObserverPreflightResult(value) {
  if (!isRecord(value)) return false
  const expected = value.state === "ready"
    ? [
      "authorityEligible",
      "consumerHome",
      "credential",
      "fixtureAuthorization",
      "mutationPerformed",
      "next",
      "schemaVersion",
      "state",
    ]
    : [
      "authorityEligible",
      "code",
      "consumerHome",
      "credential",
      "fixtureAuthorization",
      "mutationPerformed",
      "next",
      "schemaVersion",
      "state",
    ]
  if (!sameKeys(value, expected)) return false
  if (
    value.authorityEligible !== false
    || value.consumerHome !== "isolated"
    || value.mutationPerformed !== false
    || value.schemaVersion !== "consumer-authority-observer-preflight.1"
  ) return false
  if (value.state === "ready") {
    return value.credential === "usable"
      && value.fixtureAuthorization === "required"
      && value.next === "fixture-authorization"
  }
  return value.state === "blocked"
    && value.credential === "unusable"
    && value.fixtureAuthorization === "blocked"
    && typeof value.code === "string"
    && value.code.length > 0
    && value.code.length <= 128
    && (value.next === "host-github-authentication" || value.next === "github-actions-read-preflight")
}

export function observerPreflightWorkerEnvironment(token, home) {
  return {
    HOME: home,
    LANG: "C",
    LC_ALL: "C",
    PH_OBSERVER_PREFLIGHT_GITHUB_TOKEN: token,
  }
}

function authenticatedUserUrl() {
  return new URL("/user", API_ORIGIN)
}

function actionsSentinelUrl() {
  const url = new URL(`/repos/${FIXTURE_REPOSITORY}/actions/artifacts`, API_ORIGIN)
  url.searchParams.set("name", SENTINEL_NAME)
  url.searchParams.set("per_page", "1")
  return url
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "persona-harness-observer-preflight",
    "X-GitHub-Api-Version": API_VERSION,
  }
}

function requestGithubJson(url, headers) {
  if (!isFixedPreflightUrl(url)) return Promise.reject(new Error("observer-preflight-url"))
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers, timeout: REQUEST_TIMEOUT_MS }, (response) => {
      const contentLength = Number(response.headers["content-length"] ?? "0")
      if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > MAX_RESPONSE_BYTES) {
        response.resume()
        reject(new Error("observer-preflight-response"))
        return
      }
      const chunks = []
      let size = 0
      response.on("data", (chunk) => {
        size += chunk.length
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy()
          reject(new Error("observer-preflight-response"))
          return
        }
        chunks.push(chunk)
      })
      response.on("end", () => {
        try {
          resolve({ body: JSON.parse(Buffer.concat(chunks).toString("utf8")), statusCode: response.statusCode ?? 0 })
        } catch {
          reject(new Error("observer-preflight-response"))
        }
      })
      response.on("error", () => reject(new Error("observer-preflight-response")))
    })
    request.on("timeout", () => request.destroy(new Error("observer-preflight-timeout")))
    request.on("error", () => reject(new Error("observer-preflight-response")))
  })
}

function isFixedPreflightUrl(value) {
  return value instanceof URL
    && (value.toString() === authenticatedUserUrl().toString() || value.toString() === actionsSentinelUrl().toString())
}

function isAuthenticatedUser(value) {
  return isRecord(value) && isPositiveInteger(value.id)
}

function isArtifactList(value) {
  return isRecord(value)
    && isNonNegativeInteger(value.total_count)
    && Array.isArray(value.artifacts)
}

function ready() {
  return {
    authorityEligible: false,
    consumerHome: "isolated",
    credential: "usable",
    fixtureAuthorization: "required",
    mutationPerformed: false,
    next: "fixture-authorization",
    schemaVersion: "consumer-authority-observer-preflight.1",
    state: "ready",
  }
}

function blocked(code, next) {
  return {
    authorityEligible: false,
    code,
    consumerHome: "isolated",
    credential: "unusable",
    fixtureAuthorization: "blocked",
    mutationPerformed: false,
    next,
    schemaVersion: "consumer-authority-observer-preflight.1",
    state: "blocked",
  }
}

function isGithubToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,4096}$/u.test(value)
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function sameKeys(value, expected) {
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function isPositiveInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function isNonNegativeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}
