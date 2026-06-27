export function stableAnonymousId(seed: string, input: string): string
export function anonymizeCapture(
  inputDir: string,
  outputDir: string,
  seed?: string,
): { reviewDir: string; mappingPath: string; packagePath: string; runCount: number }
export function aggregateDisagreements(scores: unknown): {
  runCount: number
  disagreements: Array<Record<string, unknown>>
}
export function runLlmJudge(command: string, reviewPackageDir: string): {
  status: number | null
  stdout: string
  stderr: string
}
export function readScores(path: string): unknown
