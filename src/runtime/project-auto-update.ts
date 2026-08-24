import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { isRecord } from "../config/jsonc.js"
import {
  applyProjectAutoUpdate,
  type ProjectAutoUpdateRegistryResult,
} from "../cli/project-auto-update.js"
import { personaHarnessVersion } from "../cli/version.js"

const NPM_REGISTRY_ORIGIN = "https://registry.npmjs.org"
const NPM_VIEW_TIMEOUT_MS = 4_000
const NPM_VIEW_MAX_BUFFER = 8_192

const execFileAsync = promisify(execFile)

export type ProjectAutoUpdateScheduler = {
  schedule(projectDir: string): void
}

export type ProjectAutoUpdateSchedulerOptions = {
  readonly installedVersion?: string
  readonly readLatestVersion?: () => Promise<ProjectAutoUpdateRegistryResult>
}

function readLatestTag(value: unknown): string | undefined {
  return isRecord(value) && typeof value.latest === "string" ? value.latest : undefined
}

async function readLatestVersionFromNpm(): Promise<ProjectAutoUpdateRegistryResult> {
  try {
    const result = await execFileAsync(
      "npm",
      ["view", "persona-harness", "dist-tags", "--json", "--registry", NPM_REGISTRY_ORIGIN],
      {
        encoding: "utf8",
        maxBuffer: NPM_VIEW_MAX_BUFFER,
        timeout: NPM_VIEW_TIMEOUT_MS,
        windowsHide: true,
      },
    )
    const latest = readLatestTag(JSON.parse(result.stdout))
    return latest === undefined ? { kind: "unavailable" } : { kind: "available", version: latest }
  } catch {
    return { kind: "unavailable" }
  }
}

export function createProjectAutoUpdateScheduler(
  options: ProjectAutoUpdateSchedulerOptions = {},
): ProjectAutoUpdateScheduler {
  const installedVersion = options.installedVersion ?? personaHarnessVersion()
  const readLatestVersion = options.readLatestVersion ?? readLatestVersionFromNpm
  let inFlight = false

  return {
    schedule(projectDir: string): void {
      if (inFlight) {
        return
      }
      inFlight = true
      queueMicrotask(() => {
        void applyProjectAutoUpdate({ installedVersion, projectDir, readLatestVersion }).then(
          () => { inFlight = false },
          () => { inFlight = false },
        )
      })
    },
  }
}
