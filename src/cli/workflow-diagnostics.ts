import { lstatSync, realpathSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import {
  INIT_MANIFEST_RELATIVE_PATH,
  parseInitManifestBytes,
  sha256Bytes,
} from "./init-manifest.js"
import { verifyInitOwnership } from "./init-ownership.js"
import { PROFILE_PATH } from "./intake-profile.js"
import {
  IMPLEMENTATION_REPORT_PATH,
  PLAN_PATH,
  REVIEW_REPORT_PATH,
} from "./plan.js"
import {
  reserveExistingBootstrapWriteBoundary,
  reserveProjectReadBoundary,
  type BootstrapWriteBoundary,
} from "../io/bootstrap-write-boundary.js"
import { nativeProjectReadPlatformSupported } from "../io/native-project-read.js"

const HISTORY_ROOT = ".persona/workflow/history"

export type WorkflowWorkspaceIntake =
  | "absent"
  | "clean-uninitialized"
  | "owned-ready"
  | "foreign-stale-unsafe"
  | "invalid"

export type WorkflowPlanDiagnostic =
  "accepted" | "draft" | "needs-revision" | "invalid" | "missing"
export type WorkflowArtifactDiagnostic = "present" | "missing"
export type WorkflowHistoryDiagnostic = "present" | "missing"
export type WorkflowLifecycleDiagnostic =
  "active" | "incomplete" | "not-applicable"
export type SourceReadPrerequisiteDiagnostic =
  "ready" | "blocked" | "not-applicable"
type SourceReadAvailabilityDiagnostic = Exclude<
  SourceReadPrerequisiteDiagnostic,
  "not-applicable"
>

export type WorkflowDiagnosis = {
  readonly activePlan: WorkflowPlanDiagnostic
  readonly activeWorkflowLifecycle: WorkflowLifecycleDiagnostic
  readonly finishAuthority: "diagnostic-only"
  readonly implementationReport: WorkflowArtifactDiagnostic
  readonly nextCommand?: string
  readonly reviewReport: WorkflowArtifactDiagnostic
  readonly sourceReadPrerequisite: SourceReadPrerequisiteDiagnostic
  readonly workflowHistoryArchives: WorkflowHistoryDiagnostic
  readonly workspaceIntake: WorkflowWorkspaceIntake
}

export type WorkflowDiagnosisOptions = {
  readonly sourceReadPrerequisite?: (
    projectDir: string,
  ) => SourceReadAvailabilityDiagnostic
}

type DirectoryState = "absent" | "directory" | "unsafe"
type FileState = "absent" | "file" | "unsafe"

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error))
    return undefined
  const code = error.code
  return typeof code === "string" ? code : undefined
}

function directoryState(path: string): DirectoryState {
  try {
    const stat = lstatSync(path)
    return stat.isDirectory() && !stat.isSymbolicLink() ? "directory" : "unsafe"
  } catch (error) {
    return errorCode(error) === "ENOENT" ? "absent" : "unsafe"
  }
}

function fileState(path: string): FileState {
  try {
    const stat = lstatSync(path)
    return stat.isFile() && !stat.isSymbolicLink() ? "file" : "unsafe"
  } catch (error) {
    return errorCode(error) === "ENOENT" ? "absent" : "unsafe"
  }
}

function readWorkspaceIntake(projectDir: string): WorkflowWorkspaceIntake {
  const projectState = directoryState(projectDir)
  if (projectState === "absent") return "absent"
  if (projectState !== "directory") return "foreign-stale-unsafe"

  const personaState = directoryState(join(projectDir, ".persona"))
  if (personaState === "absent") return "clean-uninitialized"
  if (personaState !== "directory") return "foreign-stale-unsafe"

  const manifestState = fileState(join(projectDir, INIT_MANIFEST_RELATIVE_PATH))
  if (manifestState !== "file") return "foreign-stale-unsafe"

  const workflowState = directoryState(join(projectDir, ".persona", "workflow"))
  if (workflowState !== "directory") return "foreign-stale-unsafe"

  let boundary: BootstrapWriteBoundary | undefined
  try {
    const activeBoundary = reserveExistingBootstrapWriteBoundary(projectDir)
    boundary = activeBoundary
    const manifestBytes = activeBoundary.readProjectFile(
      INIT_MANIFEST_RELATIVE_PATH,
    )
    if (manifestBytes === undefined) return "foreign-stale-unsafe"

    let manifest
    try {
      manifest = parseInitManifestBytes(manifestBytes)
    } catch {
      return "invalid"
    }

    try {
      activeBoundary.withCapturedProject(() => {
        const profileBytes = activeBoundary.readProjectFile(PROFILE_PATH)
        verifyInitOwnership(manifest, {
          ownedFileCheck: { kind: "exact" },
          profileBinding: {
            kind: "exact",
            digest:
              profileBytes === undefined ? null : sha256Bytes(profileBytes),
          },
          projectRealPath: realpathSync("."),
          readOwnedFile: (relativePath) => activeBoundary.readProjectFile(relativePath),
        })
      })
    } catch {
      return "foreign-stale-unsafe"
    }
    return "owned-ready"
  } catch {
    return "foreign-stale-unsafe"
  } finally {
    boundary?.close()
  }
}

