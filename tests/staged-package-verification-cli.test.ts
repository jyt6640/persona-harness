import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const scriptPath = resolve(process.cwd(), "scripts/staged-package-verification.mjs")

function invoke(args: readonly string[]) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: "utf8",
    maxBuffer: 128 * 1024,
  })
}

describe("staged package verification CLI", () => {
  it("documents its read-only and non-promoting boundary", () => {
    const result = invoke(["--help"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("never publishes, tags, moves a dist-tag")
    expect(result.stdout).toContain("authorizes channel promotion")
    expect(result.stderr).toBe("")
  })

  it("fails with bounded diagnostics without reflecting hostile input paths", () => {
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const hostilePath = `/private/tmp/${secret}/staged-package-fact.json`
    const result = invoke([
      "--plan",
      hostilePath,
      "--preflight",
      hostilePath,
      "--registry-facts",
      hostilePath,
      "--tarball",
      hostilePath,
      "--json",
    ])
    const output = `${result.stdout}\n${result.stderr}`

    expect(result.status).toBe(1)
    expect(output).toContain("staged-plan-invalid")
    expect(output).not.toContain(secret)
    expect(output).not.toContain("/private/tmp/")
    expect(output).toContain('"promotionAuthorized": false')
    expect(output).toContain('"registryMutation": "not-performed"')
  })
})
