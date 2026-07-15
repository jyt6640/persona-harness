import { lstatSync, unlinkSync } from "node:fs"
import { resolve } from "node:path"
import process from "node:process"

import { resolveSafeEvidenceRootResult } from "../config/harness-config.js"
import { resolveContainedPath, walkBoundedFiles, type PathSafetyDiagnostic } from "../io/bounded-path-walker.js"
import type { CliRunResult } from "./bearshell.js"
import {
  DEFAULT_CATEGORY_CAP,
  DEFAULT_TOTAL_BYTES,
  MAX_ENTRIES,
  MAX_TOTAL_BYTES,
  positiveInteger,
  selectRetentionCandidates,
  type RetentionCandidate,
} from "./evidence-retention-policy.js"

type RetentionOptions = {
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly projectDir?: string
}

type RetentionReport = {
  readonly authorityPreserved: true
  readonly candidates: readonly RetentionCandidate[]
  readonly deleted: number
  readonly diagnostics: readonly string[]
  readonly evidenceDir: string
  readonly mode: "apply" | "dry-run"
  readonly schemaVersion: "evidence-retention.1"
  readonly scanned: number
  readonly writes: number
}

function diagnosticCode(diagnostic: PathSafetyDiagnostic): string {
  return diagnostic.code
}

function report(
  evidenceDir: string,
  mode: "apply" | "dry-run",
  scanned: number,
  candidates: readonly RetentionCandidate[],
  deleted: number,
  diagnostics: readonly string[],
): RetentionReport {
  return {
    authorityPreserved: true,
    candidates,
    deleted,
    diagnostics,
    evidenceDir,
    mode,
    schemaVersion: "evidence-retention.1",
    scanned,
    writes: deleted,
  }
}

function jsonResult(status: number, value: RetentionReport): CliRunResult {
  return { status, stdout: `${JSON.stringify(value, null, 2)}\n`, stderr: "" }
}

function textResult(reportValue: RetentionReport): CliRunResult {
  return {
    status: reportValue.diagnostics.length === 0 ? 0 : 1,
    stdout: [
      `Evidence retention ${reportValue.mode}: ${reportValue.evidenceDir}`,
      `Scanned: ${reportValue.scanned}`,
      `Candidates: ${reportValue.candidates.length}`,
      `Deleted: ${reportValue.deleted}`,
      "Writes: " + reportValue.writes,
      `Authority preserved: ${reportValue.authorityPreserved}`,
      ...(reportValue.diagnostics.length === 0
        ? []
        : [`Diagnostics: ${reportValue.diagnostics.join(", ")}`]),
    ].join("\n") + "\n",
    stderr: "",
  }
}

function parseArgs(args: readonly string[]): { readonly apply: boolean; readonly json: boolean } | undefined {
  let apply = false
  let dryRun = false
  let json = false
  for (const arg of args) {
    if (arg === "--apply") {
      if (apply) return undefined
      apply = true
    } else if (arg === "--dry-run") {
      if (dryRun) return undefined
      dryRun = true
    } else if (arg === "--json") {
      if (json) return undefined
      json = true
    } else if (arg === "--help" || arg === "-h" || arg === "help") {
      return undefined
    } else {
      return undefined
    }
  }
  return apply && dryRun ? undefined : { apply, json }
}

export function evidenceRetentionUsage(invocationName = "ph"): string {
  return [
    `Usage: ${invocationName} evidence retain [--dry-run|--apply] [--json]`,
    "",
    "Dry-run is the default. Only known diagnostic evidence may be removed.",
    "Authority, release, unknown, unsafe, and unclassifiable evidence is retained.",
  ].join("\n")
}

export function runEvidenceRetentionCommand(
  args: readonly string[],
  options: RetentionOptions = {},
  invocationName = "ph",
): CliRunResult {
  const parsed = parseArgs(args)
  if (parsed === undefined) {
    return { status: 1, stdout: "", stderr: `${evidenceRetentionUsage(invocationName)}\n` }
  }
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const evidenceRoot = resolveSafeEvidenceRootResult(projectDir)
  if (!evidenceRoot.ok) {
    const value = report("unavailable", parsed.apply ? "apply" : "dry-run", 0, [], 0, ["config.path_invalid"])
    return parsed.json
      ? jsonResult(1, value)
      : {
          status: 1,
          stdout: "",
          stderr: "Evidence retention unavailable: configured evidence root is unsafe; read-only recovery is required.\n",
        }
  }
  const walked = walkBoundedFiles(evidenceRoot.path, projectDir, {
    displayRoot: evidenceRoot.relativePath,
    maxEntries: MAX_ENTRIES,
    maxTotalBytes: MAX_TOTAL_BYTES,
  })
  const diagnostics = walked.diagnostics.map(diagnosticCode)
  const selected = walked.safe
    ? selectRetentionCandidates(
        walked.files,
        positiveInteger(options.env ?? process.env, "PH_EVIDENCE_SUMMARY_WARN_FILE_COUNT", DEFAULT_CATEGORY_CAP),
        walked.files.reduce((sum, file) => sum + file.bytes, 0),
        positiveInteger(options.env ?? process.env, "PH_EVIDENCE_SUMMARY_WARN_TOTAL_BYTES", DEFAULT_TOTAL_BYTES),
      )
    : []
  if (!walked.safe) {
    const value = report(evidenceRoot.relativePath, parsed.apply ? "apply" : "dry-run", walked.files.length, [], 0, diagnostics)
    return parsed.json
      ? jsonResult(1, value)
      : {
          status: 1,
          stdout: "",
          stderr: `Evidence retention blocked: ${diagnostics.join(", ")}\n`,
        }
  }
  if (!parsed.apply) {
    return parsed.json
      ? jsonResult(0, report(evidenceRoot.relativePath, "dry-run", walked.files.length, selected, 0, diagnostics))
      : {
          status: 0,
          stdout: [
            `Evidence retention dry-run: ${evidenceRoot.relativePath}`,
            `Scanned: ${walked.files.length}`,
            `Candidates: ${selected.length}`,
            "Writes: 0",
          ].join("\n") + "\n",
          stderr: "",
        }
  }

  const outputCandidates = [...selected]
  for (const candidate of outputCandidates) {
    const absolutePath = resolve(evidenceRoot.path, candidate.relativePath)
    const contained = resolveContainedPath(projectDir, absolutePath)
    if (!contained.ok) {
      diagnostics.push("walker.path_escape")
      continue
    }
    try {
      const stat = lstatSync(contained.path)
      if (!stat.isFile() || stat.isSymbolicLink()) {
        diagnostics.push("walker.symlink_cycle")
        continue
      }
      unlinkSync(contained.path)
    } catch {
      diagnostics.push("retention.delete_failed")
    }
  }
  const deleted = outputCandidates.length - diagnostics.filter((code) => code === "retention.delete_failed" || code === "walker.path_escape" || code === "walker.symlink_cycle").length
  const value = report(evidenceRoot.relativePath, "apply", walked.files.length, outputCandidates, deleted, diagnostics)
  return parsed.json ? jsonResult(diagnostics.length === 0 ? 0 : 1, value) : textResult(value)
}
