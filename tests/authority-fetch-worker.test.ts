import { describe, expect, it } from "vitest"

import { parseFetchedArtifact } from "../src/cli/authority-fetch-worker.js"

describe("consumer authority fetch worker output", () => {
  it("accepts only the fixed bounded child output shape", () => {
    const archive = Buffer.from("original-archive", "utf8")

    expect(parseFetchedArtifact(JSON.stringify({
      archive: archive.toString("base64"),
      artifactDigest: `sha256:${"a".repeat(64)}`,
      ok: true,
      runId: "10",
    }))).toEqual({
      archive,
      artifactDigest: `sha256:${"a".repeat(64)}`,
      runId: "10",
    })
  })

  it.each([
    "not-json",
    JSON.stringify({ archive: "not-base64", artifactDigest: `sha256:${"a".repeat(64)}`, ok: true, runId: "10" }),
    JSON.stringify({ archive: Buffer.from("archive").toString("base64"), artifactDigest: "bad", ok: true, runId: "10" }),
    JSON.stringify({ archive: Buffer.from("archive").toString("base64"), artifactDigest: `sha256:${"a".repeat(64)}`, ok: false, runId: "10", secret: "secret-marker" }),
  ])("blocks malformed child output without carrying supplied fields", (value) => {
    expect(parseFetchedArtifact(value)).toBeUndefined()
  })
})
