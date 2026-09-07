import { createContextPreviewReader, type ContextPreviewOptions } from "../cli/context-preview.js"
import { isContextPersonalizationEnabled, loadHarnessConfigResult } from "../config/harness-config.js"
import { canonicalContextDigest } from "../context-core/context-digest.js"
import { renderContextBlock } from "../context-core/context-renderer.js"
import type { ContextCapsule, ContextEnvelope } from "../context-core/context-envelope.js"
import { resolveContainedPath } from "../io/bounded-path-walker.js"
import { isInstalledPersonaHarnessPackageFile } from "../io/tool-target.js"
import { MAX_CONTEXT_TARGETS } from "./context-tool-targets.js"

type ResolvedEnvelope = Extract<ContextEnvelope, { readonly status: "resolved" }>

export type TargetContextOptions = ContextPreviewOptions & {
  readonly projectKey?: string
  readonly taskKey?: string
}

export type TargetContextSelection =
  | { readonly status: "skipped"; readonly reason: "context-disabled" | "no-relevant-rules" }
  | { readonly status: "blocked"; readonly reason: "target-invalid" | "target-limit" | "preview-unavailable" | "resolution-blocked" | "budget-exceeded" }
  | {
      readonly status: "selected"
      readonly block: string
      readonly digest: string
      readonly usedChars: number
      readonly maxChars: number
      readonly ruleIds: readonly string[]
      readonly warningCodes: readonly string[]
    }

export function selectContextForTargets(
  projectDir: string,
  targets: readonly string[],
  options: TargetContextOptions = {},
): TargetContextSelection {
  if (targets.length > MAX_CONTEXT_TARGETS) return { status: "blocked", reason: "target-limit" }
  const config = loadHarnessConfigResult(projectDir)
  if (!config.safe || config.contextDiagnostics.length > 0) return { status: "blocked", reason: "preview-unavailable" }
  if (!isContextPersonalizationEnabled(config)) return { status: "skipped", reason: "context-disabled" }
  const paths = new Set<string>()
  for (const target of targets) {
    if (target.length > 4_096 || /[\u0000-\u001f\u007f]/u.test(target) || isInstalledPersonaHarnessPackageFile(target)) {
      return { status: "blocked", reason: "target-invalid" }
    }
    const contained = resolveContainedPath(projectDir, target)
    if (!contained.ok) return { status: "blocked", reason: "target-invalid" }
    paths.add(contained.relativePath)
  }
  const envelopes: ResolvedEnvelope[] = []
  const readPreview = createContextPreviewReader(projectDir, options)
  for (const target of [...paths].sort()) {
    const selectors = [
      ...(options.projectKey === undefined ? [] : ["--project", options.projectKey]),
      ...(options.taskKey === undefined ? [] : ["--task", options.taskKey]),
    ]
    const result = readPreview([target, ...selectors])
    if (result.status === "blocked") return { status: "blocked", reason: "preview-unavailable" }
    if (!result.preview.contextEnabled) return { status: "skipped", reason: "context-disabled" }
    if (result.preview.envelope.status === "blocked") {
      return { status: "blocked", reason: result.preview.envelope.blockReason === "budget-exceeded" ? "budget-exceeded" : "resolution-blocked" }
    }
    envelopes.push(result.preview.envelope)
  }
  if (envelopes.length === 0) return { status: "skipped", reason: "no-relevant-rules" }
  return mergeTargetEnvelopes(envelopes)
}

function mergeTargetEnvelopes(envelopes: readonly ResolvedEnvelope[]): TargetContextSelection {
  const capsules = new Map<string, { readonly capsule: ContextCapsule; readonly targets: Set<string> }>()
  const notices = new Map<string, string>()
  for (const envelope of envelopes) {
    for (const warning of envelope.warnings) notices.set(warning.code, warning.message)
    for (const capsule of envelope.selected) {
      const key = canonicalContextDigest({ contentDigest: capsule.contentDigest, id: capsule.id, layer: capsule.layer, topic: capsule.topic })
      const current = capsules.get(key) ?? { capsule, targets: new Set<string>() }
      current.targets.add(envelope.target.path)
      capsules.set(key, current)
    }
  }
  const contents = [...capsules.values()].map(({ capsule, targets }) => {
    if (envelopes.length === 1 || targets.size === envelopes.length) return capsule.content
    return `For ${[...targets].sort().map((path) => JSON.stringify(path)).join(", ")}: ${capsule.content}`
  })
  const block = renderContextBlock([...notices.values(), ...contents])
  const maxChars = Math.min(...envelopes.map((envelope) => envelope.budget.maxChars))
  const maxCapsules = Math.min(...envelopes.map((envelope) => envelope.budget.maxCapsules))
  if (block.length > maxChars || capsules.size > maxCapsules) return { status: "blocked", reason: "budget-exceeded" }
  if (block.length === 0) return { status: "skipped", reason: "no-relevant-rules" }
  return {
    status: "selected", block, maxChars, usedChars: block.length,
    digest: canonicalContextDigest(envelopes.map((envelope) => envelope.digest)),
    ruleIds: [...new Set([...capsules.values()].map(({ capsule }) => capsule.id))].sort(),
    warningCodes: [...notices.keys()].sort(),
  }
}
