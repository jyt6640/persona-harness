import { cpSync, existsSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

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

export function copyAttachContext(
  projectDir: string,
  stagingDir: string,
  ownedHostSkillAdapterPaths: readonly string[] = [],
): void {
  for (const relativePath of [...STAGING_CONTEXT, ...ownedHostSkillAdapterPaths]) {
    const source = join(projectDir, relativePath)
    if (existsSync(source)) {
      const target = join(stagingDir, relativePath)
      mkdirSync(dirname(target), { recursive: true })
      cpSync(source, target, { recursive: true })
    }
  }
}
