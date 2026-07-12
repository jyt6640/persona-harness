import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

export type AttachProfileDraft = {
  readonly inferredStack: string
  readonly projectName: string | null
  readonly unresolved: readonly string[]
}

function readIfPresent(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : ""
}

function hasJavaSource(projectDir: string): boolean {
  const root = join(projectDir, "src", "main", "java")
  const pending = [root]
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined || !existsSync(current)) {
      continue
    }
    for (const entry of readdirSync(current)) {
      const path = join(current, entry)
      const stat = statSync(path)
      if (stat.isDirectory()) {
        pending.push(path)
      } else if (entry.endsWith(".java")) {
        return true
      }
    }
  }
  return false
}

function projectName(settings: string): string | null {
  return /rootProject\.name\s*=\s*['"]([^'"]+)['"]/u.exec(settings)?.[1] ?? null
}

export function inferAttachProfile(projectDir: string): AttachProfileDraft {
  const groovyBuild = readIfPresent(join(projectDir, "build.gradle"))
  const kotlinBuild = readIfPresent(join(projectDir, "build.gradle.kts"))
  const build = `${groovyBuild}\n${kotlinBuild}`
  const settings = `${readIfPresent(join(projectDir, "settings.gradle"))}\n${readIfPresent(join(projectDir, "settings.gradle.kts"))}`
  const hasGradle = groovyBuild.length > 0 || kotlinBuild.length > 0
  const hasSpring = /org\.springframework\.boot|spring-boot/iu.test(build)
  const hasJava = hasJavaSource(projectDir) || /\bid\s*\(?\s*['"]java['"]|\bjava\s*\{/u.test(build)
  const unresolved = [
    ...(hasGradle ? [] : ["build tool"]),
    ...(hasSpring ? [] : ["Spring framework"]),
    ...(hasJava ? [] : ["Java source/package structure"]),
  ]
  return {
    inferredStack: [
      hasJava ? "Java" : "unresolved language",
      hasSpring ? "Spring" : "unresolved framework",
      hasGradle ? "Gradle" : "unresolved build tool",
    ].join(" / "),
    projectName: projectName(settings),
    unresolved,
  }
}
