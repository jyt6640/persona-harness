import type { BackendGuidancePack } from "../config/harness-config.js"

export function backendGuidanceRulePath(pack: BackendGuidancePack): string {
  return `backend/packs/${pack}.md`
}

export function isBackendGuidanceRuleEnabled(
  rulePath: string,
  packs: readonly BackendGuidancePack[],
): boolean {
  if (!rulePath.startsWith("backend/packs/")) {
    return true
  }
  return packs.some((pack) => backendGuidanceRulePath(pack) === rulePath)
}
