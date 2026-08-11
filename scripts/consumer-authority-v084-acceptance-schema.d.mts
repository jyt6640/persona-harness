export const V084_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v084-acceptance.1"

export class V084AcceptanceManifestError extends Error {
  readonly code: "v084-acceptance-schema"
}

export type V084AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
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
    reusableForV084: boolean
    version: string
  }>
  v083HistoricalRelease: Readonly<{
    reusableForV084: boolean
    version: string
  }>
}>

export function canonicalV084AcceptanceManifest(): V084AcceptanceManifest
export function readV084AcceptanceManifest(packageRoot: string): V084AcceptanceManifest
export function parseV084AcceptanceManifest(value: unknown, packageVersion: string): V084AcceptanceManifest
