import type { CliRunResult } from "./bearshell.js"
import {
  STAGED_PACKAGE_ARTIFACT_CHANNELS,
  type StagedPackageArtifactChannel,
  type StagedPackageArtifactSelection,
} from "./staged-package-artifact-provenance-types.js"
import { runStagedPackageArtifactProvenanceWorker } from "./staged-package-artifact-provenance-worker.js"

const STRICT_SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
const SENSITIVE_VERSION = /(?:api[_-]?key|bearer|password|jdbc:|-----begin|sk-(?:live|test|proj)-|:\/\/[^/\s]+:[^/\s]+@)/iu

type ParsedArgs =
  | { readonly kind: "help" }
  | { readonly kind: "invalid" }
  | { readonly json: boolean; readonly kind: "run"; readonly selection: StagedPackageArtifactSelection }

export function stagedPackageArtifactProvenanceUsage(invocation = "ph dev staged-package-provenance"): string {
  return [
    `Usage: ${invocation} --channel <staging|next> --version <strict-semver> [--json]`,
    "",
    "Fetches fixed npm and GitHub provenance endpoints and verifies a Sigstore-bound exact package artifact.",
    "It never publishes, tags, moves a dist-tag, mutates a registry, or authorizes channel promotion.",
  ].join("\n")
}

export function runStagedPackageArtifactProvenanceCommand(
  args: readonly string[],
  invocation = "ph dev staged-package-provenance",
): CliRunResult {
  const parsed = parseArgs(args)
  if (parsed.kind === "help") return { status: 0, stdout: `${stagedPackageArtifactProvenanceUsage(invocation)}\n`, stderr: "" }
  if (parsed.kind === "invalid") return { status: 1, stdout: "", stderr: `${stagedPackageArtifactProvenanceUsage(invocation)}\n` }

  const result = runStagedPackageArtifactProvenanceWorker(parsed.selection)
  return {
    status: result.verificationStatus === "verified" ? 0 : 1,
    stdout: parsed.json ? `${JSON.stringify(result, null, 2)}\n` : `${formatResult(result)}\n`,
    stderr: "",
  }
}

function parseArgs(args: readonly string[]): ParsedArgs {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h" || args[0] === "help")) return { kind: "help" }
  let channel: StagedPackageArtifactChannel | undefined
  let json = false
  let version: string | undefined
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--json") {
      if (json) return { kind: "invalid" }
      json = true
      continue
    }
    const value = args[index + 1]
    if ((argument !== "--channel" && argument !== "--version") || value === undefined || value.startsWith("--")) return { kind: "invalid" }
    if (argument === "--channel") {
      if (channel !== undefined || !isChannel(value)) return { kind: "invalid" }
      channel = value
    } else {
      if (version !== undefined || !isSafeVersion(value)) return { kind: "invalid" }
      version = value
    }
    index += 1
  }
  return channel === undefined || version === undefined
    ? { kind: "invalid" }
    : { json, kind: "run", selection: { channel, version } }
}

function formatResult(result: ReturnType<typeof runStagedPackageArtifactProvenanceWorker>): string {
  return [
    `Staged package artifact provenance: ${result.verificationStatus.toUpperCase()}`,
    `Promotion decision: ${result.promotionDecision.toUpperCase()}`,
    "Registry mutation: NOT PERFORMED",
    ...(result.diagnostics.length === 0 ? ["Diagnostics: none"] : [`Diagnostics: ${result.diagnostics.join(", ")}`]),
  ].join("\n")
}

function isSafeVersion(value: string): boolean {
  return value.length > 0 && value.length <= 256 && STRICT_SEMVER.test(value) && !SENSITIVE_VERSION.test(value)
}

function isChannel(value: string): value is StagedPackageArtifactChannel {
  return STAGED_PACKAGE_ARTIFACT_CHANNELS.some((channel) => channel === value)
}
