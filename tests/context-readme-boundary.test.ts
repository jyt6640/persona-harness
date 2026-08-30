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

  it("documents an explicit and reversible Context lifecycle without inventing mutation commands", () => {
    const readme = readFileSync(resolve(process.cwd(), "README.md"), "utf8")
    const lifecycleStart = readme.indexOf("### Context Lifecycle")
    const lifecycleEnd = readme.indexOf("With Context enabled", lifecycleStart)

    expect(lifecycleStart).toBeGreaterThanOrEqual(0)
    expect(lifecycleEnd).toBeGreaterThan(lifecycleStart)

    const lifecycle = readme.slice(lifecycleStart, lifecycleEnd)
    for (const marker of [
      "npx ph context status",
      "npx ph context init --enable",
      "does not overwrite",
      "`context.enabled` to `false`",
      "Remove only the `context` object",
      "`features.runtimeInjection`",
      "workflow, evidence, or authority",
      "network or GitHub",
    ]) {
      expect(lifecycle).toContain(marker)
    }
    expect(lifecycle).toMatch(/restore\s+the previous tracked configuration/)
  })
})
