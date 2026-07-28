import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { withPackagePackLock } from "../package-pack-lock.js"

const RUNTIME_PATHS = ["dist", "native", "scripts", "package.json"] as const
const BUILD_TIMEOUT_MS = 60_000
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

export type ProjectFinishProducerRuntimeStaging = {
  readonly cleanup: () => void
  readonly root: string
  readonly startedWithoutDist: boolean
}

export function stageProjectFinishProducerRuntime(): ProjectFinishProducerRuntimeStaging {
  const root = mkdtempSync(join(tmpdir(), "persona-project-finish-producer-runtime-"))
  try {
    const startedWithoutDist = withPackagePackLock(() => {
      const dist = join(repositoryRoot, "dist")
      rmSync(dist, { force: true, recursive: true })
      const startedClean = !existsSync(dist)
      const build = spawnSync("npm", ["run", "build"], {
        cwd: repositoryRoot,
        env: process.env,
        stdio: "ignore",
        timeout: BUILD_TIMEOUT_MS,
      })
      if (build.error !== undefined || build.signal !== null || build.status !== 0) {
        throw new Error("project-finish-producer-runtime-materialization-failed")
      }
      for (const path of RUNTIME_PATHS) {
        cpSync(join(repositoryRoot, path), join(root, path), { recursive: true })
      }
      return startedClean
    }, repositoryRoot)
    return {
      cleanup: () => rmSync(root, { force: true, recursive: true }),
      root,
      startedWithoutDist,
    }
  } catch (error) {
    rmSync(root, { force: true, recursive: true })
    if (error instanceof Error && error.message === "project-finish-producer-runtime-materialization-failed") {
      throw error
    }
    throw new Error("project-finish-producer-runtime-materialization-failed")
  }
}
