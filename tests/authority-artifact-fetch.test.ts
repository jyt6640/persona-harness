import { createHash } from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  ConsumerAuthorityArtifactFetchError,
  extractOriginalArtifactMembers,
  fetchConsumerAuthorityArtifact,
} from "../scripts/fetch-consumer-authority-artifact.mjs"

const SOURCE_HEAD = "a".repeat(40)
const REUSABLE_SHA = "b".repeat(40)

describe("consumer authority original artifact fetch", () => {
  it("accepts only one fixed public push/main artifact bound to the requested source", async () => {
    const archive = archiveFor({
      "bundle.json": Buffer.from("bundle", "utf8"),
      "predicate.json": Buffer.from("predicate", "utf8"),
      "receipt.json": Buffer.from("receipt", "utf8"),
    })

    const result = await fetchConsumerAuthorityArtifact({
      callerWorkflowPath: "persona-harness.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      sourceHead: SOURCE_HEAD,
    }, {
      archive: async () => archive,
      json: async (url) => responseFor(url),
    })

    expect(result).toMatchObject({
      artifactDigest: `sha256:${createHash("sha256").update(archive).digest("hex")}`,
      bundle: Buffer.from("bundle", "utf8"),
      predicate: Buffer.from("predicate", "utf8"),
      receipt: Buffer.from("receipt", "utf8"),
      runId: "10",
    })
  })

  it("rejects a central-directory entry whose local header names a different artifact member", () => {
    const archive = archiveFor({
      "bundle.json": Buffer.from("bundle", "utf8"),
      "predicate.json": Buffer.from("predicate", "utf8"),
      "receipt.json": Buffer.from("receipt", "utf8"),
    }, new Map([["bundle.json", "receipt.json"]]))

    try {
      extractOriginalArtifactMembers(archive)
      throw new Error("expected archive rejection")
    } catch (error) {
      expect(error).toBeInstanceOf(ConsumerAuthorityArtifactFetchError)
      expect(error).toMatchObject({ code: "authority-fetch-archive" })
    }
  })

  it("blocks duplicate, unsafe, and unbound evidence without reflecting supplied content", async () => {
    const unsafeArchive = archiveFor({
      "../bundle.json": Buffer.from("secret-marker", "utf8"),
      "predicate.json": Buffer.from("predicate", "utf8"),
      "receipt.json": Buffer.from("receipt", "utf8"),
    })
    const selection = {
      callerWorkflowPath: "persona-harness.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      sourceHead: SOURCE_HEAD,
    }

    await expect(fetchConsumerAuthorityArtifact(selection, {
      archive: async () => unsafeArchive,
      json: async (url) => responseFor(url),
    })).rejects.toMatchObject({ code: "authority-fetch-archive" })
    await expect(fetchConsumerAuthorityArtifact(selection, {
      archive: async () => unsafeArchive,
      json: async () => ({ workflow_runs: [] }),
    })).rejects.toMatchObject({ code: "authority-fetch-policy" })
  })
})

function responseFor(url: URL): unknown {
  if (url.pathname === "/repositories/987654321") {
    return { full_name: "example/public-gradle-app", id: 987654321, private: false, visibility: "public" }
  }
  if (url.pathname.includes("/artifacts")) {
    return { artifacts: [{ expired: false, id: 11, name: "project-finish-attestation", size_in_bytes: 1024 }] }
  }
  if (url.pathname.includes("/runs")) {
    return {
      workflow_runs: [{
        conclusion: "success",
        event: "push",
        head_branch: "main",
        head_sha: SOURCE_HEAD,
        id: 10,
        status: "completed",
      }],
    }
  }
  return { reusableWorkflowSha: REUSABLE_SHA }
}

function archiveFor(
  members: Readonly<Record<string, Buffer>>,
  localNames: ReadonlyMap<string, string> = new Map(),
): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0
  for (const [name, bytes] of Object.entries(members)) {
    const localName = Buffer.from(localNames.get(name) ?? name, "utf8")
    const centralName = Buffer.from(name, "utf8")
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(bytes.byteLength, 18)
    local.writeUInt32LE(bytes.byteLength, 22)
    local.writeUInt16LE(localName.byteLength, 26)
    localParts.push(local, localName, bytes)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(bytes.byteLength, 20)
    central.writeUInt32LE(bytes.byteLength, 24)
    central.writeUInt16LE(centralName.byteLength, 28)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, centralName)
    offset += local.byteLength + localName.byteLength + bytes.byteLength
  }
  const centralDirectory = Buffer.concat(centralParts)
  const footer = Buffer.alloc(22)
  footer.writeUInt32LE(0x06054b50, 0)
  footer.writeUInt16LE(Object.keys(members).length, 8)
  footer.writeUInt16LE(Object.keys(members).length, 10)
  footer.writeUInt32LE(centralDirectory.byteLength, 12)
  footer.writeUInt32LE(offset, 16)
  return Buffer.concat([...localParts, centralDirectory, footer])
}
