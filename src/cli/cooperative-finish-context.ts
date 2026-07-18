import { loadHarnessConfigResult, resolveConfiguredPathResult } from "../config/harness-config.js"
import { captureWorkspaceIdentity, type PosixPathIdentity } from "./ci-reverification-identity.js"

export type CooperativeFinishContext = {
  readonly evidenceRoot: string
  readonly evidenceRootRelativePath: string
  readonly workspace: PosixPathIdentity
}

export type CooperativeFinishContextResult =
  | { readonly code: string; readonly kind: "blocked" }
  | { readonly kind: "ready"; readonly value: CooperativeFinishContext }

export function prepareCooperativeFinishContext(projectDir: string): CooperativeFinishContextResult {
  const config = loadHarnessConfigResult(projectDir)
  if (!config.safe) return { code: "harness-config-invalid", kind: "blocked" }

  const evidenceRoot = resolveConfiguredPathResult(projectDir, config.config.evidenceDir)
  if (!evidenceRoot.ok) return { code: "evidence-path-unsafe", kind: "blocked" }

  const workspace = captureWorkspaceIdentity(projectDir)
  if (workspace.status === "unavailable") {
    return { code: workspace.diagnosticCode, kind: "blocked" }
  }

  return {
    kind: "ready",
    value: {
      evidenceRoot: evidenceRoot.path,
      evidenceRootRelativePath: evidenceRoot.relativePath,
      workspace: workspace.value,
    },
  }
}

export function cooperativeWorkspaceKey(workspace: PosixPathIdentity): string {
  return `${workspace.realpath}\u0000${workspace.dev}\u0000${workspace.ino}`
}
