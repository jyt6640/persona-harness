export function inferDistTag(version: string): string

export function renderReleaseBody(input: Readonly<{
  tagName: string
  version: string
  distTag: string
  releaseNotes: string
  releaseNotesPath: string
}>): string
