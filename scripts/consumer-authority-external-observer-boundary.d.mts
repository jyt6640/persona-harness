export class ExternalObserverArtifactError extends Error {
  readonly code: string
}

export interface PreparedExternalObserverArtifact {
  readonly bundlePath: string
  readonly outputRoot: string
  readonly publicResult: Readonly<Record<string, unknown>>
  readonly subjectPath: string
  readonly verifyArguments: readonly string[]
  cleanup(): void
  readBundle(): Buffer
  readSubject(): Buffer
}

export function prepareExternalObserverArtifact(input: unknown, credential: string): Promise<PreparedExternalObserverArtifact>
export function prepareExternalObserverArtifactForTest(input: unknown, credential: string, hooks: unknown): Promise<PreparedExternalObserverArtifact>
