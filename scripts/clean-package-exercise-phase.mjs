import { isObserverGhStageCode } from "./consumer-authority-observer-gh-stage.mjs"

export const PACKAGE_EXERCISE_PHASE_SCHEMA_VERSION = "clean-package-exercise-phase.1"

export const PACKAGE_EXERCISE_PHASES = Object.freeze({
  "fresh-tar": Object.freeze([
    "tarball-materialization",
    "fresh-install",
    "package-identity",
    "package-content-identity",
    "repository-only-files",
    "canonical-publisher",
    "observer-credential",
    "producer-intake",
    "producer-action-topology",
    "verifier-no-source",
    "project-finish-verifier-no-source",
    "prearmed-observer",
    "v4-cleanliness",
    "observer-gh-selector",
    "attestation-parser",
    "artifact-transport",
    "authority-discovery",
    "authority-lifecycle",
    "staged-artifact-verifier",
    "doctor-registry",
    "evidence-read-write",
    "report-stdin",
    "workflow-lifecycle",
    "bootstrap-workspace-intake",
    "installed-package-test",
  ]),
  "source-built": Object.freeze([
    "cli-binding",
    "producer-intake",
    "producer-action-topology",
    "canonical-publisher",
    "prearmed-observer",
    "v4-cleanliness",
    "observer-gh-selector",
    "attestation-parser",
    "artifact-transport",
    "observer-credential",
    "authority-discovery",
    "authority-lifecycle",
    "doctor-registry",
    "evidence-read-write",
    "report-stdin",
    "workflow-lifecycle",
    "bootstrap-workspace-intake",
  ]),
})

const RECORD_KEYS = Object.freeze([
  "code",
  "phase",
  "schemaVersion",
  "state",
  "surface",
])

export function formatPackageExercisePhaseRecord(surface, phase, state, code, marker) {
  return `${marker}: ${JSON.stringify(createPackageExercisePhaseRecord(surface, phase, state, code))}`
}

export function createPackageExercisePhaseRecord(surface, phase, state, code) {
  if (!isKnownSurface(surface) || !isKnownPhase(surface, phase) || !isKnownPhaseState(state, code)) {
    throw new TypeError("clean package exercise phase record is invalid")
  }
  return {
    code,
    phase,
    schemaVersion: PACKAGE_EXERCISE_PHASE_SCHEMA_VERSION,
    state,
    surface,
  }
}

export function assessPackageExerciseContractOutput({ marker, output, status, successMarker, surface }) {
  if (
    !isKnownSurface(surface)
    || !isSafeMarker(marker)
    || typeof output !== "string"
    || !Number.isInteger(status)
    || typeof successMarker !== "string"
    || successMarker.length === 0
  ) {
    return { state: "invalid" }
  }
  const transcript = parsePackageExerciseTranscript(output, marker, surface)
  if (transcript === undefined) return { state: "invalid" }
  const successCount = output.split("\n").filter((line) => line === successMarker).length
  if (transcript.state === "blocked") {
    if (status === 0 || successCount !== 0) return { state: "invalid" }
    return transcript
  }
  if (status !== 0 || successCount !== 1) return { state: "invalid" }
  return { state: "ready" }
}

function parsePackageExerciseTranscript(output, marker, surface) {
  const prefix = `${marker}: `
  const records = []
  for (const line of output.split("\n")) {
    if (!line.startsWith(prefix)) continue
    if (line.includes("\r")) return undefined
    const record = parsePackageExercisePhaseRecord(line.slice(prefix.length), surface)
    if (record === undefined) return undefined
    records.push(record)
  }
  const expected = PACKAGE_EXERCISE_PHASES[surface]
  if (records.length === 0 || records.length > expected.length) return undefined
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    if (record.phase !== expected[index]) return undefined
    if (record.state === "ready") {
      if (record.code !== "passed") return undefined
      continue
    }
    if (record.state !== "blocked" || !isBlockedCode(record.code) || index !== records.length - 1) {
      return undefined
    }
    return { code: record.code, phase: record.phase, state: "blocked" }
  }
  return records.length === expected.length ? { state: "ready" } : undefined
}

function parsePackageExercisePhaseRecord(value, expectedSurface) {
  let record
  try {
    record = JSON.parse(value)
  } catch {
    return undefined
  }
  if (!isRecord(record) || Object.keys(record).sort().join("\u0000") !== RECORD_KEYS.join("\u0000")) {
    return undefined
  }
  if (
    record.schemaVersion !== PACKAGE_EXERCISE_PHASE_SCHEMA_VERSION
    || record.surface !== expectedSurface
    || !isKnownPhase(record.surface, record.phase)
    || !isKnownPhaseState(record.state, record.code)
  ) {
    return undefined
  }
  return record
}

function isKnownSurface(value) {
  return value === "source-built" || value === "fresh-tar"
}

function isKnownPhase(surface, phase) {
  return typeof phase === "string" && PACKAGE_EXERCISE_PHASES[surface].includes(phase)
}

function isKnownPhaseState(state, code) {
  if (state === "ready") return code === "passed"
  return state === "blocked" && isBlockedCode(code)
}

function isBlockedCode(value) {
  return value === "contract-failed" || isObserverGhStageCode(value)
}

function isSafeMarker(value) {
  return typeof value === "string" && /^[a-z0-9-]{1,128}$/u.test(value)
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
