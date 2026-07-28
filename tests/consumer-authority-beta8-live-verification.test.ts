import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const manifestPath = join(process.cwd(), "docs", "current", "release", "consumer-authority-beta8-acceptance.json")

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return value
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== "string") {
    throw new TypeError(`${key} must be a string`)
  }
  return value
}

function readStrings(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key]
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new TypeError(`${key} must be a string array`)
  }
  return value
}

function readManifest(): Record<string, unknown> {
  return readRecord(JSON.parse(readFileSync(manifestPath, "utf8")), "beta.8 acceptance manifest")
}

describe("consumer authority beta.8 live-verification acceptance manifest", () => {
  it("records beta.7's expired live artifact as historical staging evidence rather than reusable authority", () => {
    const manifest = readManifest()
    const packageRecord = readRecord(manifest["package"], "package")
    const beta7 = readRecord(manifest["beta7HistoricalArtifact"], "beta7HistoricalArtifact")

    expect(readString(manifest, "schemaVersion")).toBe("consumer-authority-beta8-acceptance.1")
    expect(packageRecord).toEqual({ channel: "staging", scope: "staging-only", version: "0.8.0-beta.8" })
    expect(beta7).toEqual({
      certificateNotAfter: "2026-07-28T21:46:50Z",
      independentDecisionAt: "2026-07-28T21:52:38Z",
      outcome: "certificate-window-expired-no-trusted-positive",
      reusableForBeta8: false,
      version: "0.8.0-beta.7",
    })
  })

  it("makes the only final observer route pre-armed, ordered, and fail closed at the certificate deadline", () => {
    const manifest = readManifest()
    const authority = readRecord(manifest["authority"], "authority")
    const fixturePlan = readRecord(authority["fixturePlan"], "fixturePlan")
    const handoff = readRecord(manifest["prearmedExternalHandoff"], "prearmedExternalHandoff")
    const prepare = readRecord(handoff["prepare"], "prepare")
    const trigger = readRecord(handoff["trigger"], "trigger")
    const expiration = readRecord(trigger["expiration"], "expiration")
    const hostedResidual = readRecord(manifest["hostedResidual"], "hostedResidual")

    expect(readString(fixturePlan, "registryInstall")).toBe(
      "npm install persona-harness@0.8.0-beta.8 --registry https://registry.npmjs.org",
    )
    expect(readString(prepare, "consumer")).toBe("isolated-exact-registry-install")
    expect(readStrings(prepare, "allowedBeforeFixture")).toEqual(["enroll", "status", "explain"])
    expect(readStrings(prepare, "prohibitedBeforeArtifact")).toEqual([
      "artifact-download",
      "online-crypto-validation",
      "finish-consumption",
      "replay-observation",
    ])
    expect(readString(trigger, "onlyAfter")).toBe("natural-current-version-original-artifact")
    expect(readStrings(trigger, "steps")).toEqual([
      "download-original-bytes-once",
      "verify-online-before-leaf-certificate-notAfter",
      "finish-consume-once",
      "finish-replay-blocked",
    ])
    expect(expiration).toEqual({
      code: "certificate-window-expired",
      outcome: "blocked-no-fetch-finish-or-replay",
      source: "leaf-certificate-notAfter",
    })
    expect(readStrings(handoff, "nonAuthority")).toEqual([
      "prearm-does-not-self-validate",
      "prearm-does-not-grant-authority",
      "prearm-does-not-reuse-beta7-artifact",
    ])
    expect(readString(hostedResidual, "id")).toBe(
      "beta8-prearmed-external-live-original-artifact-verification",
    )
  })
})
