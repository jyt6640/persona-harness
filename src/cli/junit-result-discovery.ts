import { Buffer } from "node:buffer"
import { createHash } from "node:crypto"
import { lstatSync } from "node:fs"
import { join } from "node:path"

import {
  DEFAULT_BOUNDED_WALK_LIMITS,
  walkBoundedFiles,
  type PathSafetyDiagnostic,
  type PathSafetyDiagnosticCode,
} from "../io/bounded-path-walker.js"
import type { ProjectReadBoundary, ProjectReadTreeEntry } from "../io/bootstrap-write-boundary.js"

export const JUNIT_RESULT_DIRS = ["build/test-results/test", "target/surefire-reports"] as const

export const JUNIT_RESULT_DISCOVERY_LIMITS = {
  maxDepth: DEFAULT_BOUNDED_WALK_LIMITS.maxDepth,
  maxEntries: DEFAULT_BOUNDED_WALK_LIMITS.maxEntries,
  maxFileBytes: DEFAULT_BOUNDED_WALK_LIMITS.maxFileBytes,
  maxTotalBytes: DEFAULT_BOUNDED_WALK_LIMITS.maxTotalBytes,
} as const

export type JunitResultDiscoveryOptions = {
  readonly baseline?: ReadonlyMap<string, JunitResultFileSnapshot>
  readonly minimumMtimeMs?: number
  readonly minimumMtimeToleranceMs?: number
  readonly projectReadBoundary?: ProjectReadBoundary
  readonly validateXml?: boolean
}

export type JunitResultFileSnapshot = {
  readonly bytes: number
  readonly dev: string
  readonly ino: string
  readonly mtimeMs: number
  readonly sha256: string
}

export type JunitResultSnapshot = {
  readonly diagnostics: readonly string[]
  readonly files: ReadonlyMap<string, JunitResultFileSnapshot>
  readonly safe: boolean
}

export type JunitResultFile = {
  readonly ref: string
  readonly text: string
}

export type JunitResultDiscovery = {
  readonly diagnostics: readonly string[]
  readonly files: readonly JunitResultFile[]
  readonly safe: boolean
}

const PATH_DIAGNOSTIC_CODES = {
  "config.path_escape": "junit-path-escape",
  "config.path_invalid": "junit-root-invalid",
  "config.path_symlink": "junit-symlink-rejected",
  "walker.binary": "junit-binary",
  "walker.byte_limit": "junit-total-byte-limit",
  "walker.depth_exceeded": "junit-depth-exceeded",
  "walker.entry_limit": "junit-entry-limit",
  "walker.file_byte_limit": "junit-file-byte-limit",
  "walker.path_escape": "junit-path-escape",
  "walker.root_invalid": "junit-root-invalid",
  "walker.symlink_cycle": "junit-symlink-rejected",
  "walker.unreadable": "junit-unreadable",
} as const satisfies Readonly<Record<PathSafetyDiagnosticCode, string>>

export function discoverJUnitResults(
  projectDir: string,
  options: JunitResultDiscoveryOptions = {},
): JunitResultDiscovery {
  const roots = JUNIT_RESULT_DIRS.map((root) => options.projectReadBoundary === undefined
    ? discoverRoot(projectDir, root, options)
    : discoverCapturedRoot(root, options, options.projectReadBoundary))
  const diagnostics = uniqueSorted(roots.flatMap((root) => root.diagnostics))
  const files = roots
    .flatMap((root) => root.files)
    .sort((left, right) => compareStrings(left.ref, right.ref))

  return {
    diagnostics,
    files: diagnostics.length === 0 ? files : [],
    safe: diagnostics.length === 0,
  }
}

export function snapshotJUnitResults(
  projectDir: string,
  projectReadBoundary?: ProjectReadBoundary,
): JunitResultSnapshot {
  const roots = JUNIT_RESULT_DIRS.map((root) => projectReadBoundary === undefined
    ? snapshotRoot(projectDir, root)
    : snapshotCapturedRoot(root, projectReadBoundary))
  const diagnostics = uniqueSorted(roots.flatMap((root) => root.diagnostics))
  const files = new Map<string, JunitResultFileSnapshot>()
  for (const root of roots) {
    for (const [ref, snapshot] of root.files) files.set(ref, snapshot)
  }
  return {
    diagnostics,
    files,
    safe: diagnostics.length === 0,
  }
}

