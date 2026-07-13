import { join } from "node:path"

import {
  type ReceiptDiagnostic,
  type LegacyEvidenceSummary,
} from "./workflow-verification-receipt-types.js"
import {
  walkBoundedFiles,
  type PathSafetyDiagnostic,
} from "../io/bounded-path-walker.js"

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
  return readJsonDirectoryAt(projectDir, join(projectDir, relativeDir), relativeDir, parser)
}

export function readJsonDirectoryAt<T>(
  projectDir: string,
  directory: string,
  displayDirectory: string,
  parser: (text: string, path: string) => { readonly ok: true; readonly value: T } | { readonly ok: false; readonly diagnostics: readonly ReceiptDiagnostic[] },
): DirectoryRead<T> {
  const walked = walkBoundedFiles(directory, projectDir, {
    displayRoot: displayDirectory,
    includeText: true,
    maxDepth: 1,
  })
  if (!walked.present) {
    return { diagnostics: [], files: [], present: false }
  }
  const diagnostics = walked.diagnostics.map(receiptDiagnosticForPathSafety)
  const files: ParsedFile<T>[] = []
  for (const file of walked.files) {
    const entryRef = `${displayDirectory}/${file.relativePath}`
    if (file.relativePath.includes("/") || !file.relativePath.endsWith(".json")) {
      diagnostics.push({
        code: "receipt-entry-invalid",
        message: "Receipt and attempt directories may contain only regular JSON files.",
        path: entryRef,
      })
      continue
    }
    if (file.text === undefined) {
      diagnostics.push({
        code: "receipt-read-failed",
        message: "Receipt or attempt entry could not be read as bounded text.",
        path: entryRef,
      })
      continue
    }
    try {
      const result = parser(file.text, entryRef)
      files.push({ path: entryRef, result })
      if (!result.ok) diagnostics.push(...result.diagnostics)
    } catch {
      diagnostics.push({
        code: "receipt-read-failed",
        message: "Receipt or attempt entry could not be parsed safely.",
        path: entryRef,
      })
    }
  }
  return { diagnostics, files, present: true }
}

function receiptDiagnosticForPathSafety(diagnostic: PathSafetyDiagnostic): ReceiptDiagnostic {
  return {
    code: diagnostic.code === "walker.root_invalid" ? "receipt-directory-invalid" : "receipt-read-failed",
    message: diagnostic.message,
    path: diagnostic.path,
  }
}

export function readLegacyEvidence(
  projectDir: string,
  root = join(projectDir, ".persona/evidence"),
  displayRoot = ".persona/evidence",
): LegacyEvidenceSummary {
  const walked = walkBoundedFiles(root, projectDir, {
    displayRoot,
    includeText: false,
    skipDirectoryNames: ["verification-receipts", "verification-attempts"],
  })
  if (!walked.present) {
    return { diagnosticOnly: true, files: [] }
  }
  return {
    diagnosticOnly: true,
    diagnostics: walked.diagnostics.map(receiptDiagnosticForPathSafety),
    files: walked.files
      .map((file) => `${displayRoot}/${file.relativePath}`)
      .concat(walked.safe ? [] : [`${displayRoot} (unsafe traversal; retained as diagnostic-only)`])
      .sort(),
  }
}

export function legacyDiagnostic(legacyEvidence: LegacyEvidenceSummary, displayRoot = ".persona/evidence"): ReceiptDiagnostic {
  return {
    code: "legacy-evidence-only",
    message: legacyEvidence.files.length === 0
      ? "No legacy evidence is present."
      : "Legacy evidence remains diagnostic-only and cannot migrate into authority.",
    path: displayRoot,
  }
}
