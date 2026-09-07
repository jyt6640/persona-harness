import * as fs from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { withNoFollowDirectoryChain } from "../src/io/no-follow-directory-chain.js"
import { cleanupProjects, createProject } from "./helpers/rule-fixtures.js"

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>()
  return { ...actual, openSync: vi.fn(actual.openSync) }
})

afterEach(() => { vi.resetAllMocks(); cleanupProjects() })

describe("directory reservation metadata", () => {
  it.each(["sibling", "replacement"] as const)("distinguishes %s changes while opening an ancestor", async (change) => {
    const root = fs.realpathSync(createProject())
    const shared = join(root, "shared")
    const outside = fs.realpathSync(createProject())
    fs.mkdirSync(shared)
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs")
    let changed = false
    vi.mocked(fs.openSync).mockImplementation((...args) => {
      if (!changed && args[0] === "shared") {
        changed = true
        if (change === "sibling") fs.writeFileSync(join(shared, "unrelated.txt"), "other process\n")
        else {
          fs.renameSync(shared, join(root, "original"))
          fs.symlinkSync(outside, shared, "dir")
        }
      }
      return actual.openSync(...args)
    })
    const result = withNoFollowDirectoryChain(join(shared, "store"), 0o700, () => {
      fs.writeFileSync("profile.json", "{}\n")
      return true
    })
    expect(changed).toBe(true)
    expect(result).toBe(change === "sibling" ? true : undefined)
    expect(fs.readdirSync(outside)).toEqual([])
  })
})
