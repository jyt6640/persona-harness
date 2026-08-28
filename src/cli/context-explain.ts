import {
  readContextPreview,
  type ContextPreviewData,
  type ContextPreviewOptions,
} from "./context-preview.js"

export type ContextExplainCommandResult = {
  readonly status: 0 | 1
  readonly stderr: string
  readonly stdout: string
}

export function runContextExplainCommand(
  args: readonly string[],
  projectDir: string,
  options: ContextPreviewOptions = {},
): ContextExplainCommandResult {
  const result = readContextPreview(args, projectDir, options)
  if (result.status === "blocked") return failure(result.code)
  return success(renderExplanation(result.preview))
}

function renderExplanation(preview: ContextPreviewData): string {
  const { contextEnabled, detected, envelope, resolution } = preview
  const lines = [
    "Context Explanation (Experimental)",
    `Target: ${envelope.target.path}`,
    `Detected language: ${detected.language}`,
    `Detected file role: ${detected.fileRole}`,
    `Context enabled: ${contextEnabled}`,
    `Envelope status: ${envelope.status}`,
  ]

  if (resolution.status === "blocked") {
    lines.push(`Resolution: ${resolution.reason}`)
  } else {
    lines.push(...renderSelections(resolution))
    lines.push(...renderShadows(resolution))
  }

  lines.push(
    `Budget: selected=${envelope.budget.usedCapsules} chars=${envelope.budget.usedChars} / capsules=${envelope.budget.maxCapsules} chars=${envelope.budget.maxChars}`,
    `Digest: ${envelope.digest}`,
  )
  return `${lines.join("\n")}\n`
}

function renderSelections(preview: Extract<ContextPreviewData["resolution"], { readonly status: "resolved" }>): readonly string[] {
  if (preview.selected.length === 0) return ["Selected: none"]
  return preview.selected.map((selection) => (
    `Selected: ${selection.id} topic=${selection.topic} layer=${selection.layer} reason=${selection.reason}`
  ))
}

function renderShadows(preview: Extract<ContextPreviewData["resolution"], { readonly status: "resolved" }>): readonly string[] {
  if (preview.shadowed.length === 0) return ["Shadowed: none"]
  return preview.shadowed.map((shadow) => (
    `Shadowed: ${shadow.id} -> ${shadow.winnerId} topic=${shadow.topic} reason=${shadow.reason}`
  ))
}

function success(stdout: string): ContextExplainCommandResult {
  return { status: 0, stderr: "", stdout }
}

function failure(code: string): ContextExplainCommandResult {
  return { status: 1, stderr: `${code}\n`, stdout: "" }
}
