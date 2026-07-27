import { createHash } from "node:crypto"
import { join } from "node:path"

import type { ProjectReadBoundary } from "../io/bootstrap-write-boundary.js"
import { isRecord, stripJsonComments } from "../config/jsonc.js"
import {
  captureNoFollowDirectory,
  noFollowPathIdentityDigest,
  noFollowPathLocationDigest,
  readNoFollowRegularFile,
  sameNoFollowPathIdentity,
  type NoFollowPathIdentity,
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
  if (projectReadBoundary !== undefined) {
    return captureProjectFinishAttestationInputSnapshotWithinBoundary(projectDir, projectReadBoundary)
  }
  const root = captureNoFollowDirectory(projectDir)
  if (root.kind !== "ready") return blocked()

  const profile = captureProfile(projectDir, root.value)
  if (profile.kind === "blocked") return profile
  const build = captureExactlyOneRootFile(projectDir, BUILD_FILES, root.value)
  if (build.kind === "blocked") return build
  const settings = captureExactlyOneRootFile(projectDir, SETTINGS_FILES, root.value)
  if (settings.kind === "blocked") return settings

  const postRoot = captureNoFollowDirectory(projectDir)
  if (postRoot.kind !== "ready" || !sameNoFollowPathIdentity(root.value, postRoot.value)) return blocked()

  return {
    kind: "ready",
    value: {
      digest: digest(JSON.stringify({
        build,
        profile,
        root: noFollowPathLocationDigest(root.value),
        settings,
      })),
      profile: profile.kind,
    },
  }
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

function captureProfile(
  projectDir: string,
  root: NoFollowPathIdentity,
): { readonly digest: string; readonly kind: "absent" | "ready" } | ProjectFinishAttestationInputSnapshotResult {
  const directoryPath = join(projectDir, PROFILE_DIRECTORY)
  const directory = captureNoFollowDirectory(directoryPath)
  if (directory.kind === "absent") return { digest: "absent", kind: "absent" }
  if (directory.kind !== "ready") return blocked()

  const profile = readNoFollowRegularFile(
    join(directoryPath, PROFILE_FILENAME),
    MAX_PROFILE_BYTES,
    directoryPath,
  )
  if (profile.kind === "absent") return stableAbsentProfile(projectDir, root, directoryPath, directory.value)
  if (profile.kind !== "ready") return blocked()

  const postDirectory = captureNoFollowDirectory(directoryPath)
  const postRoot = captureNoFollowDirectory(projectDir)
  if (
    postDirectory.kind !== "ready"
    || postRoot.kind !== "ready"
    || !sameNoFollowPathIdentity(directory.value, postDirectory.value)
    || !sameNoFollowPathIdentity(root, postRoot.value)
  ) {
    return blocked()
  }

  try {
    const value: unknown = JSON.parse(stripJsonComments(profile.value.bytes.toString("utf8")))
    if (!isCanonicalProfile(value)) return blocked()
    return {
      digest: digest(JSON.stringify({
        bytes: digest(profile.value.bytes),
        directory: noFollowPathIdentityDigest(directory.value),
        identity: noFollowPathIdentityDigest(profile.value.identity),
      })),
      kind: "ready",
    }
  } catch {
    return blocked()
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

function stableAbsentProfile(
  projectDir: string,
  root: NoFollowPathIdentity,
  directoryPath: string,
  directory: NoFollowPathIdentity,
): { readonly digest: string; readonly kind: "absent" } | ProjectFinishAttestationInputSnapshotResult {
  const postDirectory = captureNoFollowDirectory(directoryPath)
  const postRoot = captureNoFollowDirectory(projectDir)
  if (
    postDirectory.kind !== "ready"
    || postRoot.kind !== "ready"
    || !sameNoFollowPathIdentity(directory, postDirectory.value)
    || !sameNoFollowPathIdentity(root, postRoot.value)
  ) {
    return blocked()
  }
  return {
    digest: digest(JSON.stringify({ directory: noFollowPathIdentityDigest(directory) })),
    kind: "absent",
  }
}

function captureExactlyOneRootFile(
  projectDir: string,
  names: readonly string[],
  root: NoFollowPathIdentity,
): { readonly digest: string; readonly file: string; readonly kind: "ready" } | ProjectFinishAttestationInputSnapshotResult {
  const captures = names.map((name) => ({
    name,
    value: readNoFollowRegularFile(join(projectDir, name), MAX_GRADLE_ROOT_FILE_BYTES, projectDir),
  }))
  if (captures.some(({ value }) => value.kind === "blocked")) return blocked()
  const files = captures.filter((capture) => capture.value.kind === "ready")
  if (files.length !== 1) return blocked()

  const postRoot = captureNoFollowDirectory(projectDir)
  const file = files[0]
  if (file === undefined || file.value.kind !== "ready" || postRoot.kind !== "ready" || !sameNoFollowPathIdentity(root, postRoot.value)) {
    return blocked()
  }
  return {
    digest: digest(JSON.stringify({
      bytes: digest(file.value.value.bytes),
      identity: noFollowPathIdentityDigest(file.value.value.identity),
      name: file.name,
    })),
    file: file.name,
    kind: "ready",
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
