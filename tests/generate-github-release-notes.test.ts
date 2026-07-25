import { describe, expect, it } from "vitest"

import { inferDistTag } from "../scripts/generate-github-release-notes.mjs"

describe("GitHub release note metadata", () => {
  it("describes a Consumer Authority beta as staging-first rather than an arbitrary beta channel", () => {
    expect(inferDistTag("0.8.0-beta.1")).toBe("staging")
  })
})
