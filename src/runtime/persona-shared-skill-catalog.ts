import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const PERSONA_CORE_SKILL_IDS = [
  "deep-interview",
  "technical-intake",
  "plan",
  "ralplan",
  "tdd",
  "implementation",
  "review",
  "programming",
  "debug",
  "refactor",
  "git",
] as const

export const PERSONA_OPTIONAL_SKILL_IDS = ["frontend", "visual-qa", "ast-grep", "lsp-setup"] as const

export type PersonaSharedSkillId =
  | (typeof PERSONA_CORE_SKILL_IDS)[number]
  | (typeof PERSONA_OPTIONAL_SKILL_IDS)[number]

export type PersonaSharedSkill = {
  readonly id: PersonaSharedSkillId
  readonly title: string
  readonly category: "core" | "optional-extension"
  readonly optional: boolean
  readonly entry: string
  readonly startPredicate: string
  readonly mutability: "conversation-only" | "advisory" | "explicit-user-action"
  readonly inputBrief: readonly string[]
  readonly outputBrief: readonly string[]
  readonly handoff: PersonaSharedSkillId | null
}

type PersonaSharedSkillCatalog = {
  readonly schemaVersion: "persona-shared-skill-catalog.1"
  readonly packageName: "@persona-harness/shared-skills"
  readonly skills: readonly PersonaSharedSkill[]
}

const CATALOG_PATH = "packages/shared-skills/catalog.json"
const ALL_PERSONA_SKILL_IDS = [...PERSONA_CORE_SKILL_IDS, ...PERSONA_OPTIONAL_SKILL_IDS] as const

let cachedCatalog: PersonaSharedSkillCatalog | undefined

function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim() !== "")
}

function isPersonaSharedSkillId(value: unknown): value is PersonaSharedSkillId {
  return typeof value === "string" && (ALL_PERSONA_SKILL_IDS as readonly string[]).includes(value)
}

function parseSkill(value: unknown, index: number): PersonaSharedSkill {
  if (!isRecord(value)) {
    throw new Error(`Invalid Persona shared-skill catalog entry at index ${index}`)
  }

  const allowedKeys = new Set([
    "id",
    "title",
    "category",
    "optional",
    "entry",
    "startPredicate",
    "mutability",
    "inputBrief",
    "outputBrief",
    "handoff",
  ])
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw new Error(`Unexpected Persona shared-skill catalog field at index ${index}`)
  }
  if (
    !isPersonaSharedSkillId(value.id)
    || typeof value.title !== "string"
    || value.title.trim() === ""
    || (value.category !== "core" && value.category !== "optional-extension")
    || typeof value.optional !== "boolean"
    || typeof value.entry !== "string"
    || !/^skills\/[a-z-]+\/SKILL\.md$/u.test(value.entry)
    || typeof value.startPredicate !== "string"
    || value.startPredicate.trim() === ""
    || (value.mutability !== "conversation-only" && value.mutability !== "advisory" && value.mutability !== "explicit-user-action")
    || !isStringArray(value.inputBrief)
    || !isStringArray(value.outputBrief)
    || !(value.handoff === null || isPersonaSharedSkillId(value.handoff))
  ) {
    throw new Error(`Malformed Persona shared-skill catalog entry at index ${index}`)
  }

  if (value.entry !== `skills/${value.id}/SKILL.md`) {
    throw new Error(`Persona shared-skill catalog entry path does not match id at index ${index}`)
  }
  return {
    id: value.id,
    title: value.title,
    category: value.category,
    optional: value.optional,
    entry: value.entry,
    startPredicate: value.startPredicate,
    mutability: value.mutability,
    inputBrief: value.inputBrief,
    outputBrief: value.outputBrief,
    handoff: value.handoff,
  }
}

function readPersonaSharedSkillCatalog(): PersonaSharedSkillCatalog {
  if (cachedCatalog !== undefined) {
    return cachedCatalog
  }

  const parsed: unknown = JSON.parse(readFileSync(join(packageRoot(), CATALOG_PATH), "utf8"))
  if (!isRecord(parsed) || parsed.schemaVersion !== "persona-shared-skill-catalog.1" || parsed.packageName !== "@persona-harness/shared-skills" || !Array.isArray(parsed.skills)) {
    throw new Error("Malformed Persona shared-skill catalog")
  }

  const skills = parsed.skills.map(parseSkill)
  if (skills.length !== ALL_PERSONA_SKILL_IDS.length || skills.some((skill, index) => skill.id !== ALL_PERSONA_SKILL_IDS[index])) {
    throw new Error("Persona shared-skill catalog must contain the canonical skill order exactly once")
  }
  if (new Set(skills.map((skill) => skill.id)).size !== skills.length) {
    throw new Error("Persona shared-skill catalog contains duplicate skill ids")
  }

  cachedCatalog = {
    schemaVersion: parsed.schemaVersion,
    packageName: parsed.packageName,
    skills,
  }
  return cachedCatalog
}

export function listPersonaSharedSkills(): readonly PersonaSharedSkill[] {
  return readPersonaSharedSkillCatalog().skills
}

export function resolvePersonaSharedSkill(id: PersonaSharedSkillId): PersonaSharedSkill {
  const skill = listPersonaSharedSkills().find((candidate) => candidate.id === id)
  if (skill === undefined) {
    throw new Error(`Unknown Persona shared skill: ${id}`)
  }
  return skill
}

export function personaSharedSkillPath(id: PersonaSharedSkillId): string {
  return `packages/shared-skills/${resolvePersonaSharedSkill(id).entry}`
}
