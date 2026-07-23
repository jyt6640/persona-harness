import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  SIGSTORE_NODE_ENGINE_RANGE,
  assessSigstoreNodeRuntime,
} from "../scripts/node-runtime-floor.mjs"

describe("Sigstore Node runtime floor", () => {
  it.each([
    ["20.17.0"],
    ["20.99.0"],
    ["22.9.0"],
    ["22.22.3"],
    ["24.0.0"],
  ])("accepts supported runtime %s", (version) => {
    expect(assessSigstoreNodeRuntime(version)).toEqual({
      status: "supported",
      requiredRange: "^20.17.0 || >=22.9.0",
    })
  })

  it.each([
    "20.16.9",
    "21.0.0",
    "22.8.9",
    "01.17.0",
    "20.17",
    "20.17.0+sk-live-aaaaaaaaaaaaaaaaaaaaaaaa",
    "../../20.17.0",
  ])("blocks unsupported or malformed runtime input without reflecting it", (version) => {
    const result = assessSigstoreNodeRuntime(version)

    expect(result).toEqual({
      status: "unsupported",
      requiredRange: "^20.17.0 || >=22.9.0",
    })
    if (!SIGSTORE_NODE_ENGINE_RANGE.includes(version)) {
      expect(JSON.stringify(result)).not.toContain(version)
    }
  })

  it("aligns the package engine and lockfile to the Sigstore floor", () => {
    expect(SIGSTORE_NODE_ENGINE_RANGE).toBe("^20.17.0 || >=22.9.0")
    expect(readPackageEngine("package.json")).toBe(SIGSTORE_NODE_ENGINE_RANGE)
    expect(readPackageLockEngine("package-lock.json")).toBe(SIGSTORE_NODE_ENGINE_RANGE)
  })
})

function readPackageEngine(path: string): string | undefined {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (!isRecord(parsed) || !isRecord(parsed.engines) || typeof parsed.engines.node !== "string") {
    return undefined
  }
  return parsed.engines.node
}

function readPackageLockEngine(path: string): string | undefined {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (!isRecord(parsed) || !isRecord(parsed.packages)) return undefined
  const packageRoot = parsed.packages[""]
  if (!isRecord(packageRoot) || !isRecord(packageRoot.engines) || typeof packageRoot.engines.node !== "string") {
    return undefined
  }
  return packageRoot.engines.node
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
