export const AUTHORITY_DISCOVERY_EXERCISE_SCHEMA_VERSION = "consumer-authority-discovery-exercise.1"
export const AUTHORITY_DISCOVERY_EXERCISE_MARKER = "authority-discovery-exercise-result"

const RESULT = "trusted-unconsumed-persisted"
const RECORD_KEYS = Object.freeze(["result", "schemaVersion", "surface"])

export function createAuthorityDiscoveryExerciseResult(surface) {
  if (!isSurface(surface)) throw new TypeError("authority discovery exercise surface is invalid")
  return {
    result: RESULT,
    schemaVersion: AUTHORITY_DISCOVERY_EXERCISE_SCHEMA_VERSION,
    surface,
  }
}

export function formatAuthorityDiscoveryExerciseResult(value) {
  if (!isCanonicalResult(value)) throw new TypeError("authority discovery exercise result is invalid")
  return `${AUTHORITY_DISCOVERY_EXERCISE_MARKER}: ${JSON.stringify(value)}`
}

export function assessAuthorityDiscoveryExerciseResult(output, surface) {
  if (typeof output !== "string" || !isSurface(surface)) return { state: "invalid" }
  const prefix = `${AUTHORITY_DISCOVERY_EXERCISE_MARKER}: `
  const records = []
  for (const line of output.split("\n")) {
    if (!line.startsWith(prefix)) continue
    if (line.includes("\r")) return { state: "invalid" }
    const record = parseResult(line.slice(prefix.length))
    if (record === undefined) return { state: "invalid" }
    records.push(record)
  }
  return records.length === 1 && records[0].surface === surface
    ? { state: "ready" }
    : { state: "invalid" }
}

function parseResult(value) {
  let result
  try {
    result = JSON.parse(value)
  } catch {
    return undefined
  }
  return isCanonicalResult(result) ? result : undefined
}

function isCanonicalResult(value) {
  return isRecord(value)
    && Object.keys(value).sort().join("\u0000") === RECORD_KEYS.join("\u0000")
    && value.result === RESULT
    && value.schemaVersion === AUTHORITY_DISCOVERY_EXERCISE_SCHEMA_VERSION
    && isSurface(value.surface)
}

function isSurface(value) {
  return value === "source-built" || value === "fresh-tar"
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
