const DNS_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ENODATA",
  "ENOTFOUND",
])

const NETWORK_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETDOWN",
  "ENETUNREACH",
  "EPIPE",
  "ERR_SOCKET_CLOSED",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
])

const TIMEOUT_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "FETCH_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
])

const TRANSPARENCY_ERROR_CODES = new Set([
  "TIMESTAMP_ERROR",
  "TLOG_BODY_ERROR",
  "TLOG_INCLUSION_PROOF_ERROR",
  "TLOG_INCLUSION_PROMISE_ERROR",
  "TLOG_MISSING_INCLUSION_ERROR",
])

export function classifyProjectFinishTrustRootError(error) {
  const codes = boundedErrorCodes(error)
  if (codes.some((code) => DNS_ERROR_CODES.has(code))) return "dns-unavailable"
  if (codes.some((code) => TIMEOUT_ERROR_CODES.has(code))) return "verification-timeout"
  if (codes.some((code) => NETWORK_ERROR_CODES.has(code))) return "network-unavailable"
  return "trust-root-unavailable"
}

export function classifyProjectFinishVerificationError(error) {
  const codes = boundedErrorCodes(error)
  if (codes.includes("SIGNATURE_ERROR") || codes.includes("PUBLIC_KEY_ERROR")) {
    return "signature-invalid"
  }
  if (codes.includes("CERTIFICATE_ERROR") || codes.includes("UNTRUSTED_SIGNER_ERROR")) {
    return "certificate-invalid"
  }
  if (codes.some((code) => TRANSPARENCY_ERROR_CODES.has(code))) {
    return "transparency-invalid"
  }
  return "crypto-failed"
}

function boundedErrorCodes(error) {
  const codes = []
  let current = error
  for (let depth = 0; depth < 8 && isRecord(current); depth += 1) {
    if (typeof current.code === "string" && current.code.length <= 64) {
      codes.push(current.code)
    }
    current = current.cause
  }
  return codes
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
