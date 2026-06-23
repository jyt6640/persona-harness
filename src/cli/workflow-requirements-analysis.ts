import type { RequirementSource, StepSection } from "./workflow-ticket-model.js"
import { parseStepSections } from "./workflow-ticket-model.js"

export type RequirementSplitStrategy = "step-headings" | "heading-fallback" | "single-ticket-fallback"

export type RequirementAnalysis = {
  readonly strategy: RequirementSplitStrategy
  readonly sections: readonly StepSection[]
}

function markdownHeading(line: string): string | undefined {
  const match = /^#{2,4}\s+(?!Step\b)(.+)$/iu.exec(line.trim())
  return match?.[1]?.trim()
}

function fallbackTitle(markdown: string): string {
  const firstMeaningfulLine = markdown
    .split(/\r?\n/u)
    .map((line) => line.trim().replace(/^[-*]\s+/u, "").replace(/^#+\s+/u, ""))
    .find((line) => line.length > 0)
  return firstMeaningfulLine ?? "Prompt Requirements"
}

function parseHeadingSections(markdown: string): readonly StepSection[] {
  const lines = markdown.split(/\r?\n/u)
  const sections: StepSection[] = []
  let current: { readonly title: string; readonly lines: string[] } | undefined

  for (const line of lines) {
    const heading = markdownHeading(line)
    if (heading !== undefined) {
      if (current !== undefined) {
        sections.push({
          number: String(sections.length + 1),
          title: current.title,
          body: current.lines.join("\n").trim(),
          kind: "requirement",
        })
      }
      current = { title: heading, lines: [] }
    } else if (current !== undefined) {
      current.lines.push(line)
    }
  }

  if (current !== undefined) {
    sections.push({
      number: String(sections.length + 1),
      title: current.title,
      body: current.lines.join("\n").trim(),
      kind: "requirement",
    })
  }

  return sections
}

export function analyzeRequirementSections(markdown: string): RequirementAnalysis {
  const stepSections = parseStepSections(markdown)
  if (stepSections.length > 0) {
    return { strategy: "step-headings", sections: stepSections }
  }
  const headingSections = parseHeadingSections(markdown)
  if (headingSections.length > 0) {
    return { strategy: "heading-fallback", sections: headingSections }
  }
  return {
    strategy: "single-ticket-fallback",
    sections: [{ number: "1", title: fallbackTitle(markdown), body: markdown.trim(), kind: "requirement" }],
  }
}

function ticketForSection(section: StepSection): string {
  return section.kind === "step" ? `step-${section.number}` : `req-${section.number}`
}

export function formatRequirementsAnalysis(
  source: RequirementSource,
  analysis: RequirementAnalysis,
  sourceMarkdown: string,
): string {
  return [
    "# Persona Requirements Analysis",
    "",
    `Source: ${source.label}`,
    `Source kind: ${source.kind}`,
    `Source path: ${source.path}`,
    `Split strategy: ${analysis.strategy}`,
    `Tickets proposed: ${analysis.sections.length}`,
    "",
    "## Interpretation",
    "",
    "- This is an AI-facing analysis artifact.",
    "- It converts README or prompt requirements into implementation tickets.",
    "- It does not certify generated app quality.",
    "",
    "## Proposed Backlog",
    "",
    "| Order | Ticket | Title | Basis |",
    "| --- | --- | --- | --- |",
    ...analysis.sections.map((section, index) => {
      const basis = section.kind === "step" ? "explicit Step heading" : "inferred requirement section"
      return `| ${index + 1} | ${ticketForSection(section)} | ${section.title} | ${basis} |`
    }),
    "",
    "## Source Preview",
    "",
    "```md",
    sourceMarkdown.trim().slice(0, 4_000),
    "```",
  ].join("\n") + "\n"
}