function discoverCapturedRoot(
  root: string,
  options: JunitResultDiscoveryOptions,
  projectReadBoundary: ProjectReadBoundary,
): JunitResultDiscovery {
  const captured = capturedRoot(root, projectReadBoundary)
  if (captured.kind === "blocked") return { diagnostics: [captured.code], files: [], safe: false }
  const diagnostics: string[] = []
  const files = captured.entries.flatMap((entry) => {
    if (entry.kind !== "file" || !entry.path.endsWith(".xml")) return []
    const text = decodeCapturedText(entry.bytes)
    if (text === undefined) {
      diagnostics.push("junit-binary")
      return []
    }
    const ref = `${root}/${entry.path}`
    const snapshot = snapshotCapturedFile(entry, text)
    const baseline = options.baseline?.get(ref)
    if (options.baseline !== undefined && baseline !== undefined && sameSnapshot(baseline, snapshot)) {
      return []
    }
    const minimumMtimeMs = options.minimumMtimeMs
    const tolerance = options.minimumMtimeToleranceMs ?? 0
    if (minimumMtimeMs !== undefined && options.baseline === undefined && snapshot.mtimeMs < minimumMtimeMs - tolerance) {
      return []
    }
    if (options.validateXml !== false && !isWellFormedJUnitXml(text)) {
      diagnostics.push("junit-malformed-xml")
      return []
    }
    return [{ ref, text }]
  })
  const sortedDiagnostics = uniqueSorted(diagnostics)
  return {
    diagnostics: sortedDiagnostics,
    files: sortedDiagnostics.length === 0 ? files.sort((left, right) => compareStrings(left.ref, right.ref)) : [],
    safe: sortedDiagnostics.length === 0,
  }
}

function snapshotCapturedRoot(
  root: string,
  projectReadBoundary: ProjectReadBoundary,
): { readonly diagnostics: readonly string[]; readonly files: ReadonlyMap<string, JunitResultFileSnapshot> } {
  const captured = capturedRoot(root, projectReadBoundary)
  if (captured.kind === "blocked") return { diagnostics: [captured.code], files: new Map() }
  const diagnostics: string[] = []
  const files = new Map<string, JunitResultFileSnapshot>()
  for (const entry of captured.entries) {
    if (entry.kind !== "file" || !entry.path.endsWith(".xml")) continue
    const text = decodeCapturedText(entry.bytes)
    if (text === undefined) {
      diagnostics.push("junit-binary")
      continue
    }
    files.set(`${root}/${entry.path}`, snapshotCapturedFile(entry, text))
  }
  return { diagnostics: uniqueSorted(diagnostics), files }
}

function capturedRoot(
  root: string,
  projectReadBoundary: ProjectReadBoundary,
): { readonly entries: readonly ProjectReadTreeEntry[]; readonly kind: "ready" } | { readonly code: string; readonly kind: "blocked" } {
  try {
    const entries = projectReadBoundary.readGeneratedProjectTreeAt(root, {
      excludedRoots: [],
      maxEntries: JUNIT_RESULT_DISCOVERY_LIMITS.maxEntries,
      maxFileBytes: JUNIT_RESULT_DISCOVERY_LIMITS.maxFileBytes,
      maxTotalBytes: JUNIT_RESULT_DISCOVERY_LIMITS.maxTotalBytes,
    })
    if (entries === undefined) return { entries: [], kind: "ready" }
    if (entries.some((entry) => entry.path.split("/").length > JUNIT_RESULT_DISCOVERY_LIMITS.maxDepth)) {
      return { code: "junit-depth-exceeded", kind: "blocked" }
    }
    return { entries, kind: "ready" }
  } catch {
    return { code: "junit-symlink-rejected", kind: "blocked" }
  }
}

function decodeCapturedText(bytes: Buffer): string | undefined {
  if (bytes.includes(0)) return undefined
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return undefined
  }
}

