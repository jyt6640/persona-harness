export type ObserverPreflightReady = {
  readonly authorityEligible: false
  readonly consumerHome: "isolated"
  readonly credential: "usable"
  readonly fixtureAuthorization: "required"
  readonly mutationPerformed: false
  readonly next: "fixture-authorization"
  readonly schemaVersion: "consumer-authority-observer-preflight.1"
  readonly state: "ready"
}

export type ObserverPreflightBlocked = {
  readonly authorityEligible: false
  readonly code: string
  readonly consumerHome: "isolated"
  readonly credential: "unusable"
  readonly fixtureAuthorization: "blocked"
  readonly mutationPerformed: false
  readonly next: "github-actions-read-preflight" | "host-github-authentication"
  readonly schemaVersion: "consumer-authority-observer-preflight.1"
  readonly state: "blocked"
}

export type ObserverPreflightResult = ObserverPreflightBlocked | ObserverPreflightReady

export type GithubActionsPreflightHeaders = Readonly<Record<string, string>>

export type GithubActionsPreflightResponse = {
  readonly body: unknown
  readonly statusCode: number
}

export type GithubActionsPreflightRequest = (
  url: URL,
  headers: GithubActionsPreflightHeaders,
) => Promise<GithubActionsPreflightResponse>

export function assessGithubActionsReadiness(
  token: unknown,
  request?: GithubActionsPreflightRequest,
): Promise<ObserverPreflightResult>

export function isObserverPreflightResult(value: unknown): value is ObserverPreflightResult

export function observerPreflightWorkerEnvironment(
  token: string,
  home: string,
): Readonly<{
  readonly HOME: string
  readonly LANG: "C"
  readonly LC_ALL: "C"
  readonly PH_OBSERVER_PREFLIGHT_GITHUB_TOKEN: string
}>
