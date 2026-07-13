import { lstatSync, readdirSync, readFileSync } from "node:fs"
import { isAbsolute, join, relative, resolve, sep } from "node:path"

export type PathSafetyDiagnosticCode =
  | "config.path_escape"
  | "config.path_symlink"
  | "config.path_invalid"
  | "walker.root_invalid"
  | "walker.symlink_cycle"
  | "walker.path_escape"
  | "walker.depth_exceeded"
  | "walker.entry_limit"
  | "walker.byte_limit"
  | "walker.file_byte_limit"
  | "walker.unreadable"
  | "walker.binary"

export type PathSafetyDiagnostic = {
  readonly code: PathSafetyDiagnosticCode
  readonly message: string
  readonly path: string
}

export type ConfiguredPathResolution =
  | {
      readonly ok: true
      readonly path: string
      readonly relativePath: string
    }
  | {
      readonly diagnostic: PathSafetyDiagnostic
      readonly ok: false
    }

export type BoundedWalkFile = {
  readonly absolutePath: string
  readonly bytes: number
  readonly relativePath: string
  readonly text?: string
}

export type BoundedWalkOptions = {
  readonly displayRoot?: string
  readonly extensions?: readonly string[]
  readonly includeText?: boolean
  readonly maxDepth?: number
  readonly maxEntries?: number
  readonly maxFileBytes?: number
  readonly maxTotalBytes?: number
  readonly skipDirectoryNames?: readonly string[]
}

export type BoundedWalkResult = {
  readonly diagnostics: readonly PathSafetyDiagnostic[]
  readonly files: readonly BoundedWalkFile[]
  readonly present: boolean
  readonly safe: boolean
}

export type BoundedTextReadResult =
  | {
      readonly bytes: number
      readonly ok: true
      readonly text: string
    }
  | {
      readonly diagnostic: PathSafetyDiagnostic
      readonly ok: false
    }

export const DEFAULT_BOUNDED_WALK_LIMITS = {
  maxDepth: 12,
  maxEntries: 512,
  maxFileBytes: 256 * 1024,
  maxTotalBytes: 2 * 1024 * 1024,
} as const

const MAX_DIAGNOSTIC_PATH_LENGTH = 240

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/")
}

function boundedPath(value: string): string {
  const normalized = normalizePath(value)
  return normalized.length <= MAX_DIAGNOSTIC_PATH_LENGTH
    ? normalized
    : `${normalized.slice(0, MAX_DIAGNOSTIC_PATH_LENGTH - 3)}...`
}

function diagnostic(
  code: PathSafetyDiagnosticCode,
  path: string,
  message: string,
): PathSafetyDiagnostic {
  return { code, message, path: boundedPath(path) }
}

function isInside(rootPath: string, candidatePath: string): boolean {
  const relativePath = relative(rootPath, candidatePath)
  return relativePath === ""
    || (relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath))
}

function existingPathComponents(
  projectRoot: string,
  candidatePath: string,
): PathSafetyDiagnostic | undefined {
  const relativePath = relative(projectRoot, candidatePath)
  if (!isInside(projectRoot, candidatePath)) {
    return diagnostic(
      "config.path_escape",
      relativePath || candidatePath,
      "Configured path must remain inside the project root.",
    )
  }

  let currentPath = projectRoot
  const segments = relativePath.split(sep).filter((segment) => segment.length > 0)
  for (const [index, segment] of segments.entries()) {
    currentPath = join(currentPath, segment)
    try {
      const stat = lstatSync(currentPath)
      if (stat.isSymbolicLink()) {
        return diagnostic(
          "config.path_symlink",
          segments.slice(0, index + 1).join("/"),
          "Configured path contains a symlink and is not followed.",
        )
      }
      if (index < segments.length - 1 && !stat.isDirectory()) {
        return diagnostic(
          "config.path_invalid",
          segments.slice(0, index + 1).join("/"),
          "Configured path contains a non-directory component.",
        )
      }
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined
      if (code === "ENOENT" || code === "ENOTDIR") {
        break
      }
      return diagnostic(
        code === "ELOOP" ? "config.path_symlink" : "config.path_invalid",
        segments.slice(0, index + 1).join("/"),
        "Configured path could not be inspected safely.",
      )
    }
  }
  return undefined
}

