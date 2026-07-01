import { createRequire } from "node:module"

const requireFromHere = createRequire(import.meta.url)

export function personaHarnessVersion(): string {
  const packageJson = requireFromHere("../../package.json") as { readonly version?: unknown }
  return typeof packageJson.version === "string" ? packageJson.version : "0.0.0-unknown"
}
