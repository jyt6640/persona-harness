import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("public platform support matrix", () => {
  it.each(["README.md", "docs/START-HERE.md"])("keeps the same honest matrix in %s", (relativePath) => {
    const content = readFileSync(join(root, relativePath), "utf8")

    expect(content).toContain("| macOS / Linux + OpenCode | Verified")
    expect(content).toContain("| Windows | Unverified")
    expect(content).toContain("device/inode")
    expect(content).toContain("| Codex adapter | Planned")
    expect(content).toContain("No Windows support claim")
    expect(content).not.toContain("Codex adapter | Verified")
  })
})
