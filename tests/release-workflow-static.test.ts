import { spawnSync } from "node:child_process"

import { describe, expect, it } from "vitest"

describe("CI and release workflow policy surface", () => {
  it("passes the repository workflow policy checker", () => {
    const result = spawnSync(process.execPath, ["scripts/check-release-workflows.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Release workflow policy: PASS")
  })
})
