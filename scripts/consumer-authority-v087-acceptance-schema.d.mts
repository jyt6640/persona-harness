export const V087_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v087-acceptance.1"

export class V087AcceptanceManifestError extends Error {
  readonly code: "v087-acceptance-schema"
}

export type V087AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  acceptanceResponsibilities: Readonly<{
    package: Readonly<{
      excludes: readonly string[]
      requires: readonly string[]
    }>
    sourceAndProtectedUbuntuCi: Readonly<{
      requires: readonly string[]
    }>
  }>
  hostedResidual: Readonly<{
    whyLocalCannotClose: string
  }>
  authority: Readonly<{
    fetchBindingReason: Readonly<{
      allowedReasons: readonly string[]
      output: string
      publicState: string
      schemaVersion: "consumer-authority-fetch-binding-reason.1"
    }>
  }>
  openCodeInterviewObservation: Readonly<{
    approvalBoundary: Readonly<{
      event: string
      acceptedResponses: readonly string[]
      preApprovalMutation: string
    }>
    input: string
    firstResponse: Readonly<{
      assistantMessage: string
      assistantText: string
      transformedUserInput: string
      cardinality: string
    }>
    response: Readonly<{
      predicate: string
      rejectedContent: readonly string[]
    }>
    output: string
    schemaVersion: "opencode-interview-observation.1"
  }>
  package: Readonly<{
    channel: string
    scope: string
    version: string
  }>
  preAuthorityReadiness: Readonly<{
    commands: readonly string[]
    initialization: Readonly<{
      acceptedPlan: string
      retainedDraftPlan: string
    }>
  }>
  prearmedExternalHandoff: Readonly<{
    finalObserverProcedure: Readonly<{
      observerGhSelection: string
    }>
  }>
  v082HistoricalRelease: Readonly<{
    reusableForV087: boolean
    version: string
  }>
  v083HistoricalRelease: Readonly<{
    reusableForV087: boolean
    version: string
  }>
  v084HistoricalRelease: Readonly<{
    reusableForV087: boolean
    version: string
  }>
  v085HistoricalRelease: Readonly<{
    reusableForV087: boolean
    version: string
  }>
  v086HistoricalRelease: Readonly<{
    reusableForV087: boolean
    version: string
  }>
}>

export function canonicalV087AcceptanceManifest(): V087AcceptanceManifest
export function readV087AcceptanceManifest(packageRoot: string): V087AcceptanceManifest
export function parseV087AcceptanceManifest(value: unknown, packageVersion: string): V087AcceptanceManifest
