import { isRecord, stripJsonComments } from "../config/jsonc.js"
import { InitManifestError } from "./init-manifest.js"
import type { InitTarget } from "./init-transaction.js"

const HARNESS_CONFIG_PATH = ".persona/harness.jsonc"

function parseHarness(bytes: Buffer, label: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonComments(bytes.toString("utf8")))
  } catch {
    throw new InitManifestError(`${label} is malformed; no files were changed.`)
  }
  if (!isRecord(parsed)) throw new InitManifestError(`${label} must contain a JSON object; no files were changed.`)
  return parsed
}

export function mergeBootstrapHarnessOptIns(templateBytes: Buffer, currentBytes: Buffer): Buffer {
  const template = parseHarness(templateBytes, "Persona Harness template")
  const current = parseHarness(currentBytes, HARNESS_CONFIG_PATH)
  const executeVerification = isRecord(current.enforce) && current.enforce.executeVerification === true
  const projectPhilosophyInjectionDisabled = isRecord(current.features) && current.features.projectPhilosophyInjection === false
  const runtimeInjection = isRecord(current.features) && current.features.runtimeInjection === true
  const sharedSkillRoutingDisabled = isRecord(current.features) && current.features.sharedSkillRouting === false
  const multiAgent = isRecord(current.multiAgent) && current.multiAgent.enabled === true
  if (!executeVerification && !projectPhilosophyInjectionDisabled && !runtimeInjection && !sharedSkillRoutingDisabled && !multiAgent) return templateBytes

  const next: Record<string, unknown> = { ...template }
  if (executeVerification) {
    next.enforce = {
      ...(isRecord(template.enforce) ? template.enforce : {}),
      executeVerification: true,
    }
  }
  if (runtimeInjection) {
    next.features = {
      ...(isRecord(template.features) ? template.features : {}),
      runtimeInjection: true,
    }
  }
  if (projectPhilosophyInjectionDisabled) {
    next.features = {
      ...(isRecord(next.features) ? next.features : {}),
      projectPhilosophyInjection: false,
    }
  }
  if (sharedSkillRoutingDisabled) {
    next.features = {
      ...(isRecord(next.features) ? next.features : {}),
      sharedSkillRouting: false,
    }
  }
  if (multiAgent) {
    next.multiAgent = {
      ...(isRecord(template.multiAgent) ? template.multiAgent : {}),
      enabled: true,
    }
  }
  return Buffer.from(`${JSON.stringify(next, null, 2)}\n`, "utf8")
}

export function preserveBootstrapHarnessOptIns(
  targets: readonly InitTarget[],
  ownedFiles: ReadonlyMap<string, Buffer>,
): readonly InitTarget[] {
  const currentBytes = ownedFiles.get(HARNESS_CONFIG_PATH)
  if (currentBytes === undefined) {
    throw new InitManifestError(`Init ownership manifest does not own ${HARNESS_CONFIG_PATH}.`)
  }
  return targets.map((target) => target.relativePath === HARNESS_CONFIG_PATH
    ? { ...target, nextBytes: mergeBootstrapHarnessOptIns(target.nextBytes, currentBytes) }
    : target)
}
