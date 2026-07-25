import type {
  ProjectFinishTrustReadiness,
} from "../../src/cli/project-finish-trust-readiness.js"

export function inspectReadySigstoreTrust(): ProjectFinishTrustReadiness {
  return {
    networkReadiness: "ready",
    state: "ready",
    trustRootReadiness: "ready",
  }
}
