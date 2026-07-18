import { parseProjectFinishAttestationStatement } from "./project-finish-attestation-parser.js"
import type {
  ProjectFinishAttestationAssessment,
  ProjectFinishAttestationDiagnostic,
  ProjectFinishAttestationParseResult,
} from "./project-finish-attestation-types.js"

export { parseProjectFinishAttestationStatement } from "./project-finish-attestation-parser.js"

export function assessProjectFinishAttestationStatement(
  value: unknown,
): ProjectFinishAttestationAssessment {
  const parsed = parseProjectFinishAttestationStatement(value)
  if (parsed.ok) {
    return {
      authorityEligible: false,
      decision: "blocked",
      diagnostics: [{ code: "signature-unverified", path: "signature" }],
      receipt: parsed.value.predicate.receipt,
      state: "signature-unverified",
    }
  }
  return {
    authorityEligible: false,
    decision: "blocked",
    diagnostics: parsed.diagnostics,
    state: failedState(parsed),
  }
}

function failedState(
  result: Extract<ProjectFinishAttestationParseResult, { readonly ok: false }>,
): Exclude<ProjectFinishAttestationAssessment["state"], "signature-unverified"> {
  if (result.diagnostics.some((diagnostic) => diagnostic.code === "binding-mismatch")) {
    return "binding-mismatch"
  }
  if (result.diagnostics.some((diagnostic) => diagnostic.code === "wrong-policy")) {
    return "wrong-policy"
  }
  return "malformed"
}
