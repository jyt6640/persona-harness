import { get } from "node:https"

const MAX_OIDC_RESPONSE_BYTES = 64 * 1024

export async function readProjectFinishAttestationOidcClaims(environment = process.env) {
  const endpoint = boundedEnvironment(environment, "ACTIONS_ID_TOKEN_REQUEST_URL")
  const requestToken = boundedEnvironment(environment, "ACTIONS_ID_TOKEN_REQUEST_TOKEN")
  if (endpoint === undefined || requestToken === undefined) return undefined

  let url
  try {
    url = new URL(endpoint)
  } catch {
    return undefined
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.hash !== "") {
    return undefined
  }
  url.searchParams.set("audience", "persona-harness-project-finish-attestation")
  const response = await readJson(url, requestToken)
  if (!isRecord(response) || typeof response.value !== "string") return undefined
  const parts = response.value.split(".")
  if (parts.length !== 3 || parts[1] === undefined) return undefined
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))
    return isRecord(payload) ? payload : undefined
  } catch {
    return undefined
  }
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

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
