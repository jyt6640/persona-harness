export const AGENTS_START_MARKER =
  "<!-- persona-harness:agents:start schema=persona-harness.agents.v1 -->"
export const AGENTS_END_MARKER = "<!-- persona-harness:agents:end -->"
export const LEGACY_AGENTS_TITLE = "# Persona Harness Agent Instructions"
export const LEGACY_IMPLEMENT_COMMAND = "npx ph workflow implement"
export const LEGACY_FINISH_COMMAND = "npx ph workflow finish implement"

export function backendAgentInstructions(): string {
  return [
    LEGACY_AGENTS_TITLE,
    "",
    "This project is initialized with Persona Harness for Java/Spring backend work.",
    "",
    "Project-local philosophy:",
    "- Read `.persona/project-profile.jsonc` directly. Do not rely on Glob results for hidden `.persona` paths.",
    "- Use the project profile as the source of truth for language, framework, build tool, storage, persistence, migration, package style, and architecture style.",
    "- When its ready `philosophy.project` convention is relevant, apply it directly to implementation or review work.",
    "- A direct code-change request or one-off coding preference is not a request to refine philosophy. Use `ph philosophy refine --stdin` only when the user explicitly asks to change, review, or persist a reusable philosophy.",
    "- If README.md does not mention a technology stack, keep the stack from `.persona/project-profile.jsonc`.",
    "",
    "Workflow evidence:",
    "- `ph workflow` is product behavior, not a ceremony for every code edit.",
    "- For a small, concrete change: inspect the relevant code, make the minimum change, and run focused verification. Do not start a workflow solely for that edit.",
    "- For a public delivery boundary that is concrete and approved, run `npx ph workflow implement` once and follow the selected rail.",
    "- For an ambiguous product requirement, use the deep-interview route before starting implementation. For an explicit design pressure-test request, use the grill-me route.",
    "",
    "Do not infer a Node/CommonJS project from package.json.",
    "- package.json may exist only because Persona Harness is installed through npm.",
    "- node_modules is dependency/vendor material, not product implementation context.",
    "",
    "Do not read these as implementation context:",
    "- node_modules",
    "- .opencode/node_modules",
    "- .persona/rules",
    "- .persona/evidence",
    "",
    "After a workflow implementation boundary:",
    "- Fill `.persona/workflow/implementation-report.md`.",
    "- Fill `.persona/workflow/review-report.md`.",
    "- Run `npx ph workflow finish implement` before claiming completion.",
    "",
  ].join("\n")
}

export function managedBackendAgentInstructions(): string {
  return [
    AGENTS_START_MARKER,
    backendAgentInstructions().trimEnd(),
    AGENTS_END_MARKER,
    "",
  ].join("\n")
}

export function repairManagedBackendAgentInstructions(existing: string): string {
  const lines = existing.split(/\r?\n/)
  const start = lines.indexOf(AGENTS_START_MARKER)
  const end = lines.indexOf(AGENTS_END_MARKER)
  if (start >= 0 && end > start) {
    return [
      ...lines.slice(0, start),
      ...managedBackendAgentInstructions().trimEnd().split("\n"),
      ...lines.slice(end + 1),
    ].join("\n").replace(/\n*$/u, "\n")
  }
  return managedBackendAgentInstructions()
}
