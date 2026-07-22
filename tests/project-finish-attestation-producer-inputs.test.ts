import fs, {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { syncBuiltinESMExports } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  captureProjectFinishAttestationInputSnapshot,
} from "../src/cli/project-finish-attestation-inputs.js"

const projects: string[] = []

afterEach(() => {
  for (const project of projects.splice(0)) {
    rmSync(project, { force: true, recursive: true })
  }
})

describe("project finish producer input snapshot", () => {
  it("accepts a profile-less public Gradle root and binds its fixed descriptors", () => {
    const projectDir = createProject()

    const snapshot = captureProjectFinishAttestationInputSnapshot(projectDir)

    expect(snapshot).toMatchObject({
      kind: "ready",
      value: { profile: "absent" },
    })
  })

  it("accepts a canonical optional profile without invoking the local intake completeness gate", () => {
    const projectDir = createProject()
    writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), `${JSON.stringify(canonicalProfile())}\n`)

    expect(captureProjectFinishAttestationInputSnapshot(projectDir)).toMatchObject({
      kind: "ready",
      value: { profile: "ready" },
    })
  })

  it.each([
    ["malformed profile", (projectDir: string) => writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), "{\n")],
    ["oversized profile", (projectDir: string) => writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), Buffer.alloc(128 * 1024 + 1, 0x20))],
    ["profile leaf symlink", (projectDir: string) => {
      const outside = join(projectDir, "outside-profile.jsonc")
      writeFileSync(outside, JSON.stringify(canonicalProfile()))
      symlinkSync(outside, join(projectDir, ".persona", "project-profile.jsonc"))
    }],
    ["settings symlink", (projectDir: string) => {
      const outside = join(projectDir, "outside-settings.gradle")
      writeFileSync(outside, "rootProject.name = 'outside'\n")
      rmSync(join(projectDir, "settings.gradle"))
      symlinkSync(outside, join(projectDir, "settings.gradle"))
    }],
    ["profile parent symlink", (projectDir: string) => {
      const profileDirectory = join(projectDir, ".persona")
      const outside = join(projectDir, "outside-persona")
      rmSync(profileDirectory, { force: true, recursive: true })
      mkdirSync(outside)
      symlinkSync(outside, profileDirectory)
    }],
    ["duplicate build descriptors", (projectDir: string) => writeFileSync(join(projectDir, "build.gradle.kts"), "plugins { java }\n")],
  ])("blocks a %s before fixed Gradle execution", (_name, arrange) => {
    const projectDir = createProject()
    arrange(projectDir)

    expect(captureProjectFinishAttestationInputSnapshot(projectDir)).toEqual({
      code: "project-finish-producer-profile",
      kind: "blocked",
    })
  })

  it("rejects a root Gradle descriptor replaced with an external symlink at no-follow open", () => {
    const projectDir = createProject()
    const buildPath = join(projectDir, "build.gradle")
    const draftPath = join(projectDir, "build.draft.gradle")
    const outsidePath = join(projectDir, "outside-build.gradle")
    writeFileSync(outsidePath, "plugins { id 'outside' }\n")

    const swapped = swapAtNoFollowOpen(buildPath, draftPath, outsidePath, () => (
      captureProjectFinishAttestationInputSnapshot(projectDir)
    ))

    expect(swapped.didSwap).toBe(true)
    expect(swapped.value).toEqual({
      code: "project-finish-producer-profile",
      kind: "blocked",
    })
    expect(JSON.stringify(swapped.value)).not.toContain(outsidePath)
  })

  it("does not reflect external secret-shaped profile bytes when a no-follow open is blocked", () => {
    const projectDir = createProject()
    const profilePath = join(projectDir, ".persona", "project-profile.jsonc")
    const draftPath = join(projectDir, ".persona", "project-profile.draft.jsonc")
    const outsidePath = join(projectDir, "outside-profile.jsonc")
    const marker = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    writeFileSync(profilePath, `${JSON.stringify({ ...canonicalProfile(), status: "draft" })}\n`)
    writeFileSync(outsidePath, `${JSON.stringify({ marker, ...canonicalProfile() })}\n`)

    const swapped = swapAtNoFollowOpen(profilePath, draftPath, outsidePath, () => (
      captureProjectFinishAttestationInputSnapshot(projectDir)
    ))

    expect(swapped.didSwap).toBe(true)
    expect(swapped.value).toEqual({
      code: "project-finish-producer-profile",
      kind: "blocked",
    })
    expect(JSON.stringify(swapped.value)).not.toContain(marker)
  })

  it("rejects a profile parent replaced with an external symlink while its child opens", () => {
    const projectDir = createProject()
    const profileDirectory = join(projectDir, ".persona")
    const draftDirectory = join(projectDir, ".persona.draft")
    const outsideDirectory = join(projectDir, "outside-persona")
    const profilePath = join(profileDirectory, "project-profile.jsonc")
    const marker = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    mkdirSync(outsideDirectory)
    writeFileSync(profilePath, `${JSON.stringify(canonicalProfile())}\n`)
    writeFileSync(join(outsideDirectory, "project-profile.jsonc"), `${JSON.stringify({ marker, ...canonicalProfile() })}\n`)

    const swapped = swapParentAtNoFollowOpen(profilePath, profileDirectory, draftDirectory, outsideDirectory, () => (
      captureProjectFinishAttestationInputSnapshot(projectDir)
    ))

    expect(swapped.didSwap).toBe(true)
    expect(swapped.value).toEqual({
      code: "project-finish-producer-profile",
      kind: "blocked",
    })
    expect(JSON.stringify(swapped.value)).not.toContain(marker)
  })
})

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "project-finish-inputs-"))
  projects.push(projectDir)
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'fixture'\n")
  return projectDir
}

