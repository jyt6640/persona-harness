import { spawnSync } from "node:child_process"
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  canonicalExternalAttestationCommandPlan,
  renderExternalAttestationParserHelpArguments,
  runExternalAttestationGrammarPreflight,
} from "../scripts/consumer-authority-external-attestation-command-plan.mjs"
import { createObserverGhNoTokenEnvironment } from "../scripts/consumer-authority-observer-gh-tool.mjs"
import { provisionPrivateObserverGhCopy } from "../scripts/consumer-authority-observer-gh-workflow-selector.mjs"

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

describe("beta33 observer gh parser-only preflight", () => {
  it("renders the exact plan as a no-network help invocation", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-beta33-parser-"))
    try {
      const args = renderExternalAttestationParserHelpArguments(canonicalExternalAttestationCommandPlan(), topology)

      expect(args.slice(0, 3)).toEqual([
        "attestation",
        "verify",
        "/persona-harness-observer-parser-placeholder/subject-placeholder",
      ])
      expect(args.at(-1)).toBe("--help")
      expect(args).toContain("--bundle")
      expect(readdirSync(root)).toEqual([])
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("uses a selector-style private regular copy through the parser-only preflight without PATH", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-beta33-private-copy-"))
    try {
      const source = join(root, "source-gh")
      const runnerTemp = join(root, "runner-temp")
      const stateRoot = join(root, "state")
      mkdirSync(runnerTemp)
      mkdirSync(stateRoot)
      writeGhParserFixture(source)

      const copied = provisionPrivateObserverGhCopy(source, { runnerTemp })
      expect(copied.state).toBe("ready")
      if (copied.state !== "ready") throw new Error("private observer gh copy did not become ready")

      const environment = createObserverGhNoTokenEnvironment(stateRoot)
      expect(environment.PATH).toBeUndefined()
      expect(environment.GH_TOKEN).toBeUndefined()
      expect(lstatSync(copied.path).isSymbolicLink()).toBe(false)

      const result = runExternalAttestationGrammarPreflight(
        canonicalExternalAttestationCommandPlan(),
        topology,
        { ghPath: copied.path },
      )
      expect(result).toEqual({
        artifactAccess: false,
        authorityEligible: false,
        code: "gh-command-parser-accepted",
        credential: "absent",
        exit: "parser-accepted",
        networkAccess: false,
        schemaVersion: "consumer-authority-external-attestation-preflight.2",
        state: "ready",
      })

      const accepted = spawnSync(
        copied.path,
        renderExternalAttestationParserHelpArguments(canonicalExternalAttestationCommandPlan(), topology),
        { encoding: "utf8", env: environment, shell: false },
      )
      expect(accepted.status).toBe(0)

      const unknown = spawnSync(copied.path, ["attestation", "verify", "placeholder", "--unknown", "--help"], {
        encoding: "utf8",
        env: environment,
        shell: false,
      })
      expect(unknown.status).toBe(1)

      const missingValue = spawnSync(copied.path, ["attestation", "verify", "placeholder", "--signer-digest", "--help"], {
        encoding: "utf8",
        env: environment,
        shell: false,
      })
      expect(missingValue.status).toBe(1)
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("blocks an occupied or aliased private reservation before a parser invocation", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-beta33-private-reservation-"))
    try {
      const source = join(root, "source-gh")
      const runnerTemp = join(root, "runner-temp")
      const outside = join(root, "outside")
      mkdirSync(runnerTemp)
      mkdirSync(outside)
      writeGhParserFixture(source)

      mkdirSync(join(runnerTemp, "persona-harness-observer-gh"))
      expect(provisionPrivateObserverGhCopy(source, { runnerTemp })).toEqual({
        code: "observer-gh-workflow-tool-invalid",
        selectorStage: "private-reservation",
        state: "blocked",
      })

      rmSync(join(runnerTemp, "persona-harness-observer-gh"), { force: true, recursive: true })
      symlinkSync(outside, join(runnerTemp, "persona-harness-observer-gh"))
      expect(provisionPrivateObserverGhCopy(source, { runnerTemp })).toEqual({
        code: "observer-gh-workflow-tool-invalid",
        selectorStage: "private-reservation",
        state: "blocked",
      })
      expect(readdirSync(outside)).toEqual([])
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("classifies a bounded parser timeout without exposing process output", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-beta33-parser-timeout-"))
    try {
      const ghPath = join(root, "gh")
      writeGhParserFixture(ghPath)
      const calls: Array<{ args: string[]; environment: Record<string, string | undefined>; timeout: number }> = []
      const result = runExternalAttestationGrammarPreflight(
        canonicalExternalAttestationCommandPlan(),
        topology,
        {
          execute: (_command, args, options) => {
            calls.push({ args: [...args], environment: { ...options.env }, timeout: options.timeout })
            if (args[0] === "--version") return { status: 0, stdout: "gh version 2.96.0\n" }
            return { error: Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }), status: null }
          },
          ghPath,
        },
      )

      expect(calls).toHaveLength(2)
      expect(calls[1]?.args.at(-1)).toBe("--help")
      expect(calls[1]?.environment).toEqual(calls[0]?.environment)
      expect(calls[1]?.environment.PATH).toBeUndefined()
      expect(calls[1]?.environment.GH_TOKEN).toBeUndefined()
      expect(calls[1]?.timeout).toBe(5_000)
      expect(result).toEqual({
        artifactAccess: false,
        authorityEligible: false,
        code: "gh-command-parser-timeout",
        credential: "absent",
        exit: "execution-failed",
        networkAccess: false,
        schemaVersion: "consumer-authority-external-attestation-preflight.2",
        state: "blocked",
      })
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })
})

function writeGhParserFixture(path: string): void {
  writeFileSync(path, [
    "#!/bin/sh",
    "if [ \"$1\" = \"--version\" ]; then printf '%s\\n' 'gh version 2.96.0'; exit 0; fi",
    "if [ \"$1\" != \"attestation\" ] || [ \"$2\" != \"verify\" ]; then exit 1; fi",
    "last=''",
    "previous=''",
    "for argument in \"$@\"; do",
    "  if [ \"$argument\" = \"--unknown\" ]; then exit 1; fi",
    "  if [ \"$previous\" = \"--signer-digest\" ] && [ \"$argument\" = \"--help\" ]; then exit 1; fi",
    "  previous=\"$argument\"",
    "  last=\"$argument\"",
    "done",
    "if [ \"$last\" != \"--help\" ]; then exit 1; fi",
    "exit 0",
    "",
  ].join("\n"), { mode: 0o700 })
  chmodSync(path, 0o700)
}
