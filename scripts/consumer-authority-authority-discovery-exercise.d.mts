export const AUTHORITY_DISCOVERY_EXERCISE_SCHEMA_VERSION: "consumer-authority-discovery-exercise.1"
export const AUTHORITY_DISCOVERY_EXERCISE_MARKER: "authority-discovery-exercise-result"

export type AuthorityDiscoveryExerciseSurface = "fresh-tar" | "source-built"

export type AuthorityDiscoveryExerciseResult = Readonly<{
  result: "trusted-unconsumed-persisted"
  schemaVersion: "consumer-authority-discovery-exercise.1"
  surface: AuthorityDiscoveryExerciseSurface
}>

export function createAuthorityDiscoveryExerciseResult(
  surface: AuthorityDiscoveryExerciseSurface,
): AuthorityDiscoveryExerciseResult

export function formatAuthorityDiscoveryExerciseResult(
  value: AuthorityDiscoveryExerciseResult,
): string

export function assessAuthorityDiscoveryExerciseResult(
  output: string,
  surface: AuthorityDiscoveryExerciseSurface,
): Readonly<{ state: "ready" | "invalid" }>
