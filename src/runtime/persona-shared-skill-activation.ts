import {
  PERSONA_CORE_SKILL_IDS,
  PERSONA_OPTIONAL_SKILL_IDS,
  resolvePersonaSharedSkill,
  type PersonaSharedSkillId,
} from "./persona-shared-skill-catalog.js"

export type PersonaProductDiscoveryMode = "new-product" | "brownfield-change-discovery"

export type PersonaSharedSkillActivation = {
  readonly decision: "automatic" | "explicit"
  readonly firstAction: "one-question-product-interview" | "code-first-change-discovery" | "advisory-reference"
  readonly handoff: PersonaSharedSkillId | null
  readonly reason: string
  readonly skillId: PersonaSharedSkillId
}

export type ExplicitPersonaSkillCommand =
  | { readonly kind: "none" }
  | { readonly kind: "valid"; readonly skillId: PersonaSharedSkillId }
  | { readonly kind: "malformed" }
  | { readonly kind: "unavailable" }

export type AutomaticPersonaSkillIntent =
  | "product-interview"
  | "decision-grill"
  | "requirements"
  | "debug"
  | "review"
  | "refactor"
  | "git"
  | "programming"

const EXPLICIT_COMMAND = "/persona"
const SKILL_ID_PATTERN = /^[a-z][a-z-]*$/u
const KNOWN_SKILL_IDS = new Set<string>([...PERSONA_CORE_SKILL_IDS, ...PERSONA_OPTIONAL_SKILL_IDS])
const DISCOVERY_SUPPRESSION_PATTERN = /(?:\b(?:skip|defer|stop|pause)\b.*\b(?:product\s+)?(?:discovery|interview)\b|(?:제품|프로덕트)?(?:\s*(?:탐색|인터뷰)).*(?:건너뛰|보류|중단|그만))/iu
const CLEAR_DIRECT_IMPLEMENTATION_PATTERN = /(?:\b(?:implement|fix|repair|edit|resolve)\b|구현|수정|고쳐|고치|해결)/iu

const AUTOMATIC_SKILL_IDS: Readonly<Record<AutomaticPersonaSkillIntent, PersonaSharedSkillId>> = {
  "product-interview": "deep-interview",
  "decision-grill": "grill-me",
  requirements: "plan",
  debug: "debug",
  review: "review",
  refactor: "refactor",
  git: "git",
  programming: "programming",
}

function isKnownPersonaSharedSkillId(value: string): value is PersonaSharedSkillId {
  return KNOWN_SKILL_IDS.has(value)
}

function firstActionFor(skillId: PersonaSharedSkillId, productMode: PersonaProductDiscoveryMode): PersonaSharedSkillActivation["firstAction"] {
  if (skillId !== "deep-interview") {
    return "advisory-reference"
  }
  return productMode === "brownfield-change-discovery"
    ? "code-first-change-discovery"
    : "one-question-product-interview"
}

function buildActivation(
  skillId: PersonaSharedSkillId,
  decision: PersonaSharedSkillActivation["decision"],
  reason: string,
  productMode: PersonaProductDiscoveryMode,
): PersonaSharedSkillActivation {
  const skill = resolvePersonaSharedSkill(skillId)
  return {
    decision,
    firstAction: firstActionFor(skill.id, productMode),
    handoff: skill.handoff,
    reason,
    skillId: skill.id,
  }
}

export function parseExplicitPersonaSkillCommand(message: string): ExplicitPersonaSkillCommand {
  const tokens = message.trim().split(/\s+/u)
  if (tokens[0] !== EXPLICIT_COMMAND) {
    return { kind: "none" }
  }
  const skillId = tokens[1]
  if (skillId === undefined || !SKILL_ID_PATTERN.test(skillId)) {
    return { kind: "malformed" }
  }
  if (!isKnownPersonaSharedSkillId(skillId)) {
    return { kind: "unavailable" }
  }
  return { kind: "valid", skillId }
}

export function isProductDiscoverySuppressed(message: string): boolean {
  return DISCOVERY_SUPPRESSION_PATTERN.test(message.trim())
}

export function isClearDirectImplementationRequest(message: string): boolean {
  return CLEAR_DIRECT_IMPLEMENTATION_PATTERN.test(message)
}

export function activateExplicitPersonaSkill(
  skillId: PersonaSharedSkillId,
  reason: string,
  productMode: PersonaProductDiscoveryMode = "new-product",
): PersonaSharedSkillActivation {
  return buildActivation(skillId, "explicit", reason, productMode)
}

export function activateAutomaticPersonaSkill(
  intent: AutomaticPersonaSkillIntent,
  reason: string,
  productMode: PersonaProductDiscoveryMode = "new-product",
): PersonaSharedSkillActivation {
  return buildActivation(AUTOMATIC_SKILL_IDS[intent], "automatic", reason, productMode)
}

export function primaryIntentForPersonaSkill(skillId: PersonaSharedSkillId): AutomaticPersonaSkillIntent {
  if (skillId === "deep-interview") return "product-interview"
  if (skillId === "grill-me") return "decision-grill"
  if (skillId === "technical-intake" || skillId === "plan" || skillId === "ralplan" || skillId === "tdd" || skillId === "implementation") {
    return "requirements"
  }
  if (skillId === "debug" || skillId === "review" || skillId === "refactor" || skillId === "git" || skillId === "programming") {
    return skillId
  }
  return "programming"
}
