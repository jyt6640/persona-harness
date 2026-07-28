import { loadHarnessConfigResult, resolveConfiguredPathResult } from "../config/harness-config.js"
import {
  reserveProjectReadBoundary,
  type ProjectReadBoundary,
} from "../io/bootstrap-write-boundary.js"
import type { PosixPathIdentity } from "./ci-reverification-identity.js"

export type CooperativeFinishContext = {
  readonly evidenceRoot: string
  readonly evidenceRootRelativePath: string
  readonly workspace: PosixPathIdentity
}

export type CooperativeFinishContextResult =
  | { readonly code: string; readonly kind: "blocked" }
  | { readonly kind: "ready"; readonly value: CooperativeFinishContext }

export function prepareCooperativeFinishContext(
  projectDir: string,
  projectReadBoundary?: ProjectReadBoundary,
): CooperativeFinishContextResult {
  if (projectReadBoundary === undefined) {
    let boundary: ProjectReadBoundary | undefined
    try {
      boundary = reserveProjectReadBoundary(projectDir)
      return prepareCooperativeFinishContext(projectDir, boundary)
    } catch {
      return { code: "source-read-runtime-unavailable", kind: "blocked" }
    } finally {
      boundary?.close()
    }
  }
  const config = loadHarnessConfigResult(projectDir, projectReadBoundary)
  if (!config.safe) return { code: "harness-config-invalid", kind: "blocked" }

  let workspace: PosixPathIdentity
  try {
    workspace = projectReadBoundary.workspaceIdentity()
  } catch {
    return { code: "workspace-root-unavailable", kind: "blocked" }
  }

  const evidenceRoot = resolveConfiguredPathResult(workspace.realpath, config.config.evidenceDir)
  if (!evidenceRoot.ok) return { code: "evidence-path-unsafe", kind: "blocked" }

  return {
    kind: "ready",
    value: {
      evidenceRoot: evidenceRoot.path,
      evidenceRootRelativePath: evidenceRoot.relativePath,
      workspace,
    },
  }
}

export function cooperativeWorkspaceKey(workspace: PosixPathIdentity): string {
  return `${workspace.realpath}\u0000${workspace.dev}\u0000${workspace.ino}`
}
