import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const manifestPath = join(process.cwd(), "docs", "current", "release", "consumer-authority-beta3-acceptance.json")

type AcceptanceManifest = {
  readonly authority: {
    readonly commands: readonly string[]
    readonly hostedFixture: {
      readonly callerWorkflowPath: string
      readonly event: string
      readonly ref: string
      readonly repository: string
      readonly reusableWorkflowPath: string
      readonly revision: string
    }
    readonly fixturePlan: {
      readonly artifact: string
      readonly consumer: string
      readonly postmergeAction: string
      readonly registryInstall: string
    }
  }
  readonly cooperative: {
    readonly commands: readonly string[]
    readonly defaultFinish: string
    readonly explicitFinish: string
    readonly laterClosure: string
  }
  readonly negativeCases: readonly {
    readonly id: string
    readonly proof: string
  }[]
  readonly deterministicProofs: readonly {
    readonly id: string
    readonly surface: string
  }[]
  readonly package: {
    readonly channel: string
    readonly scope: string
    readonly version: string
  }
  readonly schemaVersion: string
}

function readManifest(): AcceptanceManifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as AcceptanceManifest
}

describe("consumer authority beta.3 acceptance manifest", () => {
  it("defines the source and packed public cooperative command boundary", () => {
    // Given: the package-visible beta.3 acceptance record.
    const manifest = readManifest()

    // When: a fresh Java/Spring consumer follows the only supported public route.
    const commands = manifest.cooperative.commands

    // Then: test, compile, lifecycle, and explicit-assurance commands are all fixed.
    expect(manifest.schemaVersion).toBe("consumer-authority-beta3-acceptance.1")
    expect(manifest.package).toEqual({
      channel: "staging",
      scope: "staging-only",
      version: "0.8.0-beta.3",
    })
    expect(commands).toEqual([
      "ph bootstrap backend --strict --no-developer-mcp",
      "ph bearshell ./gradlew test",
      "ph bearshell ./gradlew compileJava",
      "ph bearshell ./gradlew clean",
      "ph plan --report-filled implementation --stdin",
      "ph plan --report-filled review --stdin",
    ])
    expect(manifest.cooperative).toMatchObject({
      defaultFinish: "trusted-authority-required",
      explicitFinish: "cooperative-pass",
      laterClosure: "trusted-authority-required",
    })
  })

  it("keeps only a future pinned public artifact run outside the deterministic boundary", () => {
    // Given: the source candidate's structured fixture plan.
    const manifest = readManifest()

    // When: its authority route is inspected without a hosted artifact.
    const fixture = manifest.authority.hostedFixture
    const negativeIds = new Set(manifest.negativeCases.map((entry) => entry.id))
    const proofSurfaces = new Map(manifest.deterministicProofs.map((entry) => [entry.id, entry.surface]))

    // Then: immutable hosted identity and every fail-closed class remain explicit.
    expect(manifest.authority.commands).toEqual([
      "ph authority enroll github <owner/repository> --workflow <caller-workflow>",
      "ph authority status --json",
      "ph authority fetch github --json",
      "ph authority explain --json",
      "ph workflow finish implement",
    ])
    expect(fixture).toEqual({
      callerWorkflowPath: ".github/workflows/persona-harness.yml",
      event: "push",
      ref: "refs/heads/main",
      repository: "jyt6640/persona-harness-attestation-claim-fixture",
      reusableWorkflowPath: ".github/workflows/persona-harness-project-finish.yml",
      revision: "postmerge-persona-harness-main-sha",
    })
    expect(manifest.authority.fixturePlan).toEqual({
      artifact: "project-finish-attestation",
      consumer: "public-java-spring-gradle",
      postmergeAction: "normal-push-to-main",
      registryInstall: "npm install persona-harness@0.8.0-beta.3 --registry https://registry.npmjs.org",
    })
    expect(negativeIds).toEqual(new Set([
      "gradle-test-or-compile-failure",
      "junit-malformed-stale-or-unsafe",
      "report-malformed-repeated-control-or-oversized",
      "workflow-or-ralph-loop-missing-malformed-or-unsafe",
      "evidence-missing-or-unsafe",
      "default-finish-authority-negative",
      "artifact-identity-or-version-mismatch",
      "external-trust-unavailable",
      "explicit-consumption-replay",
    ]))
    expect(proofSurfaces).toEqual(new Map([
      ["cooperative-source-and-packed", "source-built-and-packed-installed"],
      ["cooperative-gradle-source", "source-built"],
      ["report-ingress-source-and-packed", "source-built-and-packed-installed"],
      ["bootstrap-containment-source-and-packed", "source-built-and-packed-installed"],
      ["project-verifier-source-and-packed", "source-built-and-packed-installed"],
      ["project-consumption-source", "source-built-worker-seam"],
      ["doctor-source-and-packed", "source-built-and-packed-installed"],
    ]))
    for (const negativeCase of manifest.negativeCases) {
      expect(proofSurfaces.has(negativeCase.proof)).toBe(true)
    }
  })
})
