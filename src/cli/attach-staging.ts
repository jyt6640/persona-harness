import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { isRecord, stripJsonComments } from "../config/jsonc.js"

const STAGING_CONTEXT = [
  "README.md",
  "build.gradle",
  "build.gradle.kts",
  "settings.gradle",
  "settings.gradle.kts",
  "src",
  ".gitignore",
  ".opencode/opencode.json",
] as const

export function copyAttachContext(projectDir: string, stagingDir: string): void {
  for (const relativePath of STAGING_CONTEXT) {
    const source = join(projectDir, relativePath)
    if (existsSync(source)) {
      const target = join(stagingDir, relativePath)
      mkdirSync(dirname(target), { recursive: true })
      cpSync(source, target, { recursive: true })
    }
  }
}

export function enableAttachEnforcement(stagingDir: string): void {
  const path = join(stagingDir, ".persona", "harness.jsonc")
  const parsed: unknown = JSON.parse(stripJsonComments(readFileSync(path, "utf8")))
  if (!isRecord(parsed)) {
    throw new Error(".persona/harness.jsonc must contain an object.")
  }
  const features = isRecord(parsed.features) ? parsed.features : {}
  const enforce = isRecord(parsed.enforce) ? parsed.enforce : {}
  writeFileSync(
    path,
    `${JSON.stringify({
      ...parsed,
      features: { ...features, entrySteering: false, runtimeInjection: false },
      enforce: {
        ...enforce,
        executeVerification: true,
        idleContinuation: false,
        ralphLoop: {
          ...(isRecord(enforce.ralphLoop) ? enforce.ralphLoop : {}),
          enabled: false,
        },
        systemConstitution: false,
      },
    }, null, 2)}\n`,
  )
}