export function resolveContainedPath(
  projectDir: string,
  configuredPath: string,
): ConfiguredPathResolution {
  if (configuredPath.trim().length === 0) {
    return {
      diagnostic: diagnostic("config.path_invalid", configuredPath, "Configured path must not be empty."),
      ok: false,
    }
  }

  const projectRoot = resolve(projectDir)
  const candidatePath = isAbsolute(configuredPath)
    ? resolve(configuredPath)
    : resolve(projectRoot, configuredPath)
  const relativePath = relative(projectRoot, candidatePath)
  if (relativePath === "") {
    return {
      diagnostic: diagnostic("config.path_invalid", configuredPath, "Configured path must not be the project root."),
      ok: false,
    }
  }
  const componentDiagnostic = existingPathComponents(projectRoot, candidatePath)
  if (componentDiagnostic !== undefined) {
    return { diagnostic: componentDiagnostic, ok: false }
  }

  return {
    ok: true,
    path: candidatePath,
    relativePath: normalizePath(relativePath),
  }
}

function errorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined
}

function walkerDiagnostic(
  code: PathSafetyDiagnosticCode,
  displayPath: string,
): PathSafetyDiagnostic {
  const messages: Readonly<Record<PathSafetyDiagnosticCode, string>> = {
    "config.path_escape": "Configured path escapes the project root.",
    "config.path_symlink": "Configured path contains a symlink and is not followed.",
    "config.path_invalid": "Configured path could not be inspected safely.",
    "walker.root_invalid": "Traversal root is not a real directory.",
    "walker.symlink_cycle": "Traversal rejected a symlink or filesystem cycle.",
    "walker.path_escape": "Traversal rejected a path outside the configured root.",
    "walker.depth_exceeded": "Traversal depth limit was exceeded.",
    "walker.entry_limit": "Traversal entry limit was exceeded.",
    "walker.byte_limit": "Traversal byte limit was exceeded.",
    "walker.file_byte_limit": "A traversed file exceeded the per-file byte limit.",
    "walker.unreadable": "A traversed entry could not be read safely.",
    "walker.binary": "Binary content is not accepted as diagnostic text.",
  }
  return diagnostic(code, displayPath, messages[code])
}

function hasExtension(path: string, extensions: readonly string[] | undefined): boolean {
  if (extensions === undefined || extensions.length === 0) {
    return true
  }
  return extensions.some((extension) => path.endsWith(extension))
}

function decodeText(bytes: Buffer): string | undefined {
  if (bytes.includes(0)) {
    return undefined
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return undefined
  }
}

export function readBoundedTextFile(
  filePath: string,
  projectDir: string,
  displayPath = filePath,
  maxFileBytes = DEFAULT_BOUNDED_WALK_LIMITS.maxFileBytes,
): BoundedTextReadResult {
  const resolved = resolveContainedPath(projectDir, filePath)
  if (!resolved.ok) {
    return {
      diagnostic: walkerDiagnostic(
        resolved.diagnostic.code === "config.path_escape" ? "walker.path_escape" : "walker.symlink_cycle",
        displayPath,
      ),
      ok: false,
    }
  }
  let stat: ReturnType<typeof lstatSync>
  try {
    stat = lstatSync(resolved.path)
  } catch (error) {
    return {
      diagnostic: walkerDiagnostic(
        errorCode(error) === "ELOOP" ? "walker.symlink_cycle" : "walker.unreadable",
        displayPath,
      ),
      ok: false,
    }
  }
  if (stat.isSymbolicLink()) {
    return {
      diagnostic: walkerDiagnostic("walker.symlink_cycle", displayPath),
      ok: false,
    }
  }
  if (!stat.isFile()) {
    return {
      diagnostic: walkerDiagnostic("walker.root_invalid", displayPath),
      ok: false,
    }
  }
  if (stat.size > maxFileBytes) {
    return {
      diagnostic: walkerDiagnostic("walker.file_byte_limit", displayPath),
      ok: false,
    }
  }
  try {
    const bytes = readFileSync(resolved.path)
    const text = decodeText(bytes)
    if (text === undefined) {
      return {
        diagnostic: walkerDiagnostic("walker.binary", displayPath),
        ok: false,
      }
    }
    return { bytes: stat.size, ok: true, text }
  } catch {
    return {
      diagnostic: walkerDiagnostic("walker.unreadable", displayPath),
      ok: false,
    }
  }
}

