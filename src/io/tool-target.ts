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
  "apply_patch",
  "applypatch",
  "multiedit",
  "multi_edit",
])

const PATCH_TEXT_ARG_NAMES = ["patchText", "patch_text", "patch", "input", "diff"] as const
const PATCH_HEADER_PATTERN = /^\*\*\* (?:Add|Update|Delete) File:\s*(.+?)\s*$/gmu
const UNIFIED_DIFF_HEADER_PATTERN = /^\+\+\+ (?:b\/)?(.+?)\s*$/gmu
const UNIFIED_DIFF_SOURCE_PATTERN = /^--- (?:a\/)?(.+?)\s*$/gmu
const INSTALLED_PERSONA_HARNESS_PACKAGE_PATTERN = /(^|\/)node_modules\/persona-harness\//

function normalizePath(targetFile: string): string {
  return targetFile.replace(/\\/g, "/")
}

export function isInstalledPersonaHarnessPackageFile(targetFile: string): boolean {
  return INSTALLED_PERSONA_HARNESS_PACKAGE_PATTERN.test(normalizePath(targetFile))
}

export function extractTargetFile(toolName: string, args: Readonly<Record<string, unknown>>): string | undefined {
  const normalizedToolName = toolName.toLowerCase()
  const mayTargetFile = TARGETING_TOOL_NAMES.has(normalizedToolName)
    || normalizedToolName.includes("read")
    || normalizedToolName.includes("edit")
    || normalizedToolName.includes("write")
    || normalizedToolName.includes("patch")
  if (!mayTargetFile) return undefined

  for (const argName of TARGET_FILE_ARG_NAMES) {
    const value = args[argName]
    if (typeof value === "string" && value.trim().length > 0) return value.trim()
  }
  return extractPatchTargetFile(args)
}

export function extractPatchTargetFile(args: Readonly<Record<string, unknown>>): string | undefined {
  for (const argName of PATCH_TEXT_ARG_NAMES) {
    const value = args[argName]
    if (typeof value !== "string" || value.trim().length === 0) continue
    const paths = patchTargetPaths(value)
    if (paths.length > 0) return paths.find((path) => path.toLowerCase().endsWith(".java")) ?? paths[0]
  }
  return undefined
}

function patchTargetPaths(patchText: string): readonly string[] {
  const paths: string[] = []
  for (const pattern of [PATCH_HEADER_PATTERN, UNIFIED_DIFF_HEADER_PATTERN, UNIFIED_DIFF_SOURCE_PATTERN]) {
    pattern.lastIndex = 0
    for (const match of patchText.matchAll(pattern)) {
      const captured = match[1]?.trim()
      if (captured !== undefined && captured.length > 0 && captured !== "/dev/null") paths.push(captured)
    }
  }
  return paths
}
