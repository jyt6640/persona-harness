import { mkdtempSync } from "node:fs"
import { join } from "node:path"

export function createDirectProjectRoot(prefix: string): string {
  return mkdtempSync(join(process.cwd(), `.${prefix}-`))
}
