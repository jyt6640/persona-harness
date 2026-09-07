export const MAX_CONTEXT_TARGETS = 32
const MAX_TOOL_INPUT_CHARS = 262_144
const FILE_KEYS = ["targetFile", "filePath", "filepath", "file_path", "path", "file"] as const
const PATCH_KEYS = ["patchText", "patch_text", "patch", "input", "diff"] as const
const TARGET_TOOLS = new Set(["read", "read_file", "edit", "edit_file", "write", "write_file", "patch", "apply_patch", "applypatch", "multiedit", "multi_edit"])
const PATCH_TOOLS = new Set(["patch", "apply_patch", "applypatch"])

export type ContextToolTargets =
  | { readonly kind: "targets"; readonly paths: readonly string[] }
  | { readonly kind: "unsupported" }
  | { readonly kind: "blocked"; readonly reason: "tool-input-invalid" | "target-limit" }

export function extractContextTargets(toolName: string, input: unknown): ContextToolTargets {
  const tool = toolName.toLowerCase().split(".").at(-1) ?? ""
  if (!TARGET_TOOLS.has(tool)) return { kind: "unsupported" }
  const args = typeof input === "string" && PATCH_TOOLS.has(tool) ? { input } : input
  if (!isRecord(args)) return { kind: "blocked", reason: "tool-input-invalid" }
  const paths = new Set<string>()
  let chars = 0
  const entries = Array.isArray(args.edits) ? [args, ...args.edits] : [args]
  if (entries.length > MAX_CONTEXT_TARGETS + 1) return { kind: "blocked", reason: "target-limit" }
  for (const entry of entries) {
    if (!isRecord(entry)) return { kind: "blocked", reason: "tool-input-invalid" }
    for (const key of FILE_KEYS) {
      const value = entry[key]
      if (value === undefined) continue
      if (typeof value !== "string" || value.trim().length === 0 || value.length > 4_096) {
        return { kind: "blocked", reason: "tool-input-invalid" }
      }
      paths.add(value.trim())
    }
    for (const key of PATCH_TOOLS.has(tool) ? [...PATCH_KEYS, "command"] : PATCH_KEYS) {
      const value = entry[key]
      if (value === undefined) continue
      if (typeof value !== "string") return { kind: "blocked", reason: "tool-input-invalid" }
      chars += value.length
      if (chars > MAX_TOOL_INPUT_CHARS) return { kind: "blocked", reason: "tool-input-invalid" }
      for (const line of value.split("\n")) {
        const path = /^\*\*\* (?:(?:Add|Update|Delete) File:|Move to:)\s*(.+?)\s*$/u.exec(line)?.[1]
          ?? /^(?:\+\+\+ (?:b\/)?|--- (?:a\/)?)([^\t]+)(?:\t.*)?$/u.exec(line)?.[1]?.trim()
        if (path !== undefined && path !== "/dev/null") paths.add(path)
      }
    }
    if (paths.size > MAX_CONTEXT_TARGETS) return { kind: "blocked", reason: "target-limit" }
  }
  return paths.size === 0
    ? { kind: "blocked", reason: "tool-input-invalid" }
    : { kind: "targets", paths: [...paths].sort() }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
