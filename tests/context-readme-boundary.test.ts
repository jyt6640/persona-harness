import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

describe("Context README boundary", () => {
  it("keeps the public Context entrypoint explicit about activation, authority, host, evidence, and product focus", () => {
    const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8")
    const boundaryStart = readme.indexOf("### Context Boundary")
    const boundaryEnd = readme.indexOf("Context configuration is separate", boundaryStart)

    expect(boundaryStart).toBeGreaterThanOrEqual(0)
    expect(boundaryEnd).toBeGreaterThan(boundaryStart)

    const boundary = readme.slice(boundaryStart, boundaryEnd)
    for (const marker of [
      "**Activation:**",
      "`context.enabled`",
      "default-off",
      "**Authority:**",
      "non-authoritative",
      "**Isolation:**",
      "GitHub/network",
      "**Host:**",
      "OpenCode",
      "**Evidence:**",
      "`INCONCLUSIVE`",
      "**Product focus:**",
      "Java/Spring",
      "TypeScript reference",
    ]) {
      expect(boundary).toContain(marker)
    }
  })
})
