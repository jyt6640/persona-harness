const TARGET_FILE_ARG_NAMES = [
  "targetFile",
  "filePath",
  "filepath",
  "file_path",
  "path",
  "file",
] as const

const TARGETING_TOOL_NAMES = new Set([
  "read",
  "edit",
  "write",
  "patch",
  "multiedit",
  "multi_edit",
])

const INSTALLED_PERSONA_HARNESS_PACKAGE_PATTERN = /(^|\/)node_modules\/persona-harness\//

function normalizePath(targetFile: string): string {
  return targetFile.replace(/\\/g, "/")
}

export function isInstalledPersonaHarnessPackageFile(targetFile: string): boolean {
  return INSTALLED_PERSONA_HARNESS_PACKAGE_PATTERN.test(normalizePath(targetFile))
}

export function extractTargetFile(toolName: string, args: Record<string, unknown>): string | undefined {
  const normalizedToolName = toolName.toLowerCase()
  const mayTargetFile =
    TARGETING_TOOL_NAMES.has(normalizedToolName) ||
    normalizedToolName.includes("read") ||
    normalizedToolName.includes("edit") ||
    normalizedToolName.includes("write")

  if (!mayTargetFile) {
    return undefined
  }

  for (const argName of TARGET_FILE_ARG_NAMES) {
    const value = args[argName]
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim()
    }
  }

  return undefined
}
