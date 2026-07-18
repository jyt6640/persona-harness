import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const verifierPath = join(root, "scripts", "verify-project-finish-producer-checkout.mjs")
const secretMarker = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"

describe("project finish attestation producer checkout identity", () => {
  it.each([
    ["the GitHub Actions HTTPS origin without .git", "https://github.com/jyt6640/persona-harness"],
    ["the optional .git HTTPS origin", "https://github.com/jyt6640/persona-harness.git"],
  ])("accepts %s while binding the checked-out immutable SHA", (_name, origin) => {
    const result = runCheckoutVerifier(origin)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })

  it("rejects a different checked-out SHA even with the canonical action origin", () => {
    const result = runCheckoutVerifier(
      "https://github.com/jyt6640/persona-harness",
      "a".repeat(40),
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("project-finish-producer-checkout-origin-identity")
  })

  it.each([
    ["credentialed HTTPS origin", `https://x-access-token:${secretMarker}@github.com/jyt6640/persona-harness`],
    ["wrong repository", "https://github.com/jyt6640/other-repository"],
    ["wrong host", "https://github.example/jyt6640/persona-harness"],
    ["noncanonical path", "https://github.com/jyt6640/persona-harness/"],
    ["SSH origin", "git@github.com:jyt6640/persona-harness.git"],
    ["HTTP origin", "http://github.com/jyt6640/persona-harness"],
    ["HTTPS userinfo", "https://user@github.com/jyt6640/persona-harness"],
    ["query origin", "https://github.com/jyt6640/persona-harness?ref=main"],
    ["fragment origin", "https://github.com/jyt6640/persona-harness#main"],
  ])("fails closed for a hostile %s without reflecting it", (_name, origin) => {
    const result = runCheckoutVerifier(origin)
    const rendered = `${result.stdout}${result.stderr}`

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("project-finish-producer-checkout-origin-identity")
    expect(rendered).not.toContain(secretMarker)
    expect(rendered).not.toContain(origin)
  })
})

function runCheckoutVerifier(origin: string, expectedHead?: string): {
  readonly status: number | null
  readonly stderr: string
  readonly stdout: string
} {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "project-finish-producer-checkout-"))

  try {
    runGit(fixtureDirectory, ["init"])
    runGit(fixtureDirectory, ["config", "user.email", "fixture@example.test"])
    runGit(fixtureDirectory, ["config", "user.name", "Fixture"])
    writeFileSync(join(fixtureDirectory, "README.md"), "fixture\n")
    runGit(fixtureDirectory, ["add", "README.md"])
    runGit(fixtureDirectory, ["commit", "--no-gpg-sign", "-m", "fixture"])
    runGit(fixtureDirectory, ["remote", "add", "origin", origin])

    const head = runGit(fixtureDirectory, ["rev-parse", "HEAD"]).trim()
    const result = spawnSync(process.execPath, [verifierPath], {
      cwd: fixtureDirectory,
      encoding: "utf8",
      env: {
        ...process.env,
        PERSONA_HARNESS_PRODUCER_SHA: expectedHead ?? head,
      },
    })

    return {
      status: result.status,
      stderr: result.stderr,
      stdout: result.stdout,
    }
  } finally {
    rmSync(fixtureDirectory, { force: true, recursive: true })
  }
}

function runGit(cwd: string, args: readonly string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" })
}
