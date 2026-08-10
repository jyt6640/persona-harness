import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import {
  V082AcceptanceManifestError,
  canonicalV082AcceptanceManifest,
  parseV082AcceptanceManifest,
} from "../scripts/consumer-authority-v082-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.2 acceptance schema", () => {
  it("keeps the published 0.8.2 record strict without defining the current package", () => {
    const manifest = parseV082AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v082-acceptance.json"), "utf8")),
      "0.8.2",
    )

    expect(manifest.package).toMatchObject({ channel: "latest", scope: "ga-approved", version: "0.8.2" })
    expect(manifest.v081HistoricalRelease).toMatchObject({ reusableForV082: false, version: "0.8.1" })
  })

  it("assigns Package consumer evidence separately from CI-owned observer tool evidence", () => {
    const manifest = parseV082AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v082-acceptance.json"), "utf8")),
      "0.8.2",
    )

    expect(manifest.acceptanceResponsibilities).toEqual({
      package: {
        excludes: ["attestation-parser", "observer-gh-selector"],
        requires: [
          "exact-tar-provenance",
          "normal-install",
          "installed-only-no-source-fallback",
          "cli-and-approval-before-mutation",
        ],
      },
      sourceAndProtectedUbuntuCi: {
        requires: [
          "workflow-owned-dpkg-observer-gh-selection",
          "private-regular-nonsymlink-observer-gh-copy",
          "path-free-attestation-parser-preflight",
        ],
      },
    })
    expect(manifest.prearmedExternalHandoff.finalObserverProcedure.observerGhSelection).toContain(
      "source-and-protected-ubuntu-ci-only",
    )
    expect(manifest.hostedResidual.whyLocalCannotClose).toContain(
      "Source and CI-shaped packed exercise prove",
    )
    expect(manifest.hostedResidual.whyLocalCannotClose).toContain(
      "Package acceptance separately proves",
    )
  })

  it("explicitly accepts a retained draft plan before V4 readiness can reach authority-only blocking", () => {
    const root = mkdtempSync(join(tmpdir(), "persona-v082-retained-plan-"))
    try {
      const cliOptions = { cwd: root, env: {}, invocationName: "ph", packageRoot: repositoryRoot }
      expect(runPersonaCli(["intake", "--default", "backend"], cliOptions).status).toBe(0)
      expect(runPersonaCli(["plan"], cliOptions).status).toBe(0)

      const bootstrap = runPersonaCli(["bootstrap", "backend", "--strict", "--no-developer-mcp"], cliOptions)
      const beforeAcceptance = runPersonaCli(["plan", "--status"], cliOptions)
      const beforeClosure = runPersonaCli(["workflow", "closure", "next", "--json"], cliOptions)
      const manifest = readV082AcceptanceManifest(repositoryRoot)
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

  it("rejects a neighboring package version and acceptance drift", () => {
    const fixture = canonicalV082AcceptanceManifest()
    const packageRecord = fixture.package as Record<string, unknown>
    packageRecord.version = "0.8.1"

    expect(() => parseV082AcceptanceManifest(fixture, "0.8.2")).toThrow(V082AcceptanceManifestError)
    expect(() => parseV082AcceptanceManifest(canonicalV082AcceptanceManifest(), "0.8.1")).toThrow(V082AcceptanceManifestError)
  })

  it("rejects a current package version rather than letting the published record be reused", () => {
    expect(() => parseV082AcceptanceManifest(canonicalV082AcceptanceManifest(), "0.8.3")).toThrow(V082AcceptanceManifestError)
  })
})

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("expected record")
  }
  return value as Record<string, unknown>
}
