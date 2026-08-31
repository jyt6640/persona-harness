export const HOST_CAPABILITY_MANIFEST_SCHEMA = "persona-host-capability-manifest.1" as const

export const PORTABLE_HOSTS = ["codex", "opencode", "claude-code", "antigravity"] as const
export type PortableHost = (typeof PORTABLE_HOSTS)[number]

export const HOST_CAPABILITY_IDS = [
  "skill-discovery",
  "input-routing",
  "philosophy-injection",
  "activation-notice",
  "pre-tool-gate",
  "completion-gate",
  "session-persistence",
  "adapter-update",
] as const
export type HostCapabilityId = (typeof HOST_CAPABILITY_IDS)[number]

export const HOST_CAPABILITY_STATES = ["supported", "emulated", "unavailable"] as const
export type HostCapabilityState = (typeof HOST_CAPABILITY_STATES)[number]

export type HostCapability = {
  readonly id: HostCapabilityId
  readonly state: HostCapabilityState
}

export type HostCapabilityManifest = {
  readonly schemaVersion: typeof HOST_CAPABILITY_MANIFEST_SCHEMA
  readonly host: PortableHost
  readonly hostVersion: string
  readonly adapterVersion: string
  readonly capabilities: readonly HostCapability[]
}

export type HostCapabilityBinding = {
  readonly host: PortableHost
  readonly hostVersion: string
  readonly adapterVersion: string
}

export type HostCapabilityManifestBlockCode =
  | "manifest-invalid"
  | "schema-unsupported"
  | "host-unsupported"
  | "binding-invalid"
  | "capability-invalid"
  | "capability-duplicate"
  | "capability-missing"

export type HostCapabilityManifestResult =
  | { readonly kind: "ready"; readonly value: HostCapabilityManifest }
  | { readonly kind: "blocked"; readonly code: HostCapabilityManifestBlockCode }

export type HostAssuranceRequirement = "portable" | "enforced"

export type HostAssuranceResult =
  | {
      readonly kind: "ready"
      readonly assurance: HostAssuranceRequirement
      readonly host: PortableHost
      readonly reason: "enforcement-capabilities-supported" | "enforcement-capabilities-unavailable"
    }
  | {
      readonly kind: "blocked"
      readonly code:
        | HostCapabilityManifestBlockCode
        | "host-binding-mismatch"
        | "assurance-requirement-invalid"
        | "portable-capability-unavailable"
        | "enforced-capability-unavailable"
    }

export type HostAssuranceInput = {
  readonly manifest: unknown
  readonly binding: unknown
  readonly requiredAssurance?: unknown
}

const MANIFEST_KEYS = ["schemaVersion", "host", "hostVersion", "adapterVersion", "capabilities"] as const
const BINDING_KEYS = ["host", "hostVersion", "adapterVersion"] as const
const CAPABILITY_KEYS = ["id", "state"] as const
const VERSION_PATTERN = /^(?:0|[1-9][0-9]*)(?:\.(?:0|[1-9][0-9]*|x)){1,2}(?:[-+][0-9A-Za-z.-]+)?$/u
const PORTABLE_REQUIRED_CAPABILITIES = [
  "skill-discovery",
  "input-routing",
  "philosophy-injection",
  "activation-notice",
  "session-persistence",
  "adapter-update",
] as const satisfies readonly HostCapabilityId[]

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function hasExactKeys(record: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(record)
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(record, key))
}

function portableHost(value: unknown): PortableHost | undefined {
  if (value === "codex" || value === "opencode" || value === "claude-code" || value === "antigravity") {
    return value
  }
  return undefined
}

function capabilityId(value: unknown): HostCapabilityId | undefined {
  switch (value) {
    case "skill-discovery":
    case "input-routing":
    case "philosophy-injection":
    case "activation-notice":
    case "pre-tool-gate":
    case "completion-gate":
    case "session-persistence":
    case "adapter-update":
      return value
    default:
      return undefined
  }
}

function capabilityState(value: unknown): HostCapabilityState | undefined {
  if (value === "supported" || value === "emulated" || value === "unavailable") {
    return value
  }
  return undefined
}

function versionBinding(value: unknown): string | undefined {
  return typeof value === "string" && VERSION_PATTERN.test(value) ? value : undefined
}

