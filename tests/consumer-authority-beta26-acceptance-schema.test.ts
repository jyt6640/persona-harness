import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BETA26_ACCEPTANCE_SCHEMA_VERSION,
  Beta26AcceptanceManifestError,
  parseBeta26AcceptanceManifest,
  readBeta26AcceptanceManifest,
} from "../scripts/consumer-authority-beta26-acceptance-schema.mjs"
import {
  FinalObserverV4CleanlinessError,
  evaluateFinalObserverV4Cleanliness,
} from "../scripts/consumer-authority-final-observer-v4-cleanliness.mjs"

const repositoryRoot = process.cwd()
const PROCEDURE_RECORD_SHA256 = "5389c027b21f72f325a5d9e467ecd4d150f672e14da1d04f51774602a284c57d"

describe("consumer authority beta.26 workflow-selected observer acceptance", () => {
  it("binds the reviewed v4 cleanliness policy and explicit observer gh tool", () => {
    const manifest = record(readBeta26AcceptanceManifest(repositoryRoot))
    const procedure = record(record(manifest.prearmedExternalHandoff).finalObserverProcedure)

    expect(manifest.schemaVersion).toBe(BETA26_ACCEPTANCE_SCHEMA_VERSION)
    expect(record(manifest.package).version).toBe("0.8.0-beta.26")
    expect(procedure.procedureRecord).toEqual({
      location: "coordinator-governed-immutable-external-procedure-record-no-local-path",
      sha256: PROCEDURE_RECORD_SHA256,
    })
    expect(record(manifest.observerGhTool)).toEqual({
      executable: "workflow-selected-absolute-regular-non-symlink",
      invocation: "direct-exec-no-shell-no-path-lookup",
      output: "bounded-version-classification-only",
      provisioning: "workflow-owned-runner-package-record-to-private-regular-copy",
      schemaVersion: "consumer-authority-observer-gh-tool.2",
      version: ">=2.96.0 <3.0.0",
    })
    expect(record(manifest.observerGhSelection)).toEqual({
      diagnostics: "only-fixed-tool-invalid-tool-unavailable-tool-version-unsupported-parser-rejected-or-non-tool-stage-codes-cross-the-package-contract-boundary",
      workflow: "runner-package-record-selection-to-private-regular-nonsymlink-copy-before-ci-publish-and-release-package-contracts",
    })
    expect(record(procedure.cleanliness).forbiddenConsumerPaths).toEqual([".local/**", ".config/**", ".cache/**"])
    expect(record(manifest.closureCompleteness).deterministicLinks).toEqual(expect.arrayContaining([
      "v4-stage-scoped-runtime-residue-cleanliness",
      "workflow-selected-observer-gh-tool-without-package-path-lookup",
      "linux-runtime-owned-uv-use-io-uring-child-envelope-only",
    ]))
  })

  it("rejects strict acceptance and v4 residue drift", () => {
    const schemaCases: Array<(manifest: Record<string, unknown>) => void> = [
      (manifest) => { record(manifest.observerGhTool).invocation = "path-lookup" },
      (manifest) => { delete record(manifest.observerGhTool).provisioning },
      (manifest) => { record(manifest.observerGhSelection).workflow = "ambient-path" },
      (manifest) => { record(record(manifest.prearmedExternalHandoff).finalObserverProcedure).observerGhTool = {} },
      (manifest) => { record(record(record(manifest.prearmedExternalHandoff).finalObserverProcedure).cleanliness).forbiddenConsumerPaths = [] },
      (manifest) => { manifest.unknown = true },
    ]
    for (const apply of schemaCases) {
      const manifest = cloneCanonical()
      apply(manifest)
      expectSchemaBlock(() => parseBeta26AcceptanceManifest(manifest, "0.8.0-beta.26"))
    }

    const root = mkdtempSync(join(tmpdir(), "beta26-v4-cleanliness-"))
    const outside = mkdtempSync(join(tmpdir(), "beta26-v4-outside-"))
    try {
      materializeValidResidues(root)
      expect(evaluateFinalObserverV4Cleanliness(validInput(root))).toMatchObject({ stage: "immediately-pre-push" })

      const tracked = validInput(root)
      tracked.statusNul = " M README.md\0"
      expectCleanlinessBlock(() => evaluateFinalObserverV4Cleanliness(tracked))

      rmSync(join(root, ".persona", "workflow"), { force: true, recursive: true })
      symlinkSync(outside, join(root, ".persona", "workflow"))
      expectCleanlinessBlock(() => evaluateFinalObserverV4Cleanliness(validInput(root)))
    } finally {
      rmSync(root, { force: true, recursive: true })
      rmSync(outside, { force: true, recursive: true })
    }
  })
})

function cloneCanonical(): Record<string, unknown> {
  return record(JSON.parse(JSON.stringify(readBeta26AcceptanceManifest(repositoryRoot))))
}

function materializeValidResidues(root: string): void {
  mkdirSync(join(root, ".gradle"), { recursive: true })
  mkdirSync(join(root, ".persona", "evidence"), { recursive: true })
  mkdirSync(join(root, ".persona", "workflow"), { recursive: true })
  mkdirSync(join(root, "build"), { recursive: true })
  mkdirSync(join(root, "node_modules"), { recursive: true })
  writeFileSync(join(root, ".persona", ".ph-init-manifest.json"), "{}\n")
}

function validInput(root: string): Record<string, unknown> {
  const canonicalRoot = realpathSync(root)
  const residues = [".gradle", ".persona/.ph-init-manifest.json", ".persona/evidence", ".persona/workflow", "build", "node_modules"]
  const binding = {
    cwd: canonicalRoot,
    finalDiff: [".github/workflows/research-attestation.yml", ".persona/project-profile.jsonc"],
    head: "a".repeat(40),
    parent: "b".repeat(40),
    remoteParent: "c".repeat(40),
    reusablePinDigest: `sha256:${"c".repeat(64)}`,
    reusablePinPath: ".github/workflows/research-attestation.yml",
    sourceDigest: `sha256:${"d".repeat(64)}`,
    topLevel: canonicalRoot,
  }
  return {
    cleanOutput: residues.map((path) => `Would remove ${path.endsWith(".json") ? path : `${path}/`}\n`).join(""),
    expected: structuredClone(binding),
    observed: structuredClone(binding),
    projectRoot: root,
    stage: "immediately-pre-push",
    statusNul: residues.map((path) => `!! ${path}\0`).join(""),
  }
}

function expectSchemaBlock(action: () => void): void {
  try {
    action()
  } catch (error) {
    if (error instanceof Beta26AcceptanceManifestError) return
    throw error
  }
  throw new Error("beta26 acceptance unexpectedly accepted drift")
}

function expectCleanlinessBlock(action: () => void): void {
  try {
    action()
  } catch (error) {
    if (error instanceof FinalObserverV4CleanlinessError) return
    throw error
  }
  throw new Error("v4 cleanliness unexpectedly accepted drift")
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("expected record")
  return value as Record<string, unknown>
}
