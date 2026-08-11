import { createHash } from "node:crypto"

import type {
  SelectedPolicyOverlay,
  SelectedRuleMetadata,
  SelectedSharedSkill,
} from "./types.js"

export const RUNTIME_CONTEXT_SECTION_KINDS = ["profile", "overlay", "rules", "skills"] as const

export type RuntimeContextSectionKind = (typeof RUNTIME_CONTEXT_SECTION_KINDS)[number]

export type RuntimeContextSection = {
  readonly kind: RuntimeContextSectionKind
  readonly digest: string
  /** Internal render lines; never include this body in evidence. */
  readonly body: readonly string[]
}

export type RuntimeContextSectionInput = {
  readonly profile: readonly string[]
  readonly overlay: {
    readonly summaryLines: readonly string[]
    readonly metadata: SelectedPolicyOverlay
  }
  readonly rules: {
    readonly selectedRules: readonly string[]
    readonly selectedRuleMetadata: readonly SelectedRuleMetadata[]
    readonly policies: readonly string[]
  }
  readonly skills: readonly SelectedSharedSkill[]
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`
  }
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`
}

function digestSemanticSection(kind: RuntimeContextSectionKind, semanticValue: unknown): string {
  return `sha256:${createHash("sha256")
    .update(stableSerialize({ schemaVersion: "runtime-context-section.1", kind, semanticValue }), "utf8")
    .digest("hex")}`
}

function section(
  kind: RuntimeContextSectionKind,
  semanticValue: unknown,
  body: readonly string[],
): RuntimeContextSection | undefined {
  return body.length === 0
    ? undefined
    : {
        kind,
        digest: digestSemanticSection(kind, semanticValue),
        body,
      }
}

export function createRuntimeContextSections(input: RuntimeContextSectionInput): readonly RuntimeContextSection[] {
  const profile = section(
    "profile",
    { summaryLines: input.profile },
    input.profile,
  )
  const overlay = section(
    "overlay",
    { metadata: input.overlay.metadata, summaryLines: input.overlay.summaryLines },
    input.overlay.summaryLines,
  )
  const rulesBody = [
    "Selected rules:",
    ...input.rules.selectedRules.map((rule) => `- ${rule}`),
    "",
    "Applied policies:",
    ...input.rules.policies.map((policy) => `- ${policy}`),
  ]
  const rules = section(
    "rules",
    {
      policies: input.rules.policies,
      selectedRuleMetadata: input.rules.selectedRuleMetadata,
      selectedRules: input.rules.selectedRules,
    },
    input.rules.selectedRules.length > 0 || input.rules.policies.length > 0 ? rulesBody : [],
  )
  const skillsBody = [
    "Selected skills:",
    ...input.skills.map((skill) => `- ${skill.name} (${skill.domain}): ${skill.reason}`),
  ]
  const skills = section(
    "skills",
    { skills: input.skills },
    input.skills.length > 0 ? skillsBody : [],
  )

  return [profile, overlay, rules, skills].filter((value): value is RuntimeContextSection => value !== undefined)
}

export function runtimeContextDigest(sections: readonly RuntimeContextSection[]): string {
  return `sha256:${createHash("sha256")
    .update(
      stableSerialize({
        schemaVersion: "runtime-context.1",
        sections: sections.map((current) => ({ kind: current.kind, digest: current.digest })),
      }),
      "utf8",
    )
    .digest("hex")}`
}
