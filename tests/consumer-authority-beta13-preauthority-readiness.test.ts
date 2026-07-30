import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const manifestPath = join(process.cwd(), "docs", "current", "release", "consumer-authority-beta13-acceptance.json")

describe("consumer authority beta.13 pre-authority readiness", () => {
  it("requires an exact public Java/Spring lifecycle to reach only the authority blocker", () => {
    // Given: the package-visible beta.13 acceptance record.
    const manifest = readManifest()
    const readiness = record(manifest["preAuthorityReadiness"])

    // When: an isolated installed consumer prepares itself before any future artifact exists.
    const commands = readiness["commands"]

    // Then: only public bootstrap, Gradle, evidence, and report ingress establish readiness.
    expect(manifest["schemaVersion"]).toBe("consumer-authority-beta13-acceptance.1")
    expect(manifest["package"]).toEqual({ channel: "staging", scope: "staging-only", version: "0.8.0-beta.13" })
    expect(commands).toEqual([
      "ph bootstrap backend --strict --no-developer-mcp",
      "ph bearshell ./gradlew test",
      "ph bearshell ./gradlew compileJava",
      "ph bearshell ./gradlew clean",
      "ph evidence read README.md",
      "ph evidence read .persona/project-profile.jsonc",
      "ph evidence read src/main/java/example/cooperative/GreetingService.java",
      "ph plan --report-filled implementation --stdin",
      "ph plan --report-filled review --stdin",
    ])
    expect(readiness["expectedDefaultFinish"]).toEqual({
      absentBlockers: [
        "implementation-report-missing",
        "review-report-missing",
        "evidence-missing",
        "report-coverage-missing",
        "profile-read-coverage-missing",
        "java-role-read-coverage-missing",
        "workflow-loop-state-absent",
        "ralph-loop-state-absent",
      ],
      primaryBlocker: "trusted-authority-required",
      status: "blocked",
    })
    expect(readiness["negativeCases"]).toEqual([
      "missing-or-malformed-report",
      "repeated-control-or-oversized-report",
      "missing-unsafe-replaced-or-identity-drifted-evidence",
      "workflow-or-ralph-loop-missing-malformed-or-unsafe",
      "default-finish-has-no-authority-side-effect",
    ])
    expect(readiness["proof"]).toBe("source-built-and-fresh-packed-installed-public-cli")
  })

  it("keeps beta.12's artifact evidence historical and leaves one pre-armed hosted residual", () => {
    // Given: the beta.13 release handoff.
    const manifest = readManifest()
    const historical = record(manifest["beta12HistoricalExternal"])
    const residual = record(manifest["hostedResidual"])

    // When: the candidate is inspected before any registry or fixture mutation.
    const mutationBoundary = record(manifest["mutationBoundary"])

    // Then: local readiness does not reuse beta.12 authority evidence or authorize a fixture.
    expect(historical).toEqual({
      outcome: "artifact-crypto-and-installed-fetch-passed-but-public-finish-retained-readiness-blockers",
      reusableForBeta13: false,
      version: "0.8.0-beta.12",
    })
    expect(residual["id"]).toBe("beta13-prearmed-external-authority-consumption")
    expect(mutationBoundary["performed"]).toBe(false)
    const handoff = record(manifest["prearmedExternalHandoff"])
    const prepare = record(handoff["prepare"])
    expect(prepare["requiredBeforeFixtureAuthorization"])
      .toBe("public-finish-blocked-only-on-trusted-authority-required")
    expect(record(handoff["trigger"])["onlyAfter"])
      .toBe("observer-credential-preflight-ready-public-readiness-and-natural-current-version-original-artifact")
  })
})

function readManifest(): Record<string, unknown> {
  return record(JSON.parse(readFileSync(manifestPath, "utf8")))
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("expected record")
  }
  return value as Record<string, unknown>
}
