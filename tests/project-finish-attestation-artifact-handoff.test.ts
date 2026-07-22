import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  collectProjectFinishAttestationBundle,
  verifyProjectFinishAttestationArtifactHandoff,
} from "../scripts/project-finish-attestation-artifact-handoff.mjs"

const temporaryDirectories: string[] = []
const artifactDirectoryName = ".project-finish-attestation-artifacts"

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe("project finish attestation artifact handoff", () => {
  it("accepts only the unsigned receipt and predicate before signing", () => {
    const workspace = createWorkspace()

    const result = verifyProjectFinishAttestationArtifactHandoff({
      environment: { GITHUB_WORKSPACE: workspace },
      phase: "unsigned",
    })

    expect(result).toEqual({ kind: "ready" })
  })

  it("copies opaque bundle bytes into the fixed handoff root and requires all three files afterwards", () => {
    const workspace = createWorkspace()
    const bundleSource = join(workspace, "trusted-bundle.json")
    const bundleBytes = Buffer.from("opaque-attestation-bundle-bytes", "utf8")
    writeFileSync(bundleSource, bundleBytes, { mode: 0o600 })

    const result = collectProjectFinishAttestationBundle({
      environment: {
        GITHUB_WORKSPACE: workspace,
        PROJECT_FINISH_ATTESTATION_BUNDLE_PATH: bundleSource,
      },
    })

    expect(result).toEqual({ kind: "ready" })
    expect(readFileSync(join(workspace, artifactDirectoryName, "bundle.json"))).toEqual(bundleBytes)
    expect(verifyProjectFinishAttestationArtifactHandoff({
      environment: { GITHUB_WORKSPACE: workspace },
      phase: "signed",
    })).toEqual({ kind: "ready" })
  })

  it.each([
    ["missing", () => undefined],
    ["empty", (workspace: string) => writeFileSync(join(workspace, "trusted-bundle.json"), "", { mode: 0o600 })],
    ["symlinked", (workspace: string) => symlinkSync("outside-bundle.json", join(workspace, "trusted-bundle.json"))],
  ])("blocks a %s bundle source without materializing an upload artifact", (_name, prepare) => {
    const workspace = createWorkspace()
    writeFileSync(join(workspace, "outside-bundle.json"), "outside", { mode: 0o600 })
    prepare(workspace)

    const result = collectProjectFinishAttestationBundle({
      environment: {
        GITHUB_WORKSPACE: workspace,
        PROJECT_FINISH_ATTESTATION_BUNDLE_PATH: join(workspace, "trusted-bundle.json"),
      },
    })

    expect(result).toEqual({ code: "project-finish-producer-artifact-handoff", kind: "blocked" })
    expect(existsSync(join(workspace, artifactDirectoryName, "bundle.json"))).toBe(false)
    expect(readFileSync(join(workspace, ".project-finish-attestation-failure", "failure-diagnostic.json"), "utf8"))
      .toContain("project-finish-producer-artifact-handoff")
  })

  it("blocks stale, aliased, and replaced artifact roots without writing outside the runner root", () => {
    const workspace = createWorkspace()
    const artifactRoot = join(workspace, artifactDirectoryName)
    const outside = join(workspace, "outside")
    mkdirSync(outside)
    writeFileSync(join(artifactRoot, "bundle.json"), "stale", { mode: 0o600 })

    expect(verifyProjectFinishAttestationArtifactHandoff({
      environment: { GITHUB_WORKSPACE: workspace },
      phase: "unsigned",
    })).toEqual({ code: "project-finish-producer-artifact-handoff", kind: "blocked" })

    rmSync(artifactRoot, { force: true, recursive: true })
    symlinkSync("outside", artifactRoot)
    expect(verifyProjectFinishAttestationArtifactHandoff({
      environment: { GITHUB_WORKSPACE: workspace },
      phase: "unsigned",
    })).toEqual({ code: "project-finish-producer-artifact-handoff", kind: "blocked" })
    expect(existsSync(join(outside, "receipt.json"))).toBe(false)
  })

  it("does not follow an artifact root replaced before signed bundle collection", () => {
    const workspace = createWorkspace()
    const artifactRoot = join(workspace, artifactDirectoryName)
    const outside = join(workspace, "outside")
    const bundleSource = join(workspace, "trusted-bundle.json")
    mkdirSync(outside)
    writeFileSync(bundleSource, "opaque-bundle", { mode: 0o600 })
    rmSync(artifactRoot, { force: true, recursive: true })
    symlinkSync("outside", artifactRoot)

    expect(collectProjectFinishAttestationBundle({
      environment: {
        GITHUB_WORKSPACE: workspace,
        PROJECT_FINISH_ATTESTATION_BUNDLE_PATH: bundleSource,
      },
    })).toEqual({ code: "project-finish-producer-artifact-handoff", kind: "blocked" })
    expect(existsSync(join(outside, "bundle.json"))).toBe(false)
  })
})

function createWorkspace(): string {
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-artifact-handoff-")))
  temporaryDirectories.push(workspace)
  const artifactRoot = join(workspace, artifactDirectoryName)
  mkdirSync(artifactRoot, { mode: 0o700 })
  writeFileSync(join(artifactRoot, "receipt.json"), "receipt", { mode: 0o600 })
  writeFileSync(join(artifactRoot, "predicate.json"), "predicate", { mode: 0o600 })
  return workspace
}
