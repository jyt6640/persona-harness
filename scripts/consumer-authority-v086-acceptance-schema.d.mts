export const V086_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v086-acceptance.1"

export class V086AcceptanceManifestError extends Error {
  readonly code: "v086-acceptance-schema"
}

export type V086AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
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
    reusableForV086: boolean
    version: string
  }>
  v083HistoricalRelease: Readonly<{
    reusableForV086: boolean
    version: string
  }>
  v084HistoricalRelease: Readonly<{
    reusableForV086: boolean
    version: string
  }>
  v085HistoricalRelease: Readonly<{
    reusableForV086: boolean
    version: string
  }>
}>

export function canonicalV086AcceptanceManifest(): V086AcceptanceManifest
export function readV086AcceptanceManifest(packageRoot: string): V086AcceptanceManifest
export function parseV086AcceptanceManifest(value: unknown, packageVersion: string): V086AcceptanceManifest
