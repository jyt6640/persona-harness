import { describe, expect, it } from "vitest"

import {
  createAuthorityFetchChildEnvironment,
  createAuthorityFetchChildInput,
  parseGithubAuthorityFetchDiagnostic,
  parseFetchedArtifact,
} from "../src/cli/authority-fetch-worker.js"

describe("consumer authority fetch worker output", () => {
  it("serializes the child request in the canonical field order", () => {
    const sourceHead = "a".repeat(40)
    const digest = `sha256:${"b".repeat(64)}`
    const parsedTuple = {
      artifactId: 710000017,
      artifactDigest: digest,
      runId: "30470000000",
      sourceHead,
    }
    const input = createAuthorityFetchChildInput({
      callerWorkflowPath: "persona-harness.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
    }, sourceHead, parsedTuple)

    expect(Object.keys(input)).toEqual([
      "callerWorkflowPath",
      "expected",
      "repositoryId",
      "repositorySlug",
      "sourceHead",
    ])
    expect(Object.keys(input.expected)).toEqual([
      "artifactDigest",
      "artifactId",
      "runId",
      "sourceHead",
    ])
    expect(JSON.stringify(input)).toBe(JSON.stringify({
      callerWorkflowPath: "persona-harness.yml",
      expected: {
        artifactDigest: digest,
        artifactId: 710000017,
        runId: "30470000000",
        sourceHead,
      },
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      sourceHead,
    }))
  })

  it("uses the exact runtime-owned Linux child environment rather than an inherited envelope", () => {
    expect(createAuthorityFetchChildEnvironment("ghp_worker_marker", "linux")).toEqual({
      LANG: "C",
      LC_ALL: "C",
      PH_AUTHORITY_GITHUB_TOKEN: "ghp_worker_marker",
      UV_USE_IO_URING: "0",
    })
    expect(createAuthorityFetchChildEnvironment("ghp_worker_marker", "win32")).toBeUndefined()
  })

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
