import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("public platform support matrix", () => {
  it.each(["README.md", "docs/START-HERE.md"])("keeps the same honest matrix in %s", (relativePath) => {
    const content = readFileSync(join(root, relativePath), "utf8")

    expect(content).toContain("| Linux + OpenCode | Supported matrix | Node 20, 22, and 24")
    expect(content).toContain("| macOS + OpenCode | Limited smoke | macOS Node 22 smoke only")
    expect(content).toContain("not a promise of macOS Node 20/24 coverage")
    expect(content).toContain("| Windows | Unverified / nonblocking")
    expect(content).toContain("No Windows matrix job or support claim")
    expect(content).toContain("device/inode")
    expect(content).toContain("| Codex adapter | Planned")
    expect(content).not.toContain("Codex adapter | Verified")
  })
})
