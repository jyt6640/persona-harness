import { CONVENTION_REGISTRY } from "../config/convention-registry.js"
import type { ConventionDefinition } from "../config/convention-registry.js"
import { loadAstGrepConventionDefinitions } from "./ast-grep-convention-runner.js"

export function readConventionDefinitions(projectDir: string): readonly ConventionDefinition[] {
  const staticIds = new Set(CONVENTION_REGISTRY.map((definition) => definition.id))
  const dynamicDefinitions = loadAstGrepConventionDefinitions(projectDir).filter((definition) => !staticIds.has(definition.id))
  return [...CONVENTION_REGISTRY, ...dynamicDefinitions]
}
