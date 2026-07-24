import { runProjectFinishTrustReadinessWorker } from "./project-finish-attestation-worker.js"

export type ProjectFinishTrustReadiness = {
  readonly networkReadiness: "blocked" | "ready" | "unverified"
  readonly state:
    | "dns-unavailable"
    | "network-unavailable"
    | "ready"
    | "runtime-unsupported"
    | "trust-root-unavailable"
    | "verification-timeout"
  readonly trustRootReadiness: "blocked" | "ready"
}

export function inspectProjectFinishTrustReadiness(): ProjectFinishTrustReadiness {
  const worker = runProjectFinishTrustReadinessWorker()
  if (worker.ok) {
    return {
      networkReadiness: "ready",
      state: "ready",
      trustRootReadiness: "ready",
    }
  }
  return {
    networkReadiness: isNetworkFailure(worker.state) ? "blocked" : "unverified",
    state: worker.state,
    trustRootReadiness: "blocked",
  }
}

export function runtimeBlockedProjectFinishTrustReadiness(): ProjectFinishTrustReadiness {
  return {
    networkReadiness: "unverified",
    state: "runtime-unsupported",
    trustRootReadiness: "blocked",
  }
}

function isNetworkFailure(state: ProjectFinishTrustReadiness["state"]): boolean {
  return state === "dns-unavailable"
    || state === "network-unavailable"
    || state === "verification-timeout"
}
