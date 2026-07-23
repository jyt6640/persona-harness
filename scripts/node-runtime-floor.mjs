export const SIGSTORE_NODE_ENGINE_RANGE = "^20.17.0 || >=22.9.0"

const STRICT_NODE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u

export function assessSigstoreNodeRuntime(version) {
  const parsed = parseNodeVersion(version)
  const supported = parsed !== undefined
    && (
      (parsed.major === 20 && parsed.minor >= 17)
      || (parsed.major === 22 && parsed.minor >= 9)
      || parsed.major >= 23
    )
  return {
    requiredRange: SIGSTORE_NODE_ENGINE_RANGE,
    status: supported ? "supported" : "unsupported",
  }
}

function parseNodeVersion(version) {
  if (typeof version !== "string") return undefined
  const match = STRICT_NODE_VERSION.exec(version)
  if (match === null) return undefined
  const [major, minor, patch] = match.slice(1).map(Number)
  return Number.isSafeInteger(major) && Number.isSafeInteger(minor) && Number.isSafeInteger(patch)
    ? { major, minor, patch }
    : undefined
}
