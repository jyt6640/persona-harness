import type { MutationEntry } from "./ci-reverification-mutation.js"
import { captureGitIdentityFromCapturedProject } from "./ci-reverification-identity.js"
import { reserveProjectReadBoundary } from "../io/bootstrap-write-boundary.js"
import { captureSourceIdentity, sameSourceIdentity } from "./source-identity.js"
import type { SourceIdentity } from "./source-identity-types.js"
import type { FinishAttestationDiagnostic } from "./workflow-finish-attestation-types.js"

const DIAGNOSTIC_ROOTS = [".persona/evidence", ".persona/workflow"] as const
const SOURCE_IDENTITY_DIAGNOSTIC_ROOTS = [".persona/workflow"] as const

export function compareCurrentSource(
  projectDir: string,
  expected: SourceIdentity,
): FinishAttestationDiagnostic | undefined {
  let boundary: ReturnType<typeof reserveProjectReadBoundary> | undefined
  try {
    boundary = reserveProjectReadBoundary(projectDir)
    const capturedBoundary = boundary
    capturedBoundary.workspaceIdentity()
    const git = captureGitIdentityFromCapturedProject((args) => capturedBoundary.runFixedGit(args))
    if (!git.available || git.head !== expected.repositoryHead || git.status === undefined) {
      return { code: "source-drift", message: "Current Git HEAD or status identity does not match the signed source.", path: "source" }
    }
    if (git.status.entries.some((entry) => !isDiagnosticMutation(entry))) {
      return { code: "source-drift", message: "Tracked source or non-diagnostic files are dirty.", path: "source" }
    }
    const currentSource = captureSourceIdentity(projectDir, git, ".persona/evidence", {
      additionalExcludedRoots: SOURCE_IDENTITY_DIAGNOSTIC_ROOTS,
      gitRunner: (args) => capturedBoundary.runFixedGit(args),
      projectReadBoundary: capturedBoundary,
    })
    if (currentSource.status !== "available" || !sameSourceIdentity(currentSource.value, expected)) {
      return { code: "source-drift", message: "Current source identity does not match the signed canonical-main snapshot.", path: "source" }
    }
    return undefined
  } catch {
    return { code: "source-drift", message: "Current source identity is unavailable.", path: "source" }
  } finally {
    boundary?.close()
  }
}

function isDiagnosticMutation(entry: MutationEntry): boolean {
  if (entry.kind !== "untracked") return false
  return DIAGNOSTIC_ROOTS.some((root) => entry.path === root || entry.path.startsWith(`${root}/`))
}
