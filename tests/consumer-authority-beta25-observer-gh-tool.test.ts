import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  canonicalExternalAttestationCommandPlan,
  runExternalAttestationGrammarPreflight,
} from "../scripts/consumer-authority-external-attestation-command-plan.mjs"

const topology = {
  callerEnrollment: {
    repositoryId: 1304576182,
    repositorySlug: "jyt6640/persona-harness-attestation-claim-fixture",
    workflowPath: ".github/workflows/research-attestation.yml",
    workflowRef: "refs/heads/main",
    workflowSha: "a".repeat(40),
  },
  callerSource: {
    ref: "refs/heads/main",
    sourceSha: "b".repeat(40),
  },
  reusableSigner: {
    repositorySlug: "jyt6640/persona-harness",
    workflowPath: ".github/workflows/persona-harness-project-finish.yml",
    workflowSha: "c".repeat(40),
  },
}

describe("consumer authority beta.25 observer gh tool contract", () => {
  it("requires an explicit observer executable instead of ambient command lookup", () => {
    let calls = 0

    const result = runExternalAttestationGrammarPreflight(canonicalExternalAttestationCommandPlan(), topology, {
      execute: () => {
        calls += 1
        return { status: 1, stderr: "bundle content could not be parsed" }
      },
    })

    expect(calls).toBe(0)
    expect(result).toMatchObject({ code: "gh-command-tool-required", state: "blocked" })
  })

  it("blocks malformed and unavailable tool inputs without reaching the parser", () => {
    const inputs = ["gh", "/missing/gh", "/tmp/gh\0alias"]
    for (const ghPath of inputs) {
      let calls = 0
      const result = runExternalAttestationGrammarPreflight(canonicalExternalAttestationCommandPlan(), topology, {
        execute: () => {
          calls += 1
          return { status: 1, stderr: "bundle content could not be parsed" }
        },
        ghPath,
      })
      expect(calls).toBe(0)
      expect(result.state).toBe("blocked")
      expect(result.code).toMatch(/^gh-command-tool-(invalid|required)$/u)
    }
  })

  it("accepts only a regular, non-symlink exact-version executable before parser preflight", () => {
    const root = mkdtempSync(join(tmpdir(), "beta25-observer-gh-tool-"))
    const executable = join(root, "gh")
    const wrongVersion = join(root, "wrong-version-gh")
    const alias = join(root, "gh-alias")
    try {
      writeGhFixture(executable, "2.96.0")
      writeGhFixture(wrongVersion, "2.95.0")
      symlinkSync(executable, alias)

      expect(runExternalAttestationGrammarPreflight(canonicalExternalAttestationCommandPlan(), topology, {
        ghPath: executable,
      })).toMatchObject({ code: "gh-command-parser-accepted", state: "ready" })
      expect(runExternalAttestationGrammarPreflight(canonicalExternalAttestationCommandPlan(), topology, {
        ghPath: wrongVersion,
      })).toMatchObject({ code: "gh-command-version-unsupported", state: "blocked" })
      expect(runExternalAttestationGrammarPreflight(canonicalExternalAttestationCommandPlan(), topology, {
        ghPath: alias,
      })).toMatchObject({ code: "gh-command-tool-invalid", state: "blocked" })
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })
})

function writeGhFixture(path: string, version: string): void {
  writeFileSync(path, [
    `#!${process.execPath}`,
    "if (process.argv[2] === '--version') {",
    `  process.stdout.write('gh version ${version} (fixture)\\n')`,
    "  process.exit(0)",
    "}",
    "process.stderr.write('bundle content could not be parsed\\n')",
    "process.exit(1)",
    "",
  ].join("\n"))
  chmodSync(path, 0o700)
}
