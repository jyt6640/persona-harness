import {
  INIT_MANIFEST_RELATIVE_PATH,
  serializeInitManifest,
  type InitManifest,
} from "./init-manifest.js"
import {
  cleanupOwnedFiles,
  rollback,
  writeBackup,
} from "./init-transaction-recovery.js"
import {
  readSnapshot,
  sameSnapshot,
  writeTarget,
  type WrittenFile,
} from "./init-transaction-io.js"

export type InitTarget = {
  readonly relativePath: string
  readonly nextBytes: Buffer
}

export type InitTransactionOptions = {
  readonly dryRun?: boolean
  readonly onBeforeCommit?: () => void
  readonly onAfterCommitFile?: (relativePath: string) => void
}

export type InitTransactionResult = {
  readonly decision: "apply" | "no-op" | "dry-run"
  readonly changed: readonly string[]
  readonly backups: readonly string[]
}

function changedTargets(
  targets: readonly InitTarget[],
  snapshots: readonly ReturnType<typeof readSnapshot>[],
): readonly string[] {
  return targets
    .filter((target, index) => {
      const snapshot = snapshots[index]
      return snapshot !== undefined && (snapshot.bytes === null || !snapshot.bytes.equals(target.nextBytes))
    })
    .map((target) => target.relativePath)
}

export function commitInitPlan(
  projectDir: string,
  targets: readonly InitTarget[],
  manifest: InitManifest,
  sourceManifest: InitManifest | null,
  options: InitTransactionOptions = {},
): InitTransactionResult {
  const orderedTargets = [...targets].sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  const allTargets: readonly InitTarget[] = [
    ...orderedTargets,
    { relativePath: INIT_MANIFEST_RELATIVE_PATH, nextBytes: serializeInitManifest(manifest) },
  ]
  const snapshots = allTargets.map((target) => readSnapshot(projectDir, target.relativePath))
  const changes = changedTargets(allTargets, snapshots)

  if (options.dryRun) {
    return { decision: "dry-run", changed: changes, backups: [] }
  }
  if (changes.length === 0) {
    return { decision: "no-op", changed: [], backups: [] }
  }

  options.onBeforeCommit?.()
  if (snapshots.some((snapshot) => !sameSnapshot(snapshot))) {
    throw new Error("Init target changed before commit; no files were changed.")
  }

  const createdDirs = new Set<string>()
  const written: WrittenFile[] = []
  let backup: { readonly relativePath: string; readonly ownedFiles: readonly string[] } | null = null
  try {
    const changedExisting = snapshots.filter((snapshot, index) => {
      const target = allTargets[index]
      return target !== undefined && snapshot.bytes !== null && !snapshot.bytes.equals(target.nextBytes)
    })
    backup = writeBackup(projectDir, changedExisting, sourceManifest, createdDirs)
    for (const target of allTargets) {
      const snapshot = snapshots.find((entry) => entry.relativePath === target.relativePath)
      if (snapshot === undefined || (snapshot.bytes !== null && snapshot.bytes.equals(target.nextBytes))) {
        continue
      }
      const nextIdentity = writeTarget(snapshot, target.nextBytes, projectDir, createdDirs)
      written.push({ snapshot, nextBytes: target.nextBytes, identity: nextIdentity })
      options.onAfterCommitFile?.(target.relativePath)
    }
    return {
      decision: "apply",
      changed: changes,
      backups: backup === null ? [] : [backup.relativePath],
    }
  } catch (error) {
    rollback(projectDir, written, createdDirs)
    if (backup !== null) {
      cleanupOwnedFiles(projectDir, backup.ownedFiles)
      cleanupOwnedFiles(projectDir, [backup.relativePath])
    }
    throw error
  }
}
