import { createHash } from "node:crypto"

import {
  reserveProjectReadBoundary,
  type ProjectReadBoundary,
} from "../io/bootstrap-write-boundary.js"
import { isRecord, stripJsonComments } from "../config/jsonc.js"
import {
  noFollowPathIdentityDigest,
  noFollowPathLocationDigest,
} from "../io/no-follow-file.js"
import type { SourceIdentity } from "./source-identity.js"

const PROFILE_DIRECTORY = ".persona"
const PROFILE_FILENAME = "project-profile.jsonc"
const MAX_PROFILE_BYTES = 128 * 1024
const MAX_GRADLE_ROOT_FILE_BYTES = 512 * 1024
const BUILD_FILES = ["build.gradle", "build.gradle.kts"] as const
const SETTINGS_FILES = ["settings.gradle", "settings.gradle.kts"] as const

export type ProjectFinishAttestationInputSnapshot = {
  readonly digest: string
  readonly profile: "absent" | "ready"
}

export type ProjectFinishAttestationInputSnapshotResult =
  | { readonly code: "project-finish-producer-profile"; readonly kind: "blocked" }
  | { readonly kind: "ready"; readonly value: ProjectFinishAttestationInputSnapshot }

export function captureProjectFinishAttestationInputSnapshot(
  projectDir: string,
  projectReadBoundary?: ProjectReadBoundary,
): ProjectFinishAttestationInputSnapshotResult {
  if (projectReadBoundary === undefined) {
    let boundary: ProjectReadBoundary | undefined
    try {
      boundary = reserveProjectReadBoundary(projectDir)
      return captureProjectFinishAttestationInputSnapshotWithinBoundary(projectDir, boundary)
    } catch {
      return blocked()
    } finally {
      boundary?.close()
    }
  }
  return captureProjectFinishAttestationInputSnapshotWithinBoundary(projectDir, projectReadBoundary)
}

function captureProjectFinishAttestationInputSnapshotWithinBoundary(
  _projectDir: string,
  projectReadBoundary: ProjectReadBoundary,
): ProjectFinishAttestationInputSnapshotResult {
  try {
    projectReadBoundary.assert()
    const root = projectReadBoundary.projectIdentity()

    const profile = captureProfileWithinBoundary(projectReadBoundary)
    if (profile.kind === "blocked") return profile
    const build = captureExactlyOneRootFileWithinBoundary(BUILD_FILES, projectReadBoundary)
    if (build.kind === "blocked") return build
    const settings = captureExactlyOneRootFileWithinBoundary(SETTINGS_FILES, projectReadBoundary)
    if (settings.kind === "blocked") return settings

    projectReadBoundary.assert()

    return {
      kind: "ready",
      value: {
        digest: digest(JSON.stringify({
          build,
          profile,
          root: noFollowPathLocationDigest(root),
          settings,
        })),
        profile: profile.kind,
      },
    }
  } catch {
    return blocked()
  }
}

export function sameProjectFinishAttestationInputSnapshot(
  left: ProjectFinishAttestationInputSnapshot,
  right: ProjectFinishAttestationInputSnapshot,
): boolean {
  return left.digest === right.digest && left.profile === right.profile
}

export function bindProjectFinishAttestationInputSnapshot(
  source: SourceIdentity,
  snapshot: ProjectFinishAttestationInputSnapshot,
): SourceIdentity {
  return {
    ...source,
    contentDigest: digest(JSON.stringify({
      inputSnapshotDigest: snapshot.digest,
      sourceContentDigest: source.contentDigest,
    })),
  }
}

function captureProfileWithinBoundary(
  projectReadBoundary: ProjectReadBoundary,
): { readonly digest: string; readonly kind: "absent" | "ready" } | ProjectFinishAttestationInputSnapshotResult {
  const directory = projectReadBoundary.readProjectDirectoryIdentity(PROFILE_DIRECTORY)
  if (directory === undefined) return { digest: "absent", kind: "absent" }
  const profile = projectReadBoundary.readProjectFileWithIdentity(
    `${PROFILE_DIRECTORY}/${PROFILE_FILENAME}`,
    MAX_PROFILE_BYTES,
  )
  if (profile === undefined) {
    return {
      digest: digest(JSON.stringify({ directory: noFollowPathIdentityDigest(directory) })),
      kind: "absent",
    }
  }

  try {
    const value: unknown = JSON.parse(stripJsonComments(profile.bytes.toString("utf8")))
    if (!isCanonicalProfile(value)) return blocked()
    return {
      digest: digest(JSON.stringify({
        bytes: digest(profile.bytes),
        directory: noFollowPathIdentityDigest(directory),
        identity: noFollowPathIdentityDigest(profile.identity),
      })),
      kind: "ready",
    }
  } catch {
    return blocked()
  }
}

function captureExactlyOneRootFileWithinBoundary(
  names: readonly string[],
  projectReadBoundary: ProjectReadBoundary,
): { readonly digest: string; readonly file: string; readonly kind: "ready" } | ProjectFinishAttestationInputSnapshotResult {
  const files = names.flatMap((name) => {
    const file = projectReadBoundary.readProjectFileWithIdentity(name, MAX_GRADLE_ROOT_FILE_BYTES)
    return file === undefined ? [] : [{ ...file, name }]
  })
  if (files.length !== 1) return blocked()
  const file = files[0]
  if (file === undefined) return blocked()
  return {
    digest: digest(JSON.stringify({
      bytes: digest(file.bytes),
      identity: noFollowPathIdentityDigest(file.identity),
      name: file.name,
    })),
    file: file.name,
    kind: "ready",
  }
}

function isCanonicalProfile(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.scope) || !isRecord(value.defaults)) return false
  return value.schema === "persona.project-profile.v1"
    && value.status === "ready"
    && value.scope.role === "backend"
    && value.scope.mvp === "java-spring-clean-code"
    && normalized(value.defaults.language) === "java"
    && normalized(value.defaults.framework) === "spring"
    && normalized(value.defaults.buildTool) === "gradle"
}

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function digest(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function blocked(): ProjectFinishAttestationInputSnapshotResult {
  return { code: "project-finish-producer-profile", kind: "blocked" }
}
