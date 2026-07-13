import { createHash } from "node:crypto"
import { lstatSync, readFileSync } from "node:fs"
import { isAbsolute, join, relative, resolve } from "node:path"

export function readJson(root, relativePath, errors, field) {
  const text = readText(root, relativePath, errors, field)
  if (text === undefined) return undefined
  return parseJson(text, field, errors)
}

export function readText(root, relativePath, errors, field) {
  const absolute = resolveSafe(root, relativePath, errors, field)
  return absolute === undefined ? undefined : readTextAt(absolute, relativePath, errors)
}

export function readTextAt(absolute, relativePath, errors) {
  try {
    const stat = lstatSync(absolute)
    if (stat.isSymbolicLink() || !stat.isFile()) {
      error(errors, "UNSAFE_PATH", relativePath, "referenced file is not a regular non-symlink file")
      return undefined
    }
    return readFileSync(absolute, "utf8")
  } catch {
    error(errors, "PATH_MISSING", relativePath, "referenced corpus path is unreadable or missing")
    return undefined
  }
}

export function resolveSafe(root, relativePath, errors, field) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || relativePath.includes("\0") || relativePath.includes("\\") || isAbsolute(relativePath)) {
    error(errors, "UNSAFE_PATH", field, "path must be a relative POSIX path")
    return undefined
  }
  const segments = relativePath.split("/")
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    error(errors, "UNSAFE_PATH", field, "path contains unsafe traversal segments")
    return undefined
  }
  const absolute = resolve(root, ...segments)
  const relativeToRoot = relative(root, absolute)
  if (relativeToRoot.startsWith("..") || isAbsolute(relativeToRoot)) {
    error(errors, "UNSAFE_PATH", field, "path escapes the corpus root")
    return undefined
  }
  let current = root
  for (let index = 0; index < segments.length; index += 1) {
    current = join(current, segments[index])
    try {
      const stat = lstatSync(current)
      if (stat.isSymbolicLink()) {
        error(errors, "UNSAFE_PATH", field, "path component is a symlink")
        return undefined
      }
      if (index < segments.length - 1 && !stat.isDirectory()) {
        error(errors, "UNSAFE_PATH", field, "path parent is not a directory")
        return undefined
      }
    } catch {
      error(errors, "PATH_MISSING", field, "referenced corpus path is missing")
      return undefined
    }
  }
  return absolute
}

export function error(errors, code, path, message) {
  errors.push({ code, path, message })
}

export function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

export function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseJson(text, field, errors) {
  try {
    return JSON.parse(text)
  } catch {
    error(errors, "JSON_MALFORMED", field, "referenced JSON is malformed")
    return undefined
  }
}
