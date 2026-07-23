import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { describe, expect, it } from "vitest"

const repositoryRoot = process.cwd()

describe("direct Sigstore worker runtime floor", () => {
  it.each([
    ["verify-finish-attestation.mjs", "20.16.9"],
    ["verify-project-finish-attestation.mjs", "22.8.9"],
  ])("blocks %s before Sigstore import on an unsupported runtime", (scriptName, runtimeVersion) => {
    const scriptUrl = pathToFileURL(join(repositoryRoot, "scripts", scriptName)).href
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `Object.defineProperty(process.versions, "node", { configurable: true, value: ${JSON.stringify(runtimeVersion)} }); await import(${JSON.stringify(scriptUrl)});`,
      ],
      { cwd: repositoryRoot, encoding: "utf8" },
    )

    expect(result.status).toBe(1)
    expect(result.stdout).toBe(JSON.stringify({ ok: false, state: "runtime-unsupported" }))
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(runtimeVersion)
    expect(`${result.stdout}\n${result.stderr}`).not.toContain("sk-live-")
  })
})