function snapshotCapturedFile(
  entry: Extract<ProjectReadTreeEntry, { readonly kind: "file" }>,
  text: string,
): JunitResultFileSnapshot {
  const nanoseconds = BigInt(entry.identity.mtimeNs)
  const mtimeMs = Number(nanoseconds / 1_000_000n)
  if (!Number.isSafeInteger(mtimeMs)) throw new Error("junit native timestamp unavailable")
  return {
    bytes: entry.bytes.byteLength,
    dev: entry.identity.dev,
    ino: entry.identity.ino,
    mtimeMs,
    sha256: createHash("sha256").update(text).digest("hex"),
  }
}

function discoverRoot(
  projectDir: string,
  root: string,
  options: JunitResultDiscoveryOptions,
): JunitResultDiscovery {
  const walked = walkBoundedFiles(join(projectDir, root), projectDir, {
    ...JUNIT_RESULT_DISCOVERY_LIMITS,
    displayRoot: root,
    extensions: [".xml"],
    includeText: true,
  })
  const diagnostics = walked.diagnostics.map(pathDiagnosticCode)
  const minimumMtimeMs = options.minimumMtimeMs
  const minimumMtimeToleranceMs = options.minimumMtimeToleranceMs ?? 0
  const files = walked.files.flatMap((file) => {
    if (file.text === undefined) {
      return []
    }
    if (minimumMtimeMs !== undefined) {
      try {
        const stat = lstatSync(file.absolutePath)
        if (stat.isSymbolicLink() || !stat.isFile()) {
          diagnostics.push("junit-symlink-rejected")
          return []
        }
        const ref = `${root}/${file.relativePath}`
        const currentSnapshot = snapshotFile(stat, file.bytes, file.text)
        const baseline = options.baseline?.get(ref)
        if (options.baseline !== undefined && baseline !== undefined && sameSnapshot(baseline, currentSnapshot)) {
          return []
        }
        if (
          options.baseline === undefined
          && stat.mtimeMs < minimumMtimeMs - minimumMtimeToleranceMs
        ) {
          return []
        }
      } catch (error) {
        if (error instanceof Error) {
          diagnostics.push("junit-unreadable")
          return []
        }
        throw error
      }
    }
    if (options.validateXml !== false && !isWellFormedJUnitXml(file.text)) {
      diagnostics.push("junit-malformed-xml")
      return []
    }
    return [{ ref: `${root}/${file.relativePath}`, text: file.text }]
  })

  return {
    diagnostics: uniqueSorted(diagnostics),
    files,
    safe: walked.safe && diagnostics.length === 0,
  }
}

function snapshotRoot(
  projectDir: string,
  root: string,
): { readonly diagnostics: readonly string[]; readonly files: ReadonlyMap<string, JunitResultFileSnapshot> } {
  const walked = walkBoundedFiles(join(projectDir, root), projectDir, {
    ...JUNIT_RESULT_DISCOVERY_LIMITS,
    displayRoot: root,
    extensions: [".xml"],
    includeText: true,
  })
  const diagnostics = walked.diagnostics.map(pathDiagnosticCode)
  const files = new Map<string, JunitResultFileSnapshot>()
  for (const file of walked.files) {
    if (file.text === undefined) continue
    try {
      const stat = lstatSync(file.absolutePath)
      if (stat.isSymbolicLink() || !stat.isFile()) {
        diagnostics.push("junit-symlink-rejected")
        continue
      }
      files.set(`${root}/${file.relativePath}`, snapshotFile(stat, file.bytes, file.text))
    } catch (error) {
      if (error instanceof Error) {
        diagnostics.push("junit-unreadable")
        continue
      }
      throw error
    }
  }
  return { diagnostics: uniqueSorted(diagnostics), files }
}

function snapshotFile(
  stat: {
    readonly dev: number | bigint
    readonly ino: number | bigint
    readonly mtimeMs: number
  },
  bytes: number,
  text: string,
): JunitResultFileSnapshot {
  return {
    bytes,
    dev: String(stat.dev),
    ino: String(stat.ino),
    mtimeMs: stat.mtimeMs,
    sha256: createHash("sha256").update(text).digest("hex"),
  }
}

function sameSnapshot(left: JunitResultFileSnapshot, right: JunitResultFileSnapshot): boolean {
  return left.bytes === right.bytes
    && left.dev === right.dev
    && left.ino === right.ino
    && left.mtimeMs === right.mtimeMs
    && left.sha256 === right.sha256
}

