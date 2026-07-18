import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const docs = [
  "docs/current/canonical-docs-index.md",
  "docs/current/docs-inventory.md",
  "docs/current/consumer-authority-v1-decision.md",
] as const

describe("consumer authority documentation contract", () => {
  it("describes cooperative Finish as same-invocation and non-persistent", () => {
    for (const path of docs) {
      const source = readFileSync(join(process.cwd(), path), "utf8")

      expect(source).toContain("workflow finish implement --assurance cooperative")
      expect(source).toMatch(/same[- ]invocation|same Finish invocation|that Finish invocation/iu)
      expect(source).toMatch(
        /non-persistent|one-time in-memory consumption|consumed in memory only/iu,
      )
      expect(source).toMatch(/status\/fetch\/later closure|status, evidence fetch, and `workflow closure next --json`/iu)
      expect(source).toMatch(/default\/external boundaries remain blocked|external-only and\nblock/iu)
    }
  })
})
