export type ConventionLevel = "block" | "report" | "warn"

export type ConventionCheck =
  | { readonly kind: "observer" }
  | { readonly kind: "ast-grep"; readonly rule: string }

export type ConventionDefinition = {
  readonly actionableMessage: string
  readonly blockAllowed: boolean
  readonly blockerId: string
  readonly check: ConventionCheck
  readonly defaultLevel: ConventionLevel
  readonly fixPath: string
  readonly highPrecision: boolean
  readonly id: string
  readonly profileScope?: "java-spring-service-architecture"
  readonly scope: "single-file" | "tree"
  readonly stepId: string
  readonly targetFileSuffixes?: readonly string[]
  readonly writeGuard: boolean
}

export const CONTROLLER_REPOSITORY_CONVENTION = {
  actionableMessage: "route through a Service layer instead.",
  blockAllowed: true,
  blockerId: "architecture-controller-repository-direct-dependency",
  check: { kind: "observer" },
  defaultLevel: "block",
  fixPath: "route the Controller through a Service layer instead of depending on Repository directly.",
  highPrecision: true,
  id: "controller.repository-dependency",
  profileScope: "java-spring-service-architecture",
  scope: "single-file",
  stepId: "fix-controller-repository-dependency",
  writeGuard: true,
} satisfies ConventionDefinition

export const CONTROLLER_PERSISTENCE_IMPORT_CONVENTION = {
  actionableMessage: "keep persistence imports out of Controllers.",
  blockAllowed: true,
  blockerId: "architecture-controller-persistence-import",
  check: { kind: "ast-grep", rule: ".persona/conventions/controller-persistence-import.yml" },
  defaultLevel: "warn",
  fixPath: "move persistence/entity access behind a Service and expose DTOs at the Controller boundary.",
  highPrecision: true,
  id: "controller.persistence-import",
  profileScope: "java-spring-service-architecture",
  scope: "single-file",
  stepId: "fix-controller-persistence-import",
  targetFileSuffixes: ["Controller.java"],
  writeGuard: false,
} satisfies ConventionDefinition

export const CONVENTION_REGISTRY = [
  CONTROLLER_REPOSITORY_CONVENTION,
  CONTROLLER_PERSISTENCE_IMPORT_CONVENTION,
] as const

export const DEFAULT_CONVENTION_LEVELS: Readonly<Record<string, ConventionLevel>> = {
  [CONTROLLER_REPOSITORY_CONVENTION.id]: CONTROLLER_REPOSITORY_CONVENTION.defaultLevel,
  [CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.id]: CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.defaultLevel,
}

export function findConventionDefinition(id: string): ConventionDefinition | undefined {
  return CONVENTION_REGISTRY.find((definition) => definition.id === id)
}

export function findConventionByBlockerId(blockerId: string): ConventionDefinition | undefined {
  return CONVENTION_REGISTRY.find((definition) => definition.blockerId === blockerId)
}

export function findConventionByStepId(stepId: string): ConventionDefinition | undefined {
  return CONVENTION_REGISTRY.find((definition) => definition.stepId === stepId)
}
