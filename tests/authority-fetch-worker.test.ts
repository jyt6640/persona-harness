import { describe, expect, it } from "vitest"

import {
  parseGithubAuthorityFetchDiagnostic,
  parseFetchedArtifact,
} from "../src/cli/authority-fetch-worker.js"

describe("consumer authority fetch worker output", () => {
  it("accepts only the fixed bounded child output shape", () => {
    const archive = Buffer.from("original-archive", "utf8")

    expect(parseFetchedArtifact(JSON.stringify({
      archive: archive.toString("base64"),
      artifactId: 11,
      artifactDigest: `sha256:${"a".repeat(64)}`,
      ok: true,
      runId: "10",
    }))).toEqual({
      archive,
      artifactId: 11,
      artifactDigest: `sha256:${"a".repeat(64)}`,
      runId: "10",
    })
  })

  it.each([
    "not-json",
    JSON.stringify({ archive: "not-base64", artifactDigest: `sha256:${"a".repeat(64)}`, ok: true, runId: "10" }),
    JSON.stringify({ archive: Buffer.from("archive").toString("base64"), artifactId: 0, artifactDigest: `sha256:${"a".repeat(64)}`, ok: true, runId: "10" }),
    JSON.stringify({ archive: Buffer.from("archive").toString("base64"), artifactDigest: "bad", ok: true, runId: "10" }),
    JSON.stringify({ archive: Buffer.from("archive").toString("base64"), artifactDigest: `sha256:${"a".repeat(64)}`, ok: false, runId: "10", secret: "secret-marker" }),
  ])("blocks malformed child output without carrying supplied fields", (value) => {
    expect(parseFetchedArtifact(value)).toBeUndefined()
  })

  it.each([
    "authority-fetch-invalid",
    "authority-fetch-policy",
    "authority-fetch-evidence",
    "authority-fetch-network",
  ] as const)("accepts only the fixed %s child failure envelope", (code) => {
    expect(parseGithubAuthorityFetchDiagnostic(JSON.stringify({ code, ok: false }))).toBe(code)
  })

  it.each([
    "not-json",
    JSON.stringify({
      code: "authority-fetch-network",
      error: "error-marker",
      ok: false,
      path: "/private/path-marker",
      token: "token-marker",
      url: "https://example.invalid/url-marker",
    }),
    JSON.stringify({ code: "authority-fetch-unknown", ok: false }),
    JSON.stringify({ code: "authority-fetch-network", ok: true }),
  ])("does not carry malformed or caller-shaped child failure output", (value) => {
    expect(parseGithubAuthorityFetchDiagnostic(value)).toBeUndefined()
  })
})