function parseBinding(input: unknown): HostCapabilityBinding | undefined {
  if (!isRecord(input) || !hasExactKeys(input, BINDING_KEYS)) {
    return undefined
  }
  const host = portableHost(input.host)
  const hostVersion = versionBinding(input.hostVersion)
  const adapterVersion = versionBinding(input.adapterVersion)
  return host === undefined || hostVersion === undefined || adapterVersion === undefined
    ? undefined
    : { host, hostVersion, adapterVersion }
}

export function parseHostCapabilityManifest(input: unknown): HostCapabilityManifestResult {
  if (!isRecord(input) || !hasExactKeys(input, MANIFEST_KEYS)) {
    return { kind: "blocked", code: "manifest-invalid" }
  }
  if (input.schemaVersion !== HOST_CAPABILITY_MANIFEST_SCHEMA) {
    return { kind: "blocked", code: "schema-unsupported" }
  }
  const host = portableHost(input.host)
  if (host === undefined) {
    return { kind: "blocked", code: "host-unsupported" }
  }
  const hostVersion = versionBinding(input.hostVersion)
  const adapterVersion = versionBinding(input.adapterVersion)
  if (hostVersion === undefined || adapterVersion === undefined) {
    return { kind: "blocked", code: "binding-invalid" }
  }
  if (!Array.isArray(input.capabilities)) {
    return { kind: "blocked", code: "capability-invalid" }
  }

  const states = new Map<HostCapabilityId, HostCapabilityState>()
  for (const value of input.capabilities) {
    if (!isRecord(value) || !hasExactKeys(value, CAPABILITY_KEYS)) {
      return { kind: "blocked", code: "capability-invalid" }
    }
    const id = capabilityId(value.id)
    const state = capabilityState(value.state)
    if (id === undefined || state === undefined) {
      return { kind: "blocked", code: "capability-invalid" }
    }
    if (states.has(id)) {
      return { kind: "blocked", code: "capability-duplicate" }
    }
    states.set(id, state)
  }
  if (states.size !== HOST_CAPABILITY_IDS.length) {
    return { kind: "blocked", code: "capability-missing" }
  }

  const capabilities: HostCapability[] = []
  for (const id of HOST_CAPABILITY_IDS) {
    const state = states.get(id)
    if (state === undefined) {
      return { kind: "blocked", code: "capability-missing" }
    }
    capabilities.push({ id, state })
  }
  return {
    kind: "ready",
    value: { schemaVersion: HOST_CAPABILITY_MANIFEST_SCHEMA, host, hostVersion, adapterVersion, capabilities },
  }
}

function hasPortableCapabilities(manifest: HostCapabilityManifest): boolean {
  const states = new Map(manifest.capabilities.map((capability) => [capability.id, capability.state]))
  return PORTABLE_REQUIRED_CAPABILITIES.every((id) => states.get(id) !== "unavailable")
}

function hasEnforcedCapabilities(manifest: HostCapabilityManifest): boolean {
  return manifest.capabilities.every((capability) => capability.state === "supported")
}

export function evaluateHostAssurance(input: HostAssuranceInput): HostAssuranceResult {
  if (
    input.requiredAssurance !== undefined
    && input.requiredAssurance !== "portable"
    && input.requiredAssurance !== "enforced"
  ) {
    return { kind: "blocked", code: "assurance-requirement-invalid" }
  }
  const parsed = parseHostCapabilityManifest(input.manifest)
  if (parsed.kind === "blocked") {
    return parsed
  }
  const binding = parseBinding(input.binding)
  if (binding === undefined) {
    return { kind: "blocked", code: "binding-invalid" }
  }
  const manifest = parsed.value
  if (
    manifest.host !== binding.host
    || manifest.hostVersion !== binding.hostVersion
    || manifest.adapterVersion !== binding.adapterVersion
  ) {
    return { kind: "blocked", code: "host-binding-mismatch" }
  }
  if (!hasPortableCapabilities(manifest)) {
    return { kind: "blocked", code: "portable-capability-unavailable" }
  }
  if (hasEnforcedCapabilities(manifest)) {
    return {
      kind: "ready",
      assurance: "enforced",
      host: manifest.host,
      reason: "enforcement-capabilities-supported",
    }
  }
  if ((input.requiredAssurance ?? "portable") === "enforced") {
    return { kind: "blocked", code: "enforced-capability-unavailable" }
  }
  return {
    kind: "ready",
    assurance: "portable",
    host: manifest.host,
    reason: "enforcement-capabilities-unavailable",
  }
}
