import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { canonicalAuthorityArchivePath, readExplicitAuthorityArchive } from "../src/cli/authority-archive-input.js"

describe("authority archive input", () => {
  it("canonicalizes only the root-owned Darwin system temporary alias", () => {
    expect(canonicalAuthorityArchivePath("/tmp/attestation/original.zip", {
      darwinTemporaryAlias: {
        gid: 0n,
        isSymbolicLink: true,
        target: "private/tmp",
        uid: 0n,
      },
      platform: "darwin",
    })).toBe("/private/tmp/attestation/original.zip")
  })

  it("rejects a Darwin temporary alias that is not root-owned", () => {
    expect(canonicalAuthorityArchivePath("/tmp/attestation/original.zip", {
      darwinTemporaryAlias: {
        gid: 501n,
        isSymbolicLink: true,
        target: "private/tmp",
        uid: 501n,
      },
      platform: "darwin",
    })).toBeUndefined()
  })

  it("rejects a root-owned Darwin alias with a different target", () => {
    expect(canonicalAuthorityArchivePath("/tmp/attestation/original.zip", {
      darwinTemporaryAlias: {
        gid: 0n,
        isSymbolicLink: true,
        target: "elsewhere/tmp",
        uid: 0n,
      },
      platform: "darwin",
    })).toBeUndefined()
  })

  it("does not treat a lookalike path as the Darwin system temporary alias", () => {
    expect(canonicalAuthorityArchivePath("/tmp-attestation/original.zip", {
      platform: "darwin",
    })).toBe("/tmp-attestation/original.zip")
  })

  it("leaves non-Darwin archive paths unchanged", () => {
    expect(canonicalAuthorityArchivePath("/tmp/attestation/original.zip", {
      platform: "linux",
    })).toBe("/tmp/attestation/original.zip")
  })

  const darwinIt = process.platform === "darwin" ? it : it.skip

  darwinIt("reads a regular archive supplied through the Darwin system temporary alias", () => {
    const root = mkdtempSync("/tmp/persona-harness-authority-archive-")
    const archivePath = join(root, "original.zip")
    const archive = Buffer.from("archive-input", "utf8")
    try {
      writeFileSync(archivePath, archive)
      expect(readExplicitAuthorityArchive(archivePath)).toEqual(archive)
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("accepts an archive while an ancestor receives unrelated directory entries", async () => {
    // Given
    const root = mkdtempSync(join(realpathSync(process.cwd()), ".persona-harness-authority-archive-"))
    const archiveDirectory = join(root, "archive")
    const archivePath = join(archiveDirectory, "original.zip")
    const archive = Buffer.alloc(1024 * 1024, 1)
    const churn = spawn(process.execPath, ["--input-type=module", "-e", `
      import { mkdirSync, rmSync } from "node:fs"
      import { join } from "node:path"
      const root = process.argv[1]
      if (root === undefined) process.exit(1)
      process.stdout.write("ready\\n")
      let index = 0
      for (;;) {
        const entry = join(root, \`entry-\${index}\`)
        mkdirSync(entry)
        rmSync(entry)
        index = (index + 1) % 8
      }
    `, root], { stdio: ["ignore", "pipe", "ignore"] })
    if (churn.stdout === null) throw new Error("ancestor churn stdout unavailable")

    try {
      mkdirSync(archiveDirectory)
      writeFileSync(archivePath, archive)
      await once(churn.stdout, "data")

      // When / Then
      for (let attempt = 0; attempt < 16; attempt += 1) {
        const received = readExplicitAuthorityArchive(archivePath)
        expect(received?.equals(archive)).toBe(true)
      }
    } finally {
      if (churn.exitCode === null) {
        churn.kill()
        await once(churn, "exit")
      }
      rmSync(root, { force: true, recursive: true })
    }
  })
})
