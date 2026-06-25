export function warnRuntimeFailure(scope: string, detail: string | undefined, error: Error): void {
  const detailText = detail === undefined ? "" : `: ${detail}`
  console.warn(`Persona Harness ${scope} failed${detailText}: ${error.name}: ${error.message}`)
}
