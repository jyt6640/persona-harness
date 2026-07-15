import { isAbsolute, relative, resolve } from "node:path"

export const PUBLIC_REDACTED_PATH = "[REDACTED_PATH]"

const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/u
const UNC_ABSOLUTE_PATH = /^\\\\/u

export function publicEvidencePath(projectDir: string, targetPath: string): string {
  if (targetPath.includes("\u0000") || WINDOWS_ABSOLUTE_PATH.test(targetPath) || UNC_ABSOLUTE_PATH.test(targetPath)) {
    return PUBLIC_REDACTED_PATH
  }

  const projectRoot = resolve(projectDir)
  const target = resolve(targetPath)
  const projectRelative = relative(projectRoot, target).replace(/\\/gu, "/")
  if (
    isAbsolute(projectRelative)
    || projectRelative === ".."
    || projectRelative.startsWith("../")
    || /^[A-Za-z]:\//u.test(projectRelative)
  ) {
    return PUBLIC_REDACTED_PATH
  }
  return projectRelative === "" ? "." : projectRelative
}

export function publicProjectRoot(): "." {
  return "."
}
