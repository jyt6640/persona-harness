import type { TransformSystemOutput } from "./types.js"

export const PROJECT_PHILOSOPHY_MARKER = "[Persona Harness Project Philosophy]"

export function createProjectPhilosophyBlock(philosophy: string): string {
  return [
    PROJECT_PHILOSOPHY_MARKER,
    "",
    "Apply this ready project-local convention when it is relevant to the user's implementation or review request:",
    `- ${philosophy}`,
    "",
    "For a normal code-change request, apply the convention directly; do not start a philosophy-refinement conversation.",
    "Use philosophy refinement only when the user explicitly asks to change or persist a reusable philosophy.",
    "The user's explicit request takes precedence when it conflicts with this project-local convention.",
  ].join("\n")
}

export function injectProjectPhilosophy(output: TransformSystemOutput, philosophy: string): boolean {
  if (output.system.some((entry) => entry.includes(PROJECT_PHILOSOPHY_MARKER))) {
    return false
  }
  output.system.push(createProjectPhilosophyBlock(philosophy))
  return true
}