function canonicalProfile(): Readonly<Record<string, unknown>> {
  return {
    defaults: { buildTool: "gradle", framework: "spring", language: "java" },
    schema: "persona.project-profile.v1",
    scope: { mvp: "java-spring-clean-code", role: "backend" },
    status: "ready",
  }
}

function swapAtNoFollowOpen<T>(
  sourcePath: string,
  draftPath: string,
  outsidePath: string,
  action: () => T,
): { readonly didSwap: boolean; readonly value: T } {
  const originalOpen = fs.openSync
  let swapped = false
  fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
    if (!swapped && args[0] === sourcePath) {
      swapped = true
      renameSync(sourcePath, draftPath)
      symlinkSync(outsidePath, sourcePath)
    }
    return originalOpen(...args)
  }) as typeof fs.openSync
  syncBuiltinESMExports()
  try {
    const value = action()
    return { didSwap: swapped, value }
  } finally {
    fs.openSync = originalOpen
    syncBuiltinESMExports()
    if (swapped) {
      unlinkSync(sourcePath)
      renameSync(draftPath, sourcePath)
    }
  }
}

function swapParentAtNoFollowOpen<T>(
  sourcePath: string,
  sourceDirectory: string,
  draftDirectory: string,
  outsideDirectory: string,
  action: () => T,
): { readonly didSwap: boolean; readonly value: T } {
  const originalOpen = fs.openSync
  let swapped = false
  fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
    if (!swapped && args[0] === sourcePath) {
      swapped = true
      renameSync(sourceDirectory, draftDirectory)
      symlinkSync(outsideDirectory, sourceDirectory)
    }
    return originalOpen(...args)
  }) as typeof fs.openSync
  syncBuiltinESMExports()
  try {
    const value = action()
    return { didSwap: swapped, value }
  } finally {
    fs.openSync = originalOpen
    syncBuiltinESMExports()
    if (swapped) {
      unlinkSync(sourceDirectory)
      renameSync(draftDirectory, sourceDirectory)
    }
  }
}
