import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const oidcModuleUrl = pathToFileURL(join(root, "scripts", "project-finish-attestation-oidc.mjs")).href
const secret = "OIDC_ENDPOINT_SECRET_sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"

describe("project finish attestation OIDC endpoint", () => {
  it("does not attach a bearer token to an arbitrary HTTPS endpoint", () => {
    const result = probe(`https://untrusted.example/oidc/${secret}`)

    expect(result).toEqual({
      bearerAttached: false,
      calls: 0,
      claimsRead: false,
    })
  })

  it.each([
    "https://Pipelines.Actions.Githubusercontent.com/oidc",
    "https://pipelines.actions.githubusercontent.com.untrusted.example/oidc",
    "https://user@pipelines.actions.githubusercontent.com/oidc",
    "https://pipelines.actions.githubusercontent.com:443/oidc",
    "https://127.0.0.1/oidc",
    "https://[::1]/oidc",
    "https://pipelines.actions.githubusercontent.com/oidc?redirect=https://untrusted.example/oidc",
    "https://pipelines.actions.githubusercontent.com%2euntrusted.example/oidc",
  ])("rejects hostile endpoint syntax without dispatching a request", (endpoint) => {
    const result = probe(endpoint)

    expect(result).toEqual({
      bearerAttached: false,
      calls: 0,
      claimsRead: false,
    })
  })

  it("uses the fixed GitHub Actions endpoint with an in-memory transport hook", () => {
    const result = probe(
      "https://pipelines.actions.githubusercontent.com/oidc?api-version=7.1&serviceConnectionId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    )

    expect(result).toEqual({
      bearerAttached: true,
      calls: 1,
      claimsRead: true,
    })
  })

  it("does not follow a response redirect after a canonical OIDC request", () => {
    const result = probe(
      "https://pipelines.actions.githubusercontent.com/oidc?api-version=7.1&serviceConnectionId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "redirect",
    )

    expect(result).toEqual({
      bearerAttached: true,
      calls: 1,
      claimsRead: false,
    })
  })
})

function probe(endpoint: string, responseKind: "success" | "redirect" = "success"): ProbeResult {
  const token = `header.${Buffer.from(JSON.stringify({
    aud: "persona-harness-project-finish-attestation",
    iss: "https://token.actions.githubusercontent.com",
  })).toString("base64url")}.signature`
  const script = `
import { EventEmitter } from "node:events"
import { createRequire, syncBuiltinESMExports } from "node:module"

const require = createRequire(import.meta.url)
const https = require("node:https")
let calls = 0
let bearerAttached = false
https.get = (_url, options, callback) => {
  calls += 1
  bearerAttached = typeof options?.headers?.authorization === "string"
  const request = new EventEmitter()
  request.destroy = () => request
  request.setTimeout = () => request
  queueMicrotask(() => {
    const response = new EventEmitter()
    response.headers = ${JSON.stringify(responseKind === "redirect" ? { location: "https://untrusted.example/oidc" } : {})}
    response.resume = () => undefined
    response.statusCode = ${responseKind === "redirect" ? "302" : "200"}
    callback(response)
    if (response.statusCode === 200) {
      response.emit("data", Buffer.from(JSON.stringify({ value: ${JSON.stringify(token)} })))
      response.emit("end")
    }
  })
  return request
}
syncBuiltinESMExports()
const { readProjectFinishAttestationOidcClaims } = await import(${JSON.stringify(oidcModuleUrl)})
const claims = await readProjectFinishAttestationOidcClaims({
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: ${JSON.stringify(secret)},
  ACTIONS_ID_TOKEN_REQUEST_URL: ${JSON.stringify(endpoint)},
})
process.stdout.write(JSON.stringify({ bearerAttached, calls, claimsRead: claims !== undefined }) + "\\n")
`
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: root,
    encoding: "utf8",
  })
  const output = `${result.stdout}${result.stderr}`

  expect(result.status).toBe(0)
  expect(output).not.toContain(secret)
  expect(output).not.toContain(endpoint)
  return JSON.parse(result.stdout) as ProbeResult
}

type ProbeResult = {
  readonly bearerAttached: boolean
  readonly calls: number
  readonly claimsRead: boolean
}
