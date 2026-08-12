import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { AUTHORITY_BINDING_REASONS } from "../src/cli/authority-artifact-binding.js"
import {
  V085AcceptanceManifestError,
  canonicalV085AcceptanceManifest,
  parseV085AcceptanceManifest,
  readV085AcceptanceManifest,
} from "../scripts/consumer-authority-v085-acceptance-schema.mjs"
import {
  parseV082AcceptanceManifest,
} from "../scripts/consumer-authority-v082-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.5 acceptance schema", () => {
  it("binds the current package and lock to a new strict 0.8.5 record while preserving v082 history", () => {
    const manifest = readV085AcceptanceManifest(repositoryRoot)
    const packageLock = JSON.parse(readFileSync(join(repositoryRoot, "package-lock.json"), "utf8"))
    const v082 = parseV082AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v082-acceptance.json"), "utf8")),
      "0.8.2",
    )

    expect(manifest.package).toMatchObject({ scope: "source-candidate", version: "0.8.5" })
    expect(packageLock).toMatchObject({ version: manifest.package.version })
    expect(packageLock.packages[""]).toMatchObject({ version: manifest.package.version })
    expect(manifest.v082HistoricalRelease).toMatchObject({ reusableForV085: false, version: "0.8.2" })
    expect(manifest.v083HistoricalRelease).toMatchObject({ reusableForV085: false, version: "0.8.3" })
    expect(manifest.v084HistoricalRelease).toMatchObject({ reusableForV085: false, version: "0.8.4" })
    expect(v082.package).toMatchObject({ channel: "latest", scope: "ga-approved", version: "0.8.2" })
    expect(manifest.authority.fetchBindingReason).toEqual({
      allowedReasons: AUTHORITY_BINDING_REASONS,
      output: "fixed-enum-only-no-values-paths-tokens-urls-or-raw-output",
      publicState: "binding-mismatch",
      schemaVersion: "consumer-authority-fetch-binding-reason.1",
    })
    expect(manifest.acceptanceResponsibilities.package).toMatchObject({
      excludes: ["attestation-parser", "observer-gh-selector"],
      requires: expect.arrayContaining(["post-model-assistant-response-and-pre-approval-trace"]),
    })
    expect(manifest.openCodeInterviewObservation).toMatchObject({
      schemaVersion: "opencode-interview-observation.1",
      input: "normalized-opencode-event-stream-from-message-and-plugin-hook-surfaces",
      output: "fixed-status-booleans-and-code-only-no-response-text-path-argument-token-or-host-data",
      firstResponse: {
        transformedUserInput: "user-messages-and-user-text-parts-never-satisfy-the-post-model-predicate",
        messageIdentity: "message-id-session-role-and-event-surface-association-is-immutable-role-drift-blocks",
        partIdentity: "part-id-session-message-type-and-event-surface-association-is-immutable-linked-text-cannot-promote",
        lifecycle: {
          message: "message.updated-first-or-same-binding-repeat-then-user-message.removed-once; no-unknown-remove-or-update-after-remove",
          part: "message.part.updated-first-or-same-binding-repeat-then-message.part.removed-once; no-unknown-remove-update-after-remove-or-rebind",
          rejectedCodes: ["message-lifecycle-invalid", "part-lifecycle-invalid"],
        },
      },
    })
  })

  it("rejects neighboring versions and records that attempt to reuse v082 as current", () => {
    const fixture = canonicalV085AcceptanceManifest()
    const packageRecord = fixture.package as Record<string, unknown>
    packageRecord.version = "0.8.2"

    expect(() => parseV085AcceptanceManifest(fixture, "0.8.5")).toThrow(V085AcceptanceManifestError)
    expect(() => parseV085AcceptanceManifest(canonicalV085AcceptanceManifest(), "0.8.2")).toThrow(V085AcceptanceManifestError)
    expect(() => parseV082AcceptanceManifest(canonicalV085AcceptanceManifest(), "0.8.5")).toThrow()
  })

  it("explicitly accepts a retained draft plan before V4 readiness can reach authority-only blocking", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-v085-retained-plan-"))
    try {
      const cliOptions = { cwd: root, env: {}, invocationName: "ph", packageRoot: repositoryRoot }
      expect(runPersonaCli(["intake", "--default", "backend"], cliOptions).status).toBe(0)
      expect(runPersonaCli(["plan"], cliOptions).status).toBe(0)

      const bootstrap = runPersonaCli(["bootstrap", "backend", "--strict", "--no-developer-mcp"], cliOptions)
      const beforeAcceptance = runPersonaCli(["plan", "--status"], cliOptions)
      const beforeClosure = runPersonaCli(["workflow", "closure", "next", "--json"], cliOptions)
      const manifest = readV085AcceptanceManifest(repositoryRoot)
      const readiness = record(manifest.preAuthorityReadiness)

      expect(bootstrap.status).toBe(0)
      expect(bootstrap.stdout).toContain(".persona/workflow/plan.md already exists")
      expect(beforeAcceptance.stdout).toContain("Status: draft")
      expect(JSON.parse(beforeClosure.stdout)).toMatchObject({
        state: { blockers: [expect.objectContaining({ id: "plan-not-accepted" })] },
      })
      expect(Array.isArray(readiness.commands) ? readiness.commands.slice(0, 2) : undefined).toEqual([
        "ph bootstrap backend --strict --no-developer-mcp",
        "ph plan --accept",
      ])
      expect(readiness).toMatchObject({
        initialization: {
          acceptedPlan: "ph plan --accept",
          retainedDraftPlan: "bootstrap preserves an existing draft plan; public readiness must accept it explicitly",
        },
      })

      const accept = runPersonaCli(["plan", "--accept"], cliOptions)
      const afterClosure = runPersonaCli(["workflow", "closure", "next", "--json"], cliOptions)

      expect(accept.status).toBe(0)
      expect(JSON.parse(afterClosure.stdout)).toMatchObject({
        state: { plan: "accepted" },
      })
      expect(JSON.parse(afterClosure.stdout).state.blockers).not.toContainEqual(
        expect.objectContaining({ id: "plan-not-accepted" }),
      )
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("routes both direct current preflights through v085 without changing their bounded behavior", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-v085-preflight-"))
    const ghPath = join(root, "gh")
    try {
      writeFileSync(ghPath, [
        `#!${process.execPath}`,
        "if (process.argv[2] === '--version') {",
        "  process.stdout.write('gh version 2.96.0 (fixture)\\n')",
        "  process.exit(0)",
        "}",
        "process.exit(process.argv.at(-1) === '--help' ? 0 : 1)",
        "",
      ].join("\n"))
      chmodSync(ghPath, 0o700)

      const attestation = spawnSync(
        process.execPath,
        ["scripts/preflight-consumer-authority-external-attestation.mjs", "--json", "--observer-gh", ghPath],
        { cwd: repositoryRoot, encoding: "utf8", env: { HOME: root } },
      )
      const transport = spawnSync(
        process.execPath,
        ["scripts/preflight-consumer-authority-external-artifact-transport.mjs", "--json"],
        { cwd: repositoryRoot, encoding: "utf8", env: { HOME: root } },
      )

      expect(attestation.status).toBe(0)
      expect(JSON.parse(attestation.stdout)).toMatchObject({ code: "gh-command-parser-accepted", state: "ready" })
      expect(transport.status).toBe(0)
      expect(JSON.parse(transport.stdout)).toMatchObject({ code: "external-artifact-transport-parser-accepted", state: "ready" })

      for (const script of [
        "preflight-consumer-authority-external-attestation.mjs",
        "preflight-consumer-authority-external-artifact-transport.mjs",
      ]) {
        const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
        expect(source).toContain('from "./consumer-authority-v085-acceptance-schema.mjs"')
        expect(source).toContain("readV085AcceptanceManifest(packageRoot)")
        expect(source).not.toContain("readV082AcceptanceManifest(packageRoot)")
      }
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })
})

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("expected record")
  }
  return value as Record<string, unknown>
}
