import { createHash } from "node:crypto"
import { closeSync, fsyncSync, mkdirSync, openSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { loadHarnessConfigResult, resolveConfiguredPathResult } from "../config/harness-config.js"
import { walkBoundedFiles } from "../io/bounded-path-walker.js"
import {
  captureGitIdentity,
  captureWorkspaceIdentity,
} from "./ci-reverification-identity.js"
import { verificationWorkspaceBinding } from "./ci-reverification-mutation-snapshot.js"
import {
  captureSourceIdentity,
  captureSourceIdentityEntries,
  type SourceIdentityEntry,
} from "./source-identity.js"
import { parseSemanticTddSourceSnapshot } from "./workflow-semantic-tdd-source-snapshot-parser.js"
import type {
  SourceSnapshotEntry,
  SemanticTddSourceSnapshot,
  SemanticTddSourceSnapshotCapture,
} from "./workflow-semantic-tdd-transition-types.js"
import { SEMANTIC_TDD_SOURCE_SNAPSHOT_SCHEMA } from "./workflow-semantic-tdd-transition-types.js"

export { parseSemanticTddSourceSnapshot } from "./workflow-semantic-tdd-source-snapshot-parser.js"
export const SEMANTIC_TDD_SOURCE_SNAPSHOT_DIR = "semantic-tdd/source-snapshots"

export type SourceSnapshotRead = {
  readonly diagnostics: readonly string[]
  readonly files: readonly SemanticTddSourceSnapshot[]
  readonly present: boolean
}

export function captureSemanticTddSourceSnapshot(
  projectDir: string,
  capturedAt: string,
): SemanticTddSourceSnapshotCapture {
  const config = loadHarnessConfigResult(projectDir)
  if (!config.safe) return unavailable("harness-config-invalid")
  const evidence = resolveConfiguredPathResult(projectDir, config.config.evidenceDir)
  if (!evidence.ok) return unavailable("evidence-path-unsafe")
  const workspace = captureWorkspaceIdentity(projectDir)
  if (workspace.status === "unavailable") return workspace
  const git = captureGitIdentity(projectDir, workspace.value)
  const entries = captureSourceIdentityEntries(projectDir, git, evidence.relativePath || config.config.evidenceDir)
  if (entries.status === "unavailable") return entries
  const identity = captureSourceIdentity(projectDir, git, evidence.relativePath || config.config.evidenceDir)
  if (identity.status === "unavailable") return identity
  if (!git.available || git.status === undefined) return unavailable(git.diagnosticCode)
  const snapshotEntries = entries.value.map(snapshotEntry)
  return {
    status: "available",
    value: {
      snapshot: {
        entries: snapshotEntries,
        entriesDigest: digest(JSON.stringify(snapshotEntries)),
        schemaVersion: SEMANTIC_TDD_SOURCE_SNAPSHOT_SCHEMA,
        sourceIdentity: identity.value,
      },
      sourceHead: identity.value.repositoryHead,
      dirtyWorktreeDigest: `sha256:${git.status.digest}`,
      workspaceIdentity: workspaceBinding(workspace.value),
    },
  }
}

export function persistSemanticTddSourceSnapshot(
  projectDir: string,
  attemptId: string,
  phase: "green" | "red",
  capturedAt: string,
  capture: SemanticTddSourceSnapshotCapture,
): { readonly diagnosticCode?: string; readonly path?: string } {
  if (capture.status === "unavailable") return { diagnosticCode: capture.diagnosticCode }
  const config = loadHarnessConfigResult(projectDir)
  if (!config.safe) return { diagnosticCode: "harness-config-invalid" }
  const evidence = resolveConfiguredPathResult(projectDir, config.config.evidenceDir)
  if (!evidence.ok) return { diagnosticCode: "evidence-path-unsafe" }
  const source = capture.value
  const record: SemanticTddSourceSnapshot = {
    attemptId,
    capturedAt,
    dirtyWorktreeDigest: source.dirtyWorktreeDigest,
    entries: source.snapshot.entries,
    entriesDigest: source.snapshot.entriesDigest,
    phase,
    schemaVersion: "semantic-tdd-source-snapshot.1",
    sourceHead: source.sourceHead,
    sourceIdentity: source.snapshot.sourceIdentity,
    workspaceIdentity: source.workspaceIdentity,
  }
  const directory = join(evidence.path, SEMANTIC_TDD_SOURCE_SNAPSHOT_DIR)
  mkdirSync(directory, { recursive: true })
  const path = join(directory, `${attemptId}.json`)
  let descriptor: number | undefined
  try {
    descriptor = openSync(path, "wx", 0o600)
    writeFileSync(descriptor, `${JSON.stringify(record, null, 2)}\n`, "utf8")
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    return { path }
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor)
    if (error instanceof Error) return { diagnosticCode: "source-snapshot-write-invalid" }
    throw error
  }
}

export function readSemanticTddSourceSnapshots(projectDir: string): SourceSnapshotRead {
  const config = loadHarnessConfigResult(projectDir)
  if (!config.safe) return { diagnostics: ["harness-config-invalid"], files: [], present: false }
  const evidence = resolveConfiguredPathResult(projectDir, config.config.evidenceDir)
  if (!evidence.ok) return { diagnostics: ["evidence-path-unsafe"], files: [], present: false }
  const walked = walkBoundedFiles(join(evidence.path, SEMANTIC_TDD_SOURCE_SNAPSHOT_DIR), projectDir, {
    includeText: true,
    maxDepth: 1,
    maxEntries: 4,
    maxFileBytes: 256 * 1024,
    maxTotalBytes: 1024 * 1024,
  })
  if (!walked.present) return { diagnostics: [], files: [], present: false }
  const diagnostics = walked.diagnostics.map(() => "source-snapshot-invalid")
  const files: SemanticTddSourceSnapshot[] = []
  for (const file of walked.files) {
    if (file.relativePath.includes("/") || !file.relativePath.endsWith(".json") || file.text === undefined) {
      diagnostics.push("source-snapshot-invalid")
      continue
    }
    const parsed = parseSemanticTddSourceSnapshot(file.text)
    if (!parsed.ok) diagnostics.push("source-snapshot-invalid")
    else files.push(parsed.value)
  }
  return { diagnostics: [...new Set(diagnostics)].sort(), files, present: true }
}

function snapshotEntry(entry: SourceIdentityEntry): SourceSnapshotEntry {
  return {
    anchor: isJavaSourceAnchor(entry.path) ? "java-source" : "other",
    ...(entry.kind === "file" ? { classification: entry.classification, contentDigest: entry.contentDigest } : {}),
    kind: entry.kind,
    mode: entry.kind === "missing-tracked" ? "0000" : entry.mode,
    pathDigest: digest(entry.path),
  }
}

function isJavaSourceAnchor(path: string): boolean {
  return /^(?:src\/main\/java|src\/test\/java)\/[^/].*\.java$/u.test(path)
}

function workspaceBinding(identity: { readonly dev: string; readonly ino: string; readonly realpath: string }) {
  const binding = verificationWorkspaceBinding(identity)
  const platform = process.platform === "darwin" || process.platform === "linux" || process.platform === "win32"
    ? process.platform
    : "unknown"
  return { ...binding, platform } as const
}

function unavailable(diagnosticCode: string): { readonly diagnosticCode: string; readonly status: "unavailable" } {
  return { diagnosticCode, status: "unavailable" }
}

function digest(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}
