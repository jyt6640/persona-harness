import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("public platform support matrix", () => {
  it.each(["README.md", "docs/START-HERE.md"])("keeps the same honest matrix in %s", (relativePath) => {
    const content = readFileSync(join(root, relativePath), "utf8")

    expect(content).toContain("| Linux + OpenCode | Required Node 20; manual Node 22/24")
    expect(content).toContain("Required Verify repository runs Linux Node 20 source-built and fresh local-tarball installed checks")
    expect(content).toContain("dispatch-only support matrix retains Linux Node 22 and 24 on demand")
    expect(content).toContain("| macOS + OpenCode | Manual limited smoke | The dispatch-only support matrix retains macOS Node 22 smoke only")
    expect(content).toContain("not a promise of macOS Node 20/24 coverage")
    expect(content).toContain("Automatic CI boundary: Verify repository is the required Linux Node 20 PR/main gate")
    expect(content).toContain("canonical clean-CI builder's main-push signed evidence")
    expect(content).toContain("ordinary path-filtered diagnostic selftest")
    expect(content).toContain("| Windows | Unverified / nonblocking")
    expect(content).toContain("No Windows matrix job or support claim")
    expect(content).toContain("device/inode")
    expect(content).toContain("| Codex adapter | Planned")
    expect(content).not.toContain("Codex adapter | Verified")
  })
})
