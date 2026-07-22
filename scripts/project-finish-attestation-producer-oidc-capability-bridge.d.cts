export function runProjectFinishAttestationProducerWithCore(input: {
  readonly core: {
    readonly getIDToken: (audience: string) => Promise<unknown>
  }
  readonly environment?: NodeJS.ProcessEnv
}): Promise<
  | { readonly code: string; readonly kind: "blocked" }
  | { readonly kind: "passed" }
>
