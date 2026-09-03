import { createHash } from "node:crypto"
import { realpathSync } from "node:fs"
import process from "node:process"
import { resolve } from "node:path"

import {
  BootstrapWriteBoundaryError,
  BootstrapWriteBoundaryLimitError,
  reserveExistingBootstrapWriteBoundary,
  type BootstrapWriteBoundary,
  type ProjectFileSnapshot,
} from "../io/bootstrap-write-boundary.js"
import {
  parseSocraticInterviewDecisionRecord,
  type SocraticInterviewDecisionRecord,
} from "../interview/socratic-interview-core.js"

export const SOCRATIC_INTERVIEW_DECISION_RECORD_PATH = ".persona/decisions/socratic-interview.json"
export const MAX_SOCRATIC_INTERVIEW_RECORD_BYTES = 16 * 1024

export type SocraticInterviewStoredRecord =
  | { readonly kind: "absent"; readonly revision: 0; readonly snapshot: undefined }
  | {
      readonly kind: "valid"
      readonly revision: number
      readonly snapshot: ProjectFileSnapshot
      readonly value: SocraticInterviewDecisionRecord
    }
  | { readonly kind: "version-mismatch" }
  | { readonly kind: "malformed" }

export class SocraticInterviewProjectStateError extends Error {
  constructor() {
    super("socratic interview project state is unsafe")
    this.name = "SocraticInterviewProjectStateError"
  }
}

export class SocraticInterviewProjectStateStaleError extends Error {
  constructor() {
    super("socratic interview project state changed")
    this.name = "SocraticInterviewProjectStateStaleError"
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
      const file = this.#boundary.readProjectFileWithIdentity(
        SOCRATIC_INTERVIEW_DECISION_RECORD_PATH,
        MAX_SOCRATIC_INTERVIEW_RECORD_BYTES,
      )
      if (file === undefined) return { kind: "absent", revision: 0, snapshot: undefined }
      const parsed = parseRecordJson(file.bytes)
      if (parsed.kind !== "valid") return parsed
      return {
        kind: "valid",
        revision: parsed.value.revision,
        snapshot: { identity: file.identity },
        value: parsed.value,
      }
    } catch (error) {
      if (error instanceof BootstrapWriteBoundaryLimitError) return { kind: "malformed" }
      throw new SocraticInterviewProjectStateError()
    }
  }

  writeRecord(record: SocraticInterviewDecisionRecord): void {
    try {
      const valid = parseWritableRecord(record)
      this.#boundary.writeProjectFileAtomically(
        SOCRATIC_INTERVIEW_DECISION_RECORD_PATH,
        recordText(valid),
        MAX_SOCRATIC_INTERVIEW_RECORD_BYTES,
      )
    } catch (error) {
      if (error instanceof SocraticInterviewProjectStateError) throw error
      throw new SocraticInterviewProjectStateError()
    }
  }

  writeRecordIfUnchanged(
    record: SocraticInterviewDecisionRecord,
    expected: Extract<SocraticInterviewStoredRecord, { readonly kind: "absent" | "valid" }>,
  ): void {
    try {
      const valid = parseWritableRecord(record)
      const result = this.#boundary.writeProjectFileAtomicallyIfUnchanged(
        SOCRATIC_INTERVIEW_DECISION_RECORD_PATH,
        expected.snapshot,
        recordText(valid),
        MAX_SOCRATIC_INTERVIEW_RECORD_BYTES,
      )
      if (result === "stale") throw new SocraticInterviewProjectStateStaleError()
    } catch (error) {
      if (error instanceof SocraticInterviewProjectStateStaleError) throw error
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
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown
  } catch {
    return { kind: "malformed" }
  }
  const parsed = parseSocraticInterviewDecisionRecord(value)
  if (parsed.kind === "version-mismatch") return { kind: "version-mismatch" }
  if (parsed.kind === "malformed") return { kind: "malformed" }
  return parsed
}

function parseWritableRecord(record: unknown): SocraticInterviewDecisionRecord {
  const parsed = parseSocraticInterviewDecisionRecord(record)
  if (parsed.kind !== "valid") throw new SocraticInterviewProjectStateError()
  return parsed.value
}

function recordText(record: SocraticInterviewDecisionRecord): string {
  return `${JSON.stringify(record, null, 2)}\n`
}
