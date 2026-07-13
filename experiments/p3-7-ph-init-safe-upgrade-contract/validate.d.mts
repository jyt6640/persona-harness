export type ValidationError = {
  readonly code: string
  readonly message: string
  readonly path: string
}

export type ValidationOracle = {
  readonly conflicts: readonly string[]
  readonly decision: string
  readonly deterministic: boolean
  readonly noDataLoss: boolean
  readonly noFollow: boolean
  readonly overwriteForeignFiles: boolean
  readonly preservedPaths: readonly string[]
  readonly productBehaviorChange: boolean
  readonly rollbackRequired: boolean
  readonly stateUnchanged: boolean
  readonly writes: readonly string[]
}

export type ValidationRecord = {
  readonly category: string
  readonly fixtureId: string
  readonly id: string
  readonly oracle: ValidationOracle
}

export type ValidationResult = {
  readonly appendOnly?: {
    readonly addedCaseIds: readonly string[]
    readonly status: "fail" | "pass"
  }
  readonly caseCount: number
  readonly childProcessInvocations: number
  readonly corpusSchemaVersion?: string
  readonly dependencies: unknown
  readonly errors: readonly ValidationError[]
  readonly networkAccess: boolean
  readonly ok: boolean
  readonly productCliInvocations: number
  readonly realProjectAccess: boolean
  readonly records: readonly ValidationRecord[]
  readonly writeOperations: number
}

export function validateExperiment(input: { readonly corpusPath: string }): ValidationResult
