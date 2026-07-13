import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

import {
  type ReceiptDiagnostic,
  type LegacyEvidenceSummary,
} from "./workflow-verification-receipt-types.js"

export type ParsedFile<T> = {
  readonly path: string
  readonly result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly diagnostics: readonly ReceiptDiagnostic[] }
}

export type DirectoryRead<T> = {
  readonly diagnostics: readonly ReceiptDiagnostic[]
  readonly files: readonly ParsedFile<T>[]
  readonly present: boolean
}

export function readJsonDirectory<T>(
  projectDir: string,
  relativeDir: string,
  parser: (text: string, path: string) => { readonly ok: true; readonly value: T } | { readonly ok: false; readonly diagnostics: readonly ReceiptDiagnostic[] },
): DirectoryRead<T> {
  const directory = join(projectDir, relativeDir)
  if (!existsSync(directory)) {
    return { diagnostics: [], files: [], present: false }
  }
  try {
    const rootStat = lstatSync(directory)
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      return {
        diagnostics: [{
          code: "receipt-directory-invalid",
          message: "Receipt and attempt directories must be real directories.",
          path: relativeDir,
        }],
        files: [],
        present: true,
      }
    }
    const diagnostics: ReceiptDiagnostic[] = []
    const files: ParsedFile<T>[] = []
    for (const entry of readdirSync(directory).sort()) {
      const entryPath = join(directory, entry)
      const entryRef = `${relativeDir}/${entry}`
      let entryStat: ReturnType<typeof lstatSync>
      try {
        entryStat = lstatSync(entryPath)
      } catch (error) {
        diagnostics.push({
          code: "receipt-read-failed",
          message: error instanceof Error ? error.message : "Receipt or attempt entry could not be inspected.",
          path: entryRef,
        })
        continue
      }
      if (!entry.endsWith(".json") || !entryStat.isFile() || entryStat.isSymbolicLink()) {
        diagnostics.push({
          code: "receipt-entry-invalid",
          message: "Receipt and attempt directories may contain only regular JSON files.",
          path: entryRef,
        })
        continue
      }
      try {
        const result = parser(readFileSync(entryPath, "utf8"), entryRef)
        files.push({ path: entryRef, result })
        if (!result.ok) diagnostics.push(...result.diagnostics)
      } catch (error) {
        diagnostics.push({
          code: "receipt-read-failed",
          message: error instanceof Error ? error.message : "Receipt or attempt could not be read.",
          path: entryRef,
        })
      }
    }
    return { diagnostics, files, present: true }
  } catch (error) {
    return {
      diagnostics: [{
        code: "receipt-read-failed",
        message: error instanceof Error ? error.message : "Receipt or attempt directory could not be read.",
        path: relativeDir,
      }],
      files: [],
      present: true,
    }
  }
}

export function readLegacyEvidence(projectDir: string): LegacyEvidenceSummary {
  const root = join(projectDir, ".persona/evidence")
  if (!existsSync(root)) {
    return { diagnosticOnly: true, files: [] }
  }
  try {
    const files = listLegacyFiles(root)
    return {
      diagnosticOnly: true,
      files: files.map((file) => relative(projectDir, file).replace(/\\/g, "/")).sort(),
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown read error"
    return {
      diagnosticOnly: true,
      files: [`.persona/evidence (unreadable: ${detail}; retained as diagnostic-only)`],
    }
  }
}

export function legacyDiagnostic(legacyEvidence: LegacyEvidenceSummary): ReceiptDiagnostic {
  return {
    code: "legacy-evidence-only",
    message: legacyEvidence.files.length === 0
      ? "No legacy evidence is present."
      : "Legacy evidence remains diagnostic-only and cannot migrate into authority.",
    path: ".persona/evidence",
  }
}

function listLegacyFiles(directory: string): readonly string[] {
  const files: string[] = []
  for (const entry of readdirSync(directory).sort()) {
    if (entry === "verification-receipts" || entry === "verification-attempts") {
      continue
    }
    const entryPath = join(directory, entry)
    const stat = lstatSync(entryPath)
    if (stat.isSymbolicLink()) {
      files.push(entryPath)
    } else if (stat.isDirectory()) {
      files.push(...listLegacyFiles(entryPath))
    } else if (stat.isFile()) {
      files.push(entryPath)
    }
  }
  return files
}
