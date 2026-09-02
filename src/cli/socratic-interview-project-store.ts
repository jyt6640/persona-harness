import { createHash } from "node:crypto"
import { realpathSync } from "node:fs"
import process from "node:process"
import { resolve } from "node:path"

import {
  BootstrapWriteBoundaryError,
  reserveExistingBootstrapWriteBoundary,
  type BootstrapWriteBoundary,
} from "../io/bootstrap-write-boundary.js"
import {
  parseSocraticInterviewDecisionRecord,
  type SocraticInterviewDecisionRecord,
} from "../interview/socratic-interview-core.js"

export const SOCRATIC_INTERVIEW_DECISION_RECORD_PATH = ".persona/decisions/socratic-interview.json"

export type SocraticInterviewStoredRecord =
  | { readonly kind: "absent"; readonly revision: 0 }
  | { readonly kind: "valid"; readonly revision: number; readonly value: SocraticInterviewDecisionRecord }
  | { readonly kind: "version-mismatch" }
  | { readonly kind: "malformed" }

export class SocraticInterviewProjectStateError extends Error {
  constructor() {
    super("socratic interview project state is unsafe")
    this.name = "SocraticInterviewProjectStateError"
  }
}

export class SocraticInterviewProjectStore {
  readonly projectBinding: string
  readonly #boundary: BootstrapWriteBoundary

  constructor(boundary: BootstrapWriteBoundary, projectBinding: string) {
    this.#boundary = boundary
    this.projectBinding = projectBinding
  }

  close(): void {
    this.#boundary.close()
  }

  readRecord(): SocraticInterviewStoredRecord {
    try {
      const bytes = this.#boundary.readProjectFile(SOCRATIC_INTERVIEW_DECISION_RECORD_PATH)
      if (bytes === undefined) return { kind: "absent", revision: 0 }
      const parsed = parseRecordJson(bytes)
      if (parsed.kind !== "valid") return parsed
      return { kind: "valid", revision: parsed.value.revision, value: parsed.value }
    } catch {
      throw new SocraticInterviewProjectStateError()
    }
  }

  writeRecord(record: SocraticInterviewDecisionRecord): void {
    try {
      this.#boundary.writeProjectFileAtomically(
        SOCRATIC_INTERVIEW_DECISION_RECORD_PATH,
        `${JSON.stringify(record, null, 2)}\n`,
      )
    } catch {
      throw new SocraticInterviewProjectStateError()
    }
  }
}

export function openSocraticInterviewProjectStore(projectDir?: string): SocraticInterviewProjectStore {
  let boundary: BootstrapWriteBoundary | undefined
  try {
    const project = resolve(projectDir ?? process.cwd())
    boundary = reserveExistingBootstrapWriteBoundary(project)
    const projectBinding = `sha256:${createHash("sha256").update(realpathSync(project)).digest("hex")}`
    const store = new SocraticInterviewProjectStore(boundary, projectBinding)
    boundary = undefined
    return store
  } catch (error) {
    if (boundary !== undefined) boundary.close()
    if (error instanceof BootstrapWriteBoundaryError) throw new SocraticInterviewProjectStateError()
    throw new SocraticInterviewProjectStateError()
  }
}

function parseRecordJson(bytes: Buffer): Exclude<SocraticInterviewStoredRecord, { readonly kind: "absent" | "valid" }> | { readonly kind: "valid"; readonly value: SocraticInterviewDecisionRecord } {
  let value: unknown
  try {
    value = JSON.parse(bytes.toString("utf8")) as unknown
  } catch {
    return { kind: "malformed" }
  }
  const parsed = parseSocraticInterviewDecisionRecord(value)
  if (parsed.kind === "version-mismatch") return { kind: "version-mismatch" }
  if (parsed.kind === "malformed") return { kind: "malformed" }
  return parsed
}
