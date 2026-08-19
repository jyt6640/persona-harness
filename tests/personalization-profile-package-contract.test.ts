import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const repositoryRoot = process.cwd()

describe("personalization profile package contract", () => {
  it("ships the public philosophy implementation and its selected v1 contract", () => {
    const packageJson = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as {
      readonly files: readonly string[]
    }
    expect(packageJson.files).toContain("dist")
    expect(packageJson.files).toContain("docs/current/personalization-profile-v1.md")
    expect(existsSync(join(repositoryRoot, "src/cli/personalization-profile-model.ts"))).toBe(true)
    expect(existsSync(join(repositoryRoot, "src/cli/personalization-profile-store.ts"))).toBe(true)
    expect(existsSync(join(repositoryRoot, "src/cli/philosophy-command.ts"))).toBe(true)
  })
})
