import { get } from "node:https"

const MAX_OIDC_RESPONSE_BYTES = 64 * 1024
const MAX_OIDC_TOKEN_BYTES = 16 * 1024
const GITHUB_ACTIONS_OIDC_ORIGIN = "https://pipelines.actions.githubusercontent.com"
const GITHUB_ACTIONS_OIDC_PREFIX = `${GITHUB_ACTIONS_OIDC_ORIGIN}/`
const OIDC_AUDIENCE = "persona-harness-project-finish-attestation"
const OIDC_PATH = /^\/(?:[A-Za-z0-9._~-]+\/)*[A-Za-z0-9._~-]+$/u
const OIDC_API_VERSION = /^\d+\.\d+(?:-preview\.\d+)?$/u
const OIDC_SERVICE_CONNECTION_ID = /^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$/u
const OIDC_SAFE_ENDPOINT = /^[A-Za-z0-9:/?&=._~-]+$/u

export async function readProjectFinishAttestationOidcClaims(environment = process.env) {
  const result = await readProjectFinishAttestationOidc(environment)
  return result.claims
}

export async function readProjectFinishAttestationOidc(environment = process.env) {
  const endpoint = boundedEnvironment(environment, "ACTIONS_ID_TOKEN_REQUEST_URL")
  const requestToken = boundedEnvironment(environment, "ACTIONS_ID_TOKEN_REQUEST_TOKEN")
  if (endpoint === undefined || requestToken === undefined) {
    return {
      audienceStatus: "missing",
      claims: undefined,
      endpointStatus: "missing",
      requestAttempted: false,
      tokenStatus: "missing",
    }
  }

  const url = parseGitHubActionsOidcEndpoint(endpoint)
  if (url === undefined) {
    return {
      audienceStatus: "missing",
      claims: undefined,
      endpointStatus: "mismatch",
      requestAttempted: false,
      tokenStatus: "missing",
    }
  }

  const response = await readJson(url, requestToken)
  if (!isRecord(response) || typeof response.value !== "string") {
    return {
      audienceStatus: "missing",
      claims: undefined,
      endpointStatus: "match",
      requestAttempted: true,
      tokenStatus: "missing",
    }
  }
  return decodeOidcToken(response.value, "match", true)
}

export function readProjectFinishAttestationOidcToken(token) {
  return decodeOidcToken(token, "match", true)
}

function decodeOidcToken(token, endpointStatus, requestAttempted) {
  if (!isBoundedToken(token)) {
    return {
      audienceStatus: "missing",
      claims: undefined,
      endpointStatus: "missing",
      requestAttempted: false,
      tokenStatus: "missing",
    }
  }
  const parts = token.split(".")
  if (parts.length !== 3 || parts[1] === undefined) {
    return {
      audienceStatus: "missing",
      claims: undefined,
      endpointStatus,
      requestAttempted,
      tokenStatus: "mismatch",
    }
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))
    if (!isRecord(payload)) {
      return {
        audienceStatus: "missing",
        claims: undefined,
        endpointStatus,
        requestAttempted,
        tokenStatus: "mismatch",
      }
    }
    return {
      audienceStatus: audienceStatus(payload.aud),
      claims: payload,
      endpointStatus,
      requestAttempted,
      tokenStatus: "match",
    }
  } catch {
    return {
      audienceStatus: "missing",
      claims: undefined,
      endpointStatus,
      requestAttempted,
      tokenStatus: "mismatch",
    }
  }
}

function audienceStatus(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 512 || /[\u0000\r\n]/u.test(value)) {
    return "missing"
  }
  return value === OIDC_AUDIENCE ? "match" : "mismatch"
}

function parseGitHubActionsOidcEndpoint(endpoint) {
  if (!endpoint.startsWith(GITHUB_ACTIONS_OIDC_PREFIX) || !OIDC_SAFE_ENDPOINT.test(endpoint)) {
    return undefined
  }
  try {
    const url = new URL(endpoint)
    if (
      url.protocol !== "https:" ||
      url.origin !== GITHUB_ACTIONS_OIDC_ORIGIN ||
      url.hostname !== "pipelines.actions.githubusercontent.com" ||
      url.port !== "" ||
      url.username !== "" ||
      url.password !== "" ||
      url.hash !== "" ||
      !OIDC_PATH.test(url.pathname) ||
      !hasCanonicalOidcQuery(url)
    ) {
      return undefined
    }
    url.searchParams.set("audience", OIDC_AUDIENCE)
    return url
  } catch {
    return undefined
  }
}

function hasCanonicalOidcQuery(url) {
  if (url.search === "") return true
  const entries = [...url.searchParams.entries()]
  if (entries.length !== 2) return false
  const values = new Map(entries)
  if (values.size !== 2 || values.get("api-version") === undefined || values.get("serviceConnectionId") === undefined) {
    return false
  }
  return OIDC_API_VERSION.test(values.get("api-version")) &&
    OIDC_SERVICE_CONNECTION_ID.test(values.get("serviceConnectionId"))
}

function readJson(url, requestToken) {
  return new Promise((resolve) => {
    let settled = false
    const settle = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    try {
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
          settle(undefined)
          return
        }
        response.on("data", (chunk) => {
          total += chunk.length
          if (total > MAX_OIDC_RESPONSE_BYTES) {
            request.destroy()
            response.resume()
            settle(undefined)
            return
          }
          chunks.push(chunk)
        })
        response.on("end", () => {
          if (settled) return
          try {
            settle(JSON.parse(Buffer.concat(chunks).toString("utf8")))
          } catch {
            settle(undefined)
          }
        })
        response.on("error", () => settle(undefined))
      })
      request.setTimeout(15_000, () => {
        request.destroy()
        settle(undefined)
      })
      request.on("error", () => settle(undefined))
    } catch {
      settle(undefined)
    }
  })
}

function boundedEnvironment(environment, key) {
  if (!isRecord(environment)) return undefined
  const value = environment[key]
  return typeof value === "string" && value.length > 0 && value.length <= 512 && !/[\u0000\r\n]/u.test(value)
    ? value
    : undefined
}

function isBoundedToken(value) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_OIDC_TOKEN_BYTES &&
    !/[\u0000\r\n]/u.test(value)
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
