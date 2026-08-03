import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BETA24_ACCEPTANCE_SCHEMA_VERSION,
  Beta24AcceptanceManifestError,
  parseBeta24AcceptanceManifest,
  readBeta24AcceptanceManifest,
} from "../scripts/consumer-authority-beta24-acceptance-schema.mjs"
import {
  FinalObserverV4CleanlinessError,
  FINAL_OBSERVER_V4_STAGE_RESIDUE_PROJECTION,
  evaluateFinalObserverV4Cleanliness,
} from "../scripts/consumer-authority-final-observer-v4-cleanliness.mjs"

const repositoryRoot = process.cwd()
const PROCEDURE_RECORD_SHA256 = "5389c027b21f72f325a5d9e467ecd4d150f672e14da1d04f51774602a284c57d"
const CLEANLINESS_STAGES = [
  "baseline",
  "source-bound-preparation",
  "credential-handoff",
  "observer-child",
  "immediately-pre-push",
] as const

type CleanlinessStage = (typeof CLEANLINESS_STAGES)[number]
type Binding = {
  cwd: string
  finalDiff: string[]
  head: string
  parent: string
  remoteParent: string
  reusablePinDigest: string
  reusablePinPath: string
  sourceDigest: string
  topLevel: string
}
type CleanlinessInput = {
  cleanOutput: string
  expected: Binding
  observed: Binding
  projectRoot: string
  stage: CleanlinessStage
  statusNul: string
}
type ValidInputOptions = {
  readonly stage?: CleanlinessStage
}

describe("consumer authority beta.24 v4 procedure", () => {
  it("binds the reviewed v4 residue and full final-observer boundary", () => {
    const manifest = record(readBeta24AcceptanceManifest(repositoryRoot))
    const procedure = record(record(manifest.prearmedExternalHandoff).finalObserverProcedure)
    const cleanliness = record(procedure.cleanliness)

    expect(manifest.schemaVersion).toBe(BETA24_ACCEPTANCE_SCHEMA_VERSION)
    expect(record(manifest.package).version).toBe("0.8.0-beta.24")
    expect(procedure.procedureRecord).toEqual({
      location: "coordinator-governed-immutable-external-procedure-record-no-local-path",
      sha256: PROCEDURE_RECORD_SHA256,
    })
    expect(cleanliness).toMatchObject({
      diagnostic: "normalized-clean-diagnostic-equals-stage-expected-residue-set",
      enumeration: "nul-safe-untracked-and-ignored-only",
      finalDiffPolicy: "only-documented-source-bound-bootstrap-paths-plus-the-required-immutable-reusable-pin",
      forbiddenConsumerPaths: [".local/**", ".config/**", ".cache/**"],
      immutableTrackedBinding: "exact-cwd-git-toplevel-head-parent-remote-parent-reusable-pin-digest-and-source-identity-digest-map",
      residueInspection: "lstat-and-realpath-contained-for-every-residue-and-ancestor",
      sourceProjection: "only-source-identity-and-project-finish-runtime-exclusions",
    })
    expect(procedure.stageCleanliness).toEqual([
      "baseline",
      "source-bound-preparation",
      "credential-handoff",
      "observer-child",
      "immediately-pre-push",
    ])
    expect(record(cleanliness.policy).stageResidueProjection).toEqual(FINAL_OBSERVER_V4_STAGE_RESIDUE_PROJECTION)
    expect(record(manifest.closureCompleteness).deterministicLinks).toEqual([
      "immutable-tracked-source-head-parent-pin-and-digest-map",
      "v4-stage-scoped-runtime-residue-cleanliness",
      "same-consumer-public-bootstrap-plan-loop-gradle-reports-evidence-readiness",
      "host-state-isolated-credential-preflight-and-command-transport-plans",
      "current-original-byte-and-online-crypto-before-leaf-certificate-notAfter",
      "authenticated-fetch-to-trusted-unconsumed",
      "one-Finish-consumption-and-immediate-replay-block",
    ])
  })

  it("rejects v4 procedure and closure-completeness drift", () => {
    const cases: ReadonlyArray<(manifest: Record<string, unknown>) => void> = [
      (manifest) => { record(record(manifest.prearmedExternalHandoff).finalObserverProcedure).procedureRecord = { location: "coordinator-governed-immutable-external-procedure-record-no-local-path", sha256: "0".repeat(64) } },
      (manifest) => { record(record(record(manifest.prearmedExternalHandoff).finalObserverProcedure).cleanliness).forbiddenConsumerPaths = [] },
      (manifest) => { record(record(record(manifest.prearmedExternalHandoff).finalObserverProcedure).cleanliness).enumeration = "ignored-status" },
      (manifest) => { record(manifest.closureCompleteness).deterministicLinks = [] },
      (manifest) => { manifest.unexpected = "foreign" },
    ]
    for (const apply of cases) {
      const manifest = cloneCanonical()
      apply(manifest)
      expectSchemaBlock(() => parseBeta24AcceptanceManifest(manifest, "0.8.0-beta.24"))
    }
  })

  it("accepts only the exact stage residue set after containment inspection", () => {
    const fixture = mkdtempSync(join(tmpdir(), "beta24-v4-cleanliness-"))
    try {
      makeDirectory(fixture, ".persona/evidence")
      makeDirectory(fixture, ".persona/workflow")
      makeDirectory(fixture, ".gradle")
      makeDirectory(fixture, "build")
      makeDirectory(fixture, "node_modules")
      writeFileSync(join(fixture, ".persona", ".ph-init-manifest.json"), "{}\n")
      for (const stage of CLEANLINESS_STAGES) {
        const residues = FINAL_OBSERVER_V4_STAGE_RESIDUE_PROJECTION[stage]
        expect(evaluateFinalObserverV4Cleanliness(validInput(fixture, { stage }))).toEqual({
          residues: [...residues],
          stage,
        })
      }
    } finally {
      rmSync(fixture, { force: true, recursive: true })
    }
  })

  it("rejects tracked drift, unexpected residue, aliases, and forbidden local state", () => {
    const fixture = mkdtempSync(join(tmpdir(), "beta24-v4-cleanliness-negative-"))
    const outside = mkdtempSync(join(tmpdir(), "beta24-v4-outside-"))
    try {
      makeDirectory(fixture, ".persona/workflow")
      writeFileSync(join(fixture, ".persona", ".ph-init-manifest.json"), "{}\n")
      const cases = [
        () => evaluateFinalObserverV4Cleanliness({ ...validInput(fixture, { stage: "source-bound-preparation" }), statusNul: " M src/Main.java\0" }),
        () => evaluateFinalObserverV4Cleanliness({ ...validInput(fixture), statusNul: "?? unexpected-runtime\0", cleanOutput: "Would remove unexpected-runtime/\n" }),
        () => evaluateFinalObserverV4Cleanliness({ ...validInput(fixture), statusNul: "!! .local/\0", cleanOutput: "Would remove .local/\n" }),
        () => evaluateFinalObserverV4Cleanliness({ ...validInput(fixture), stageResidueProjection: FINAL_OBSERVER_V4_STAGE_RESIDUE_PROJECTION }),
        () => {
          const input = validInput(fixture, { stage: "source-bound-preparation" })
          input.expected.finalDiff = [".github/workflows/research-attestation.yml", "src/Main.java"]
          input.observed.finalDiff = [".github/workflows/research-attestation.yml", "src/Main.java"]
          return evaluateFinalObserverV4Cleanliness(input)
        },
        () => {
          const input = validInput(fixture, { stage: "source-bound-preparation" })
          input.observed.sourceDigest = `sha256:${"e".repeat(64)}`
          return evaluateFinalObserverV4Cleanliness(input)
        },
        () => {
          const input = validInput(fixture, { stage: "source-bound-preparation" })
          input.observed.remoteParent = "e".repeat(40)
          return evaluateFinalObserverV4Cleanliness(input)
        },
        () => {
          rmSync(join(fixture, ".persona", "workflow"), { force: true, recursive: true })
          symlinkSync(outside, join(fixture, ".persona", "workflow"))
          return evaluateFinalObserverV4Cleanliness(validInput(fixture, { stage: "source-bound-preparation" }))
        },
      ]
      for (const attempt of cases) expectCleanlinessBlock(attempt)
    } finally {
      rmSync(fixture, { force: true, recursive: true })
      rmSync(outside, { force: true, recursive: true })
    }
  })
})

