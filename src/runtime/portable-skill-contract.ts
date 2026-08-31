import {
  resolvePersonaSharedSkill,
  type PersonaSharedSkillId,
} from "./persona-shared-skill-catalog.js"
import type { PersonaSharedSkillActivation } from "./persona-shared-skill-activation.js"
import {
  PORTABLE_HOSTS,
  evaluateHostAssurance,
  type HostAssuranceRequirement,
  type PortableHost,
} from "./host-capability-manifest.js"

export { PORTABLE_HOSTS }
export type { PortableHost }

export const PORTABLE_SKILL_CONTRACT_VERSION = "persona-portable-skill-contract.1" as const
export const PORTABLE_SKILL_CAPSULE_VERSION = "persona-skill-capsule.1" as const

export const PORTABLE_SKILL_CAPABILITIES = [
  "compact-reference",
  "structured-handoff",
  "one-question",
  "code-first-discovery",
  "optional-overlay",
] as const
export type PortableSkillCapability = (typeof PORTABLE_SKILL_CAPABILITIES)[number]
const PORTABLE_SKILL_CAPABILITY_SET: ReadonlySet<string> = new Set(PORTABLE_SKILL_CAPABILITIES)

export type PortableSkillReasonCode =
  | "explicit-request"
  | "ambiguous-product"
  | "ambiguous-brownfield"
  | "direct-request"

export type PortableSkillActivationInput = {
  readonly decision: "activate" | PersonaSharedSkillActivation["decision"]
  readonly firstAction: PersonaSharedSkillActivation["firstAction"]
  readonly reason: string
  readonly skillId: PersonaSharedSkillId
}

export type PortableSkillCapsule = {
  readonly contractVersion: typeof PORTABLE_SKILL_CONTRACT_VERSION
  readonly capsuleVersion: typeof PORTABLE_SKILL_CAPSULE_VERSION
  readonly skillId: PersonaSharedSkillId
  readonly metadata: {
    readonly title: string
    readonly category: "core" | "optional-extension"
    readonly entry: string
  }
  readonly inputSchema: readonly string[]
  readonly outputSchema: readonly string[]
  readonly decision: "automatic" | "explicit"
  readonly firstAction: PortableSkillActivationInput["firstAction"]
  readonly handoff: PersonaSharedSkillId | null
  readonly requiredCapabilities: readonly PortableSkillCapability[]
  readonly reasonCode: PortableSkillReasonCode
}

export type PortableHostTransport = "context" | "route" | "prompt-adapter" | "guide"

export type PortableSkillHostResult =
  | {
      readonly status: "ready"
      readonly host: PortableHost
      readonly transport: PortableHostTransport
      readonly contractVersion: typeof PORTABLE_SKILL_CONTRACT_VERSION
      readonly assurance: HostAssuranceRequirement
      readonly capsule: PortableSkillCapsule
    }
  | {
      readonly status: "unsupported"
      readonly host: PortableHost
      readonly transport: PortableHostTransport
      readonly contractVersion: typeof PORTABLE_SKILL_CONTRACT_VERSION
      readonly code: "host-adapter-mismatch" | "host-assurance-blocked" | "unsupported-capability"
    }

export type PortableSkillNegotiationInput = {
  readonly host: PortableHost
  readonly capsule: PortableSkillCapsule
  readonly manifest: unknown
  readonly binding: unknown
  readonly requiredAssurance?: HostAssuranceRequirement
}

const PORTABLE_HOST_TRANSPORTS: Readonly<Record<PortableHost, PortableHostTransport>> = {
  codex: "context",
  opencode: "route",
  "claude-code": "prompt-adapter",
  antigravity: "guide",
}

function reasonCodeFor(input: PortableSkillActivationInput): PortableSkillReasonCode {
  if (input.decision === "explicit") {
    return "explicit-request"
  }
  if (input.firstAction === "one-question-product-interview") {
    return "ambiguous-product"
  }
  if (input.firstAction === "code-first-change-discovery") {
    return "ambiguous-brownfield"
  }
  return "direct-request"
}

function normalizeDecision(input: PortableSkillActivationInput): PortableSkillCapsule["decision"] {
  return input.decision === "explicit" ? "explicit" : "automatic"
}

function requiredCapabilitiesFor(
  input: PortableSkillActivationInput,
  category: PortableSkillCapsule["metadata"]["category"],
): readonly PortableSkillCapability[] {
  return PORTABLE_SKILL_CAPABILITIES.filter((capability) => {
    if (capability === "compact-reference") return true
    if (capability === "structured-handoff") return input.firstAction === "advisory-reference" || input.skillId !== "git"
    if (capability === "one-question") return input.firstAction === "one-question-product-interview"
    if (capability === "code-first-discovery") return input.firstAction === "code-first-change-discovery"
    return category === "optional-extension"
  })
}

export function createPortableSkillCapsule(input: PortableSkillActivationInput): PortableSkillCapsule {
  const skill = resolvePersonaSharedSkill(input.skillId)
  const category = skill.category

  return {
    contractVersion: PORTABLE_SKILL_CONTRACT_VERSION,
    capsuleVersion: PORTABLE_SKILL_CAPSULE_VERSION,
    skillId: skill.id,
    metadata: {
      title: skill.title,
      category,
      entry: skill.entry,
    },
    inputSchema: [...skill.inputBrief],
    outputSchema: [...skill.outputBrief],
    decision: normalizeDecision(input),
    firstAction: input.firstAction,
    handoff: skill.handoff,
    requiredCapabilities: requiredCapabilitiesFor(input, category),
    reasonCode: reasonCodeFor(input),
  }
}

export function portableHostTransport(host: PortableHost): PortableHostTransport {
  return PORTABLE_HOST_TRANSPORTS[host]
}

export function negotiatePortableSkill(input: PortableSkillNegotiationInput): PortableSkillHostResult {
  const base = {
    host: input.host,
    transport: portableHostTransport(input.host),
    contractVersion: PORTABLE_SKILL_CONTRACT_VERSION,
  }
  const assurance = evaluateHostAssurance({
    manifest: input.manifest,
    binding: input.binding,
    requiredAssurance: input.requiredAssurance,
  })
  if (assurance.kind === "blocked") {
    return { ...base, status: "unsupported", code: "host-assurance-blocked" }
  }
  if (assurance.host !== input.host) {
    return { ...base, status: "unsupported", code: "host-adapter-mismatch" }
  }
  const validCapsuleCapabilities = input.capsule.requiredCapabilities.every((capability) => PORTABLE_SKILL_CAPABILITY_SET.has(capability))
  return validCapsuleCapabilities
    ? { ...base, status: "ready", assurance: assurance.assurance, capsule: input.capsule }
    : { ...base, status: "unsupported", code: "unsupported-capability" }
}
