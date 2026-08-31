import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("public platform support matrix", () => {
  it.each([
    "README.md",
    "docs/current/README.ko.md",
    "docs/current/README.ja.md",
    "docs/current/README.zh-cn.md",
    "docs/START-HERE.md",
    "docs/current/java-backend-mvp-install-guide.md",
  ])("states the published Sigstore Node floor in %s", (relativePath) => {
    const content = readFileSync(join(root, relativePath), "utf8")

    expect(content).toContain("Node.js ^20.17.0 || >=22.9.0")
  })

  it.each(["README.md", "docs/START-HERE.md"])("keeps the CLI matrix and portable host layouts distinct in %s", (relativePath) => {
    const content = readFileSync(join(root, relativePath), "utf8")

    expect(content).toContain("### Portable host adapters")
    expect(content).toContain("| Codex and Antigravity | `.agents/skills/persona-harness-<skill-id>/SKILL.md` |")
    expect(content).toContain("| Claude Code | `.claude/skills/persona-harness-claude-<skill-id>/SKILL.md` |")
    expect(content).toContain("| OpenCode | `.opencode/skills/persona-harness-opencode-<skill-id>/SKILL.md` |")
    expect(content).toContain("| Linux CLI/package | Product: Node ^20.17.0 || >=22.9.0; source checks: Node 20.19.0")
    expect(content).toContain("Required Verify repository aggregates PR fast feedback and main package integration")
    expect(content).toContain("Pull requests run policy, typecheck, build, and the two Vitest projects; main pushes additionally run Linux Node 20.19.0 source-built, packed-tarball, and fresh local-tarball installed checks")
    expect(content).toContain("dispatch-only support matrix retains exact product-floor Linux Node 20.17.0 and 22.9.0 imports plus latest Linux Node 20, 22, and 24 on demand")
    expect(content).toContain("| macOS CLI/package | Manual limited smoke | The dispatch-only support matrix retains macOS Node 22 smoke only")
    expect(content).toContain("not a promise of macOS Node 20/24 coverage")
    expect(content).toContain("Automatic CI boundary: Verify repository is the required PR/main aggregate")
    expect(content).toContain("canonical clean-CI builder's main-push signed evidence")
    expect(content).toContain("ordinary path-filtered diagnostic selftest")
    expect(content).toContain("| Windows | Unverified / nonblocking")
    expect(content).toContain("No Windows matrix job or support claim")
    expect(content).toContain("device/inode")
    expect(content).not.toContain("| Codex adapter | Planned")
  })
})
