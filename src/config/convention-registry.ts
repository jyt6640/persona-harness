export type ConventionLevel = "block" | "report" | "warn"

export type ConventionDefinition = {
  readonly actionableMessage: string
  readonly blockerId: string
  readonly checkKind: "observer"
  readonly defaultLevel: ConventionLevel
  readonly fixPath: string
  readonly highPrecision: boolean
  readonly id: string
  readonly scope: "java-spring-service-architecture"
  readonly writeGuard: boolean
}

export const CONTROLLER_REPOSITORY_CONVENTION = {
  actionableMessage: "route through a Service layer instead.",
  blockerId: "architecture-controller-repository-direct-dependency",
  checkKind: "observer",
  defaultLevel: "block",
  fixPath: "route the Controller through a Service layer instead of depending on Repository directly.",
  highPrecision: true,
  id: "controller.repository-dependency",
  scope: "java-spring-service-architecture",
  writeGuard: true,
} satisfies ConventionDefinition

export const CONVENTION_REGISTRY = [CONTROLLER_REPOSITORY_CONVENTION] as const

export const DEFAULT_CONVENTION_LEVELS: Readonly<Record<string, ConventionLevel>> = {
  [CONTROLLER_REPOSITORY_CONVENTION.id]: CONTROLLER_REPOSITORY_CONVENTION.defaultLevel,
}

export function findConventionDefinition(id: string): ConventionDefinition | undefined {
  return CONVENTION_REGISTRY.find((definition) => definition.id === id)
}
