import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { withNoFollowDirectoryChain } from "../src/io/no-follow-directory-chain.js"

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true })
  }
})

describe("no-follow directory chain", () => {
  it("keeps relative writes in the reserved directory when its path is replaced", () => {
    const parent = temporaryRoot("persona-no-follow-directory-chain-")
    const outside = temporaryRoot("persona-no-follow-directory-chain-outside-")
    const requestedRoot = join(parent, "state")
    const movedRoot = join(parent, "moved-state")
    const originalCwd = process.cwd()

    const result = withNoFollowDirectoryChain(requestedRoot, 0o700, () => {
      renameSync(requestedRoot, movedRoot)
      symlinkSync(outside, requestedRoot, "dir")
      writeFileSync("event.jsonl", "reserved\n")
      return true
    })

    expect(result).toBe(true)
    expect(process.cwd()).toBe(originalCwd)
    expect(readFileSync(join(movedRoot, "event.jsonl"), "utf8")).toBe("reserved\n")
    expect(existsSync(join(outside, "event.jsonl"))).toBe(false)
  })
})

function temporaryRoot(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  temporaryRoots.push(root)
  return root
}