export function walkBoundedFiles(
  rootPath: string,
  projectDir: string,
  options: BoundedWalkOptions = {},
): BoundedWalkResult {
  const limits = {
    ...DEFAULT_BOUNDED_WALK_LIMITS,
    ...options,
  }
  const configuredRoot = resolveContainedPath(projectDir, rootPath)
  if (!configuredRoot.ok) {
    return {
      diagnostics: [
        walkerDiagnostic(
          configuredRoot.diagnostic.code === "config.path_escape"
            ? "walker.path_escape"
            : "walker.symlink_cycle",
          options.displayRoot ?? rootPath,
        ),
      ],
      files: [],
      present: false,
      safe: false,
    }
  }
  const rootAbsolutePath = configuredRoot.path
  const rootDisplayPath = options.displayRoot ?? configuredRoot.relativePath

  let rootStat: ReturnType<typeof lstatSync>
  try {
    rootStat = lstatSync(rootAbsolutePath)
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      return { diagnostics: [], files: [], present: false, safe: true }
    }
    return {
      diagnostics: [walkerDiagnostic(errorCode(error) === "ELOOP" ? "walker.symlink_cycle" : "walker.unreadable", rootDisplayPath)],
      files: [],
      present: true,
      safe: false,
    }
  }

  if (rootStat.isSymbolicLink()) {
    return {
      diagnostics: [walkerDiagnostic("walker.symlink_cycle", rootDisplayPath)],
      files: [],
      present: true,
      safe: false,
    }
  }
  if (!rootStat.isDirectory()) {
    return {
      diagnostics: [walkerDiagnostic("walker.root_invalid", rootDisplayPath)],
      files: [],
      present: true,
      safe: false,
    }
  }

  const diagnostics: PathSafetyDiagnostic[] = []
  const files: BoundedWalkFile[] = []
  const skippedDirectories = new Set(options.skipDirectoryNames ?? [])
  let entryCount = 0
  let totalBytes = 0

  function visit(currentPath: string, relativeDirectory: string, depth: number): void {
    let entries: string[]
    try {
      entries = readdirSync(currentPath).sort()
    } catch (error) {
      diagnostics.push(
        walkerDiagnostic(
          errorCode(error) === "ELOOP" ? "walker.symlink_cycle" : "walker.unreadable",
          relativeDirectory.length > 0 ? `${rootDisplayPath}/${relativeDirectory}` : rootDisplayPath,
        ),
      )
      return
    }

    for (const entry of entries) {
      entryCount += 1
      const displayPath = relativeDirectory.length > 0
        ? `${rootDisplayPath}/${relativeDirectory}/${entry}`
        : `${rootDisplayPath}/${entry}`
      if (entryCount > limits.maxEntries) {
        diagnostics.push(walkerDiagnostic("walker.entry_limit", rootDisplayPath))
        return
      }

      const entryPath = join(currentPath, entry)
      let stat: ReturnType<typeof lstatSync>
      try {
        stat = lstatSync(entryPath)
      } catch (error) {
        diagnostics.push(
          walkerDiagnostic(
            errorCode(error) === "ELOOP" ? "walker.symlink_cycle" : "walker.unreadable",
            displayPath,
          ),
        )
        continue
      }

      if (stat.isSymbolicLink()) {
        diagnostics.push(walkerDiagnostic("walker.symlink_cycle", displayPath))
        continue
      }
      if (stat.isDirectory()) {
        if (skippedDirectories.has(entry)) {
          continue
        }
        if (depth >= limits.maxDepth) {
          diagnostics.push(walkerDiagnostic("walker.depth_exceeded", displayPath))
          continue
        }
        visit(entryPath, relativeDirectory.length > 0 ? `${relativeDirectory}/${entry}` : entry, depth + 1)
        continue
      }
      if (!stat.isFile()) {
        continue
      }
      if (!isInside(rootAbsolutePath, entryPath)) {
        diagnostics.push(walkerDiagnostic("walker.path_escape", displayPath))
        continue
      }

      const bytes = stat.size
      if (bytes > limits.maxFileBytes) {
        diagnostics.push(walkerDiagnostic("walker.file_byte_limit", displayPath))
        continue
      }
      if (totalBytes + bytes > limits.maxTotalBytes) {
        diagnostics.push(walkerDiagnostic("walker.byte_limit", displayPath))
        continue
      }
      totalBytes += bytes

      if (!hasExtension(entry, options.extensions)) {
        continue
      }

      if (options.includeText !== true) {
        files.push({
          absolutePath: entryPath,
          bytes,
          relativePath: relativeDirectory.length > 0 ? `${relativeDirectory}/${entry}` : entry,
        })
        continue
      }

      let content: Buffer
      try {
        content = readFileSync(entryPath)
      } catch {
        diagnostics.push(walkerDiagnostic("walker.unreadable", displayPath))
        continue
      }
      const text = decodeText(content)
      if (text === undefined) {
        diagnostics.push(walkerDiagnostic("walker.binary", displayPath))
        continue
      }
      files.push({
        absolutePath: entryPath,
        bytes,
        relativePath: relativeDirectory.length > 0 ? `${relativeDirectory}/${entry}` : entry,
        text,
      })
    }
  }

  visit(rootAbsolutePath, "", 0)
  return {
    diagnostics,
    files,
    present: true,
    safe: diagnostics.length === 0,
  }
}