function readPlanDiagnostic(bytes: Buffer | undefined): WorkflowPlanDiagnostic {
  if (bytes === undefined) return "missing"
  const match = /^Status:\s*(.+?)\s*$/mu.exec(bytes.toString("utf8"))
  switch (match?.[1]?.trim()) {
    case "accepted":
      return "accepted"
    case "draft":
      return "draft"
    case "needs-revision":
      return "needs-revision"
    default:
      return "invalid"
  }
}

function readArtifactDiagnostic(
  boundary: BootstrapWriteBoundary,
  relativePath: string,
): WorkflowArtifactDiagnostic {
  return boundary.readProjectFile(relativePath) === undefined
    ? "missing"
    : "present"
}

function readArtifacts(
  projectDir: string,
): Omit<
  WorkflowDiagnosis,
  "nextCommand" | "sourceReadPrerequisite" | "workspaceIntake"
> {
  let boundary: BootstrapWriteBoundary | undefined
  try {
    boundary = reserveExistingBootstrapWriteBoundary(projectDir)
    const activePlan = readPlanDiagnostic(boundary.readProjectFile(PLAN_PATH))
    const implementationReport = readArtifactDiagnostic(
      boundary,
      IMPLEMENTATION_REPORT_PATH,
    )
    const reviewReport = readArtifactDiagnostic(boundary, REVIEW_REPORT_PATH)
    const workflowHistoryArchives =
      boundary.listProjectRegularFiles([HISTORY_ROOT], ".md", 1).length > 0
        ? "present"
        : "missing"
    const activeWorkflowLifecycle =
      activePlan === "accepted" &&
      implementationReport === "present" &&
      reviewReport === "present"
        ? "active"
        : "incomplete"
    return {
      activePlan,
      activeWorkflowLifecycle,
      finishAuthority: "diagnostic-only",
      implementationReport,
      reviewReport,
      workflowHistoryArchives,
    }
  } catch {
    return {
      activePlan: "missing",
      activeWorkflowLifecycle: "incomplete",
      finishAuthority: "diagnostic-only",
      implementationReport: "missing",
      reviewReport: "missing",
      workflowHistoryArchives: "missing",
    }
  } finally {
    boundary?.close()
  }
}

function readSourceReadPrerequisite(
  projectDir: string,
): SourceReadAvailabilityDiagnostic {
  if (!nativeProjectReadPlatformSupported()) return "blocked"
  let boundary: ReturnType<typeof reserveProjectReadBoundary> | undefined
  try {
    boundary = reserveProjectReadBoundary(projectDir)
    return "ready"
  } catch {
    return "blocked"
  } finally {
    boundary?.close()
  }
}

function emptyArtifacts(): Omit<
  WorkflowDiagnosis,
  "nextCommand" | "sourceReadPrerequisite" | "workspaceIntake"
> {
  return {
    activePlan: "missing",
    activeWorkflowLifecycle: "not-applicable",
    finishAuthority: "diagnostic-only",
    implementationReport: "missing",
    reviewReport: "missing",
    workflowHistoryArchives: "missing",
  }
}

export function readWorkflowDiagnosis(
  projectDir = process.cwd(),
  options: WorkflowDiagnosisOptions = {},
): WorkflowDiagnosis {
  const resolvedProjectDir = resolve(projectDir)
  const workspaceIntake = readWorkspaceIntake(resolvedProjectDir)
  const ready = workspaceIntake === "owned-ready"
  const artifacts = ready ? readArtifacts(resolvedProjectDir) : emptyArtifacts()
  const sourceReadPrerequisite = ready
    ? (options.sourceReadPrerequisite ?? readSourceReadPrerequisite)(
        resolvedProjectDir,
      )
    : "not-applicable"
  return {
    ...artifacts,
    ...(workspaceIntake === "clean-uninitialized"
      ? { nextCommand: "npx ph bootstrap backend" }
      : {}),
    sourceReadPrerequisite,
    workspaceIntake,
  }
}