function pathDiagnosticCode(diagnostic: PathSafetyDiagnostic): string {
  return PATH_DIAGNOSTIC_CODES[diagnostic.code]
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareStrings)
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function isWellFormedJUnitXml(source: string): boolean {
  const stack: string[] = []
  let rootClosed = false
  let cursor = 0

  while (cursor < source.length) {
    const tagStart = source.indexOf("<", cursor)
    if (tagStart < 0) {
      return rootClosed && source.slice(cursor).trim().length === 0 && stack.length === 0
    }
    if (source.slice(cursor, tagStart).trim().length > 0 && (rootClosed || stack.length === 0)) {
      return false
    }
    if (source.startsWith("<!--", tagStart)) {
      const commentEnd = source.indexOf("-->", tagStart + 4)
      if (commentEnd < 0) {
        return false
      }
      cursor = commentEnd + 3
      continue
    }
    if (source.startsWith("<![CDATA[", tagStart)) {
      if (stack.length === 0) {
        return false
      }
      const cdataEnd = source.indexOf("]]>", tagStart + 9)
      if (cdataEnd < 0) {
        return false
      }
      cursor = cdataEnd + 3
      continue
    }
    if (source.startsWith("<?", tagStart)) {
      const instructionEnd = source.indexOf("?>", tagStart + 2)
      if (instructionEnd < 0) {
        return false
      }
      cursor = instructionEnd + 2
      continue
    }
    if (source.startsWith("<!", tagStart)) {
      return false
    }

    const tagEnd = findTagEnd(source, tagStart + 1)
    if (tagEnd === undefined) {
      return false
    }
    const rawTag = source.slice(tagStart, tagEnd + 1)
    const closing = rawTag.match(/^<\/([A-Za-z_][A-Za-z0-9_.:-]*)\s*>$/u)
    if (closing !== null) {
      const name = closing[1]
      if (name === undefined || stack.pop() !== name) {
        return false
      }
      rootClosed = stack.length === 0
      cursor = tagEnd + 1
      continue
    }

    const opening = rawTag.match(/^<([A-Za-z_][A-Za-z0-9_.:-]*)([\s\S]*)>$/u)
    if (opening === null || opening[1] === undefined || opening[2] === undefined) {
      return false
    }
    if (rootClosed || !validAttributes(opening[2])) {
      return false
    }
    const name = opening[1]
    if (stack.length === 0 && name !== "testsuite" && name !== "testsuites") {
      return false
    }
    const selfClosing = /\/\s*$/u.test(opening[2])
    if (!selfClosing) {
      stack.push(name)
    } else if (stack.length === 0) {
      rootClosed = true
    }
    cursor = tagEnd + 1
  }

  return rootClosed && stack.length === 0
}

function findTagEnd(source: string, start: number): number | undefined {
  let quote: '"' | "'" | undefined
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (quote === undefined && (character === '"' || character === "'")) {
      quote = character
    } else if (quote !== undefined && character === quote) {
      quote = undefined
    } else if (quote === undefined && character === ">") {
      return index
    }
  }
  return undefined
}

function validAttributes(source: string): boolean {
  let attributes = source.trim()
  if (attributes.endsWith("/")) {
    attributes = attributes.slice(0, -1).trimEnd()
  }
  const seen = new Set<string>()
  let cursor = 0
  while (cursor < attributes.length) {
    while (cursor < attributes.length && /\s/u.test(attributes[cursor] ?? "")) {
      cursor += 1
    }
    if (cursor === attributes.length) {
      return true
    }
    const name = attributes.slice(cursor).match(/^[A-Za-z_:][A-Za-z0-9_.:-]*/u)?.[0]
    if (name === undefined || seen.has(name)) {
      return false
    }
    seen.add(name)
    cursor += name.length
    while (cursor < attributes.length && /\s/u.test(attributes[cursor] ?? "")) {
      cursor += 1
    }
    if (attributes[cursor] !== "=") {
      return false
    }
    cursor += 1
    while (cursor < attributes.length && /\s/u.test(attributes[cursor] ?? "")) {
      cursor += 1
    }
    const quote = attributes[cursor]
    if (quote !== '"' && quote !== "'") {
      return false
    }
    cursor += 1
    const valueEnd = attributes.indexOf(quote, cursor)
    if (valueEnd < 0) {
      return false
    }
    cursor = valueEnd + 1
  }
  return true
}
