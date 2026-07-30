import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { afterEach, describe, expect, it } from "vitest"

const root = process.cwd()
const script = join(root, "scripts", "preflight-consumer-authority-observer.mjs")
const temporaryRoots: string[] = []

afterEach(() => {
  for (const path of temporaryRoots.splice(0)) rmSync(path, { force: true, recursive: true })
})

describe("public observer credential-preflight script", () => {
  it("uses host gh without ambient credentials and blocks before discovery on host retrieval failure", () => {
    const fixture = temporaryRoot()
    const hostHome = join(fixture, "host-home")
    const bin = join(fixture, "bin")
    const gh = join(bin, "gh")
    const marker = join(bin, "gh-ran")
    writeFileSync(gh, [
      "#!/bin/sh",
      "if [ -n \"$GH_TOKEN$GITHUB_TOKEN\" ]; then exit 88; fi",
      `if [ \"$HOME\" != ${JSON.stringify(hostHome)} ]; then exit 89; fi`,
      `: > ${JSON.stringify(marker)}`,
      "exit 1",
      "",
    ].join("\n"))
    chmodSync(gh, 0o755)

    const result = spawnSync(process.execPath, [script, "--json"], {
      cwd: fixture,
      encoding: "utf8",
      env: {
        GH_TOKEN: "ghp_ambient_must_not_cross",
        GITHUB_TOKEN: "ghp_ambient_must_not_cross",
        HOME: hostHome,
        PATH: bin,
      },
    })

    expect(result.status).toBe(1)
    expect(existsSync(marker)).toBe(true)
    expect(`${result.stdout}${result.stderr}`).not.toContain("ghp_ambient_must_not_cross")
    expect(`${result.stdout}${result.stderr}`).not.toContain(hostHome)
    expect(JSON.parse(result.stdout)).toMatchObject({
      authorityEligible: false,
      code: "host-gh-auth-unavailable",
      credential: "unusable",
      fixtureAuthorization: "blocked",
      mutationPerformed: false,
      state: "blocked",
    })
    expect(readFileSync(gh, "utf8")).not.toContain("npm")
  })

  it("rejects arbitrary arguments without attempting host credential retrieval", () => {
    const fixture = temporaryRoot()
    const result = spawnSync(process.execPath, [script, "--endpoint", "https://untrusted.example"], {
      cwd: fixture,
      encoding: "utf8",
      env: { HOME: join(fixture, "home"), PATH: join(fixture, "empty-bin") },
    })

    expect(result.status).toBe(1)
    expect(result.stdout).toBe("")
    expect(result.stderr).toContain("Usage:")
    expect(result.stderr).not.toContain("untrusted.example")
  })
})

function temporaryRoot(): string {
  const path = mkdtempSync(join(tmpdir(), "persona-observer-preflight-cli-"))
  temporaryRoots.push(path)
  const bin = join(path, "bin")
  mkdirSync(bin, { recursive: true })
  return path
}
