import { createHash } from "node:crypto"

import { describe, expect, it, vi } from "vitest"

import {
  authorityGithubRequestHeaders,
  ConsumerAuthorityArtifactFetchError,
  extractOriginalArtifactMembers,
  fetchConsumerAuthorityArtifact,
} from "../scripts/fetch-consumer-authority-artifact.mjs"

const SOURCE_HEAD = "a".repeat(40)
const REUSABLE_SHA = "b".repeat(40)

describe("consumer authority original artifact fetch", () => {
  it("uses the credential only for the fixed GitHub API origin", () => {
    const apiHeaders = authorityGithubRequestHeaders(
      new URL("https://api.github.com/repositories/987654321"),
      "github-test-credential",
    )
    const redirectHeaders = authorityGithubRequestHeaders(
      new URL("https://productionresultssa10.blob.core.windows.net/actions-results/example"),
      "github-test-credential",
    )

    expect(apiHeaders).toMatchObject({
      Authorization: "Bearer github-test-credential",
      "X-GitHub-Api-Version": "2022-11-28",
    })
    expect(redirectHeaders).not.toHaveProperty("Authorization")
    expect(JSON.stringify(redirectHeaders)).not.toContain("github-test-credential")
  })

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
      json: async (url) => responseFor(url, archive),
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

  it("maps structurally truncated ZIP metadata to the bounded archive diagnostic", () => {
    const archive = Buffer.alloc(72)
    archive.writeUInt32LE(0x02014b50, 45)
    archive.writeUInt32LE(0x06054b50, 50)
    archive.writeUInt16LE(3, 60)
    archive.writeUInt32LE(4, 62)
    archive.writeUInt32LE(45, 66)

    expect(() => extractOriginalArtifactMembers(archive)).toThrow(expect.objectContaining({
      code: "authority-fetch-archive",
    }))
  })

  it("fails closed when GitHub result totals show a truncated runs or artifacts page", async () => {
    const archive = archiveFor({
      "bundle.json": Buffer.from("bundle", "utf8"),
      "predicate.json": Buffer.from("predicate", "utf8"),
      "receipt.json": Buffer.from("receipt", "utf8"),
    })
    const selection = {
      callerWorkflowPath: "persona-harness.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      sourceHead: SOURCE_HEAD,
    }
    const archiveRead = vi.fn(async () => archive)

    for (const truncatedPath of ["runs", "artifacts"]) {
      await expect(fetchConsumerAuthorityArtifact(selection, {
        archive: archiveRead,
        json: async (url) => {
          const response = responseFor(url, archive)
          if (truncatedPath === "runs" && url.pathname.includes("/runs")) {
            return { ...response as Record<string, unknown>, total_count: 101 }
          }
          if (truncatedPath === "artifacts" && url.pathname.includes("/artifacts")) {
            return { ...response as Record<string, unknown>, total_count: 101 }
          }
          return response
        },
      })).rejects.toMatchObject({ code: "authority-fetch-evidence" })
    }

    expect(archiveRead).not.toHaveBeenCalled()
  })

  it("rejects artifact metadata whose repository binding or archive digest drifts", async () => {
    const archive = archiveFor({
      "bundle.json": Buffer.from("bundle", "utf8"),
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
      archive: async () => archive,
      json: async (url) => {
        const response = responseFor(url, archive)
        if (!url.pathname.includes("/artifacts")) return response
        const artifacts = (response as { artifacts: readonly Record<string, unknown>[] }).artifacts
        return {
          artifacts: artifacts.map((artifact) => ({
            ...artifact,
            workflow_run: {
              ...(artifact.workflow_run as Record<string, unknown>),
              repository_id: 123,
            },
          })),
          total_count: 1,
        }
      },
    })).rejects.toMatchObject({ code: "authority-fetch-evidence" })

    await expect(fetchConsumerAuthorityArtifact(selection, {
      archive: async () => archive,
      json: async (url) => {
        const response = responseFor(url, archive)
        if (!url.pathname.includes("/artifacts")) return response
        const artifacts = (response as { artifacts: readonly Record<string, unknown>[] }).artifacts
        return {
          artifacts: artifacts.map((artifact) => ({
            ...artifact,
            digest: `sha256:${"0".repeat(64)}`,
          })),
          total_count: 1,
        }
      },
    })).rejects.toMatchObject({ code: "authority-fetch-evidence" })
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
      json: async (url) => responseFor(url, unsafeArchive),
    })).rejects.toMatchObject({ code: "authority-fetch-archive" })
    await expect(fetchConsumerAuthorityArtifact(selection, {
      archive: async () => unsafeArchive,
      json: async () => ({ workflow_runs: [] }),
    })).rejects.toMatchObject({ code: "authority-fetch-policy" })
  })
})

function responseFor(url: URL, archive: Buffer): unknown {
  if (url.pathname === "/repositories/987654321") {
    return { full_name: "example/public-gradle-app", id: 987654321, private: false, visibility: "public" }
  }
  if (url.pathname.includes("/artifacts")) {
    return {
      artifacts: [{
        digest: `sha256:${createHash("sha256").update(archive).digest("hex")}`,
        expired: false,
        id: 11,
        name: "project-finish-attestation",
        size_in_bytes: archive.byteLength,
        workflow_run: {
          head_branch: "main",
          head_repository_id: 987654321,
          head_sha: SOURCE_HEAD,
          id: 10,
          repository_id: 987654321,
        },
      }],
      total_count: 1,
    }
  }
  if (url.pathname.includes("/runs")) {
    return {
      total_count: 1,
      workflow_runs: [{
        conclusion: "success",
        event: "push",
        head_branch: "main",
        head_repository: { full_name: "example/public-gradle-app", id: 987654321 },
        head_sha: SOURCE_HEAD,
        id: 10,
        repository: { full_name: "example/public-gradle-app", id: 987654321 },
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
