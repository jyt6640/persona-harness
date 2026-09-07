import { walkBoundedFiles } from "../io/bounded-path-walker.js"
import { readNoFollowProjectFile } from "../io/no-follow-file.js"
import type { HostPluginDistributionTarget } from "./host-plugin-distribution.js"

const REFERENCE_ROOTS = ["programming/references/java", "philosophy-refinement/references"] as const
const SKILL_ROOTS = [
  "packages/host-plugins/antigravity/skills",
  "packages/host-plugins/codex/plugins/persona-harness/skills",
  "packages/host-plugins/claude/skills",
] as const

export function buildHostPluginReferenceTargets(root: string): readonly HostPluginDistributionTarget[] {
  const targets: HostPluginDistributionTarget[] = []
  for (const reference of REFERENCE_ROOTS) {
    const sourceRoot = `packages/shared-skills/skills/${reference}`
    const files = walkBoundedFiles(sourceRoot, root, { maxDepth: 2, maxEntries: 64, maxFileBytes: 64 * 1024, maxTotalBytes: 512 * 1024 })
    if (!files.present || !files.safe || files.files.length === 0) throw new Error("host-plugin-distribution-reference")
    for (const file of files.files) {
      if (!file.relativePath.endsWith(".md")) throw new Error("host-plugin-distribution-reference")
      const content = readNoFollowProjectFile(root, `${sourceRoot}/${file.relativePath}`, 64 * 1024)
      if (content.kind !== "ready") throw new Error("host-plugin-distribution-reference")
      for (const targetRoot of SKILL_ROOTS) {
        targets.push({ relativePath: `${targetRoot}/${reference}/${file.relativePath}`, nextBytes: content.value.bytes })
      }
    }
  }
  const checker = "programming/scripts/java/check-no-excuse-rules.sh"
  const script = readNoFollowProjectFile(root, `packages/shared-skills/skills/${checker}`, 64 * 1024)
  if (script.kind !== "ready") throw new Error("host-plugin-distribution-reference")
  for (const targetRoot of SKILL_ROOTS) {
    targets.push({ relativePath: `${targetRoot}/${checker}`, nextBytes: script.value.bytes })
  }
  return targets
}