function validInput(root: string, options: ValidInputOptions = {}): CleanlinessInput {
  const canonicalRoot = realpathSync(root)
  const stage = options.stage ?? "immediately-pre-push"
  const residues = FINAL_OBSERVER_V4_STAGE_RESIDUE_PROJECTION[stage]
  return {
    expected: {
      cwd: canonicalRoot,
      finalDiff: [".github/workflows/research-attestation.yml", ".persona/project-profile.jsonc"],
      head: "a".repeat(40),
      parent: "b".repeat(40),
      remoteParent: "c".repeat(40),
      reusablePinDigest: `sha256:${"c".repeat(64)}`,
      reusablePinPath: ".github/workflows/research-attestation.yml",
      sourceDigest: `sha256:${"d".repeat(64)}`,
      topLevel: canonicalRoot,
    },
    observed: {
      cwd: canonicalRoot,
      finalDiff: [".github/workflows/research-attestation.yml", ".persona/project-profile.jsonc"],
      head: "a".repeat(40),
      parent: "b".repeat(40),
      remoteParent: "c".repeat(40),
      reusablePinDigest: `sha256:${"c".repeat(64)}`,
      reusablePinPath: ".github/workflows/research-attestation.yml",
      sourceDigest: `sha256:${"d".repeat(64)}`,
      topLevel: canonicalRoot,
    },
    projectRoot: root,
    stage,
    statusNul: residues.map((path) => `!! ${path}\0`).join(""),
    cleanOutput: residues.map((path) => `Would remove ${path.endsWith(".json") ? path : `${path}/`}\n`).join(""),
  }
}

function makeDirectory(root: string, relative: string): void {
  mkdirSync(join(root, relative), { recursive: true })
}

function cloneCanonical(): Record<string, unknown> {
  return record(JSON.parse(JSON.stringify(readBeta24AcceptanceManifest(repositoryRoot))))
}

function expectSchemaBlock(action: () => void): void {
  try {
    action()
  } catch (error) {
    if (error instanceof Beta24AcceptanceManifestError) return
    throw error
  }
  throw new Error("beta24 schema unexpectedly accepted drift")
}

function expectCleanlinessBlock(action: () => void): void {
  try {
    action()
  } catch (error) {
    if (error instanceof FinalObserverV4CleanlinessError) return
    throw error
  }
  throw new Error("v4 cleanliness unexpectedly accepted unsafe state")
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("expected record")
  return value as Record<string, unknown>
}
