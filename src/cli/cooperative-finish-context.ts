import { lstatSync, realpathSync, statSync } from "node:fs"
import { resolve } from "node:path"

import { loadHarnessConfigResult, resolveConfiguredPathResult } from "../config/harness-config.js"
import {
  reserveProjectReadBoundary,
  type ProjectReadBoundary,
} from "../io/bootstrap-write-boundary.js"
import { nativeProjectReadPlatformSupported } from "../io/native-project-read.js"
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
    // A platform the release builds no artifact for cannot reserve a boundary
    // at all, and blocking here defeated the #214 fallback one layer below the
    // branch that skipped the boundary on purpose: `workflow finish` never
    // evaluated a single blocker on Windows, while the notice reported a
    // completed unsnapshotted run. Measured in #235.
    //
    // Prepare without one so the finish reports the blockers the project
    // actually has, which is what `doctor` promises on such a platform.
    // Reaching `passed` is refused separately in
    // `runCurrentProcessCooperativeFinish`, on this same platform fact — the
    // two halves of "reports blockers but cannot reach a cooperative PASS"
    // must not share a gate, or one `undefined` ends up meaning both "degrade"
    // and "fail closed".
    if (!nativeProjectReadPlatformSupported()) {
      return unsnapshottedCooperativeFinishContext(projectDir)
    }
    let boundary: ProjectReadBoundary | undefined
    try {
      boundary = reserveProjectReadBoundary(projectDir)
      return prepareCooperativeFinishContext(projectDir, boundary)
    } catch {
      // On a platform that does build an artifact, a failed reservation is a
      // load or tamper signal rather than a platform fact, and must keep
      // failing closed.
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

/**
 * The workspace root, read without the native boundary.
 *
 * This is the `lstat-verified` guarantee `nativeProjectReadGuardMode()` already
 * names for a platform with no `O_NOFOLLOW`: a symlinked root is refused, but
 * the refusal and the read are not one atomic step. It is deliberately only
 * reachable where no artifact is built, and a context prepared this way can
 * report blockers but can never reach a cooperative PASS.
 */
function unsnapshottedWorkspaceIdentity(projectDir: string): PosixPathIdentity {
  const resolved = resolve(projectDir)
  if (lstatSync(resolved).isSymbolicLink()) {
    throw new Error("workspace-root-symlink")
  }
  const realpath = realpathSync(resolved)
  const identity = statSync(realpath, { bigint: true })
  if (!identity.isDirectory()) {
    throw new Error("workspace-root-not-a-directory")
  }
  return { dev: identity.dev.toString(), ino: identity.ino.toString(), realpath }
}

function unsnapshottedCooperativeFinishContext(projectDir: string): CooperativeFinishContextResult {
  // `loadHarnessConfigResult` already accepts an absent boundary and reads
  // `.persona/harness.jsonc` directly, so nothing here weakens config loading
  // beyond the boundary that does not exist on this platform.
  const config = loadHarnessConfigResult(projectDir)
  if (!config.safe) return { code: "harness-config-invalid", kind: "blocked" }

  let workspace: PosixPathIdentity
  try {
    workspace = unsnapshottedWorkspaceIdentity(projectDir)
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
