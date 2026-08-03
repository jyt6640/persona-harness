export const PACKAGE_EXERCISE_PHASE_SCHEMA_VERSION: "clean-package-exercise-phase.1"

export class PackageExercisePhaseEnvelopeError extends Error {
  readonly code: string
}

export function requirePackageExerciseContractSuccess(input: Readonly<{
  fallbackCode: string
  marker: string
  output: string
  status: number
  successMarker: string
  surface: "source-built" | "fresh-tar"
}>): void

export type PackageExerciseSurface = "fresh-tar" | "source-built"
export type PackageExercisePhaseState = "blocked" | "ready"
export type PackageExerciseBlockedCode = "contract-failed" | `observer-gh-${string}`

export type PackageExercisePhaseRecord = Readonly<{
  code: "passed" | PackageExerciseBlockedCode
  phase: string
  schemaVersion: "clean-package-exercise-phase.1"
  state: PackageExercisePhaseState
  surface: PackageExerciseSurface
}>

export const PACKAGE_EXERCISE_PHASES: Readonly<Record<PackageExerciseSurface, readonly string[]>>

export function createPackageExercisePhaseRecord(
  surface: PackageExerciseSurface,
  phase: string,
  state: PackageExercisePhaseState,
  code: "passed" | PackageExerciseBlockedCode,
): PackageExercisePhaseRecord

export function formatPackageExercisePhaseRecord(
  surface: PackageExerciseSurface,
  phase: string,
  state: PackageExercisePhaseState,
  code: "passed" | PackageExerciseBlockedCode,
  marker: string,
): string

export function assessPackageExerciseContractOutput(input: Readonly<{
  marker: string
  output: string
  status: number | null
  successMarker: string
  surface: PackageExerciseSurface
}>): Readonly<{
  state: "ready" | "invalid"
}> | Readonly<{
  code: PackageExerciseBlockedCode
  phase: string
  state: "blocked"
}>
