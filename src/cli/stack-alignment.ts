import { execFileSync } from "node:child_process"
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { readProfileIntent, type ProfileIntent } from "./stack-alignment-profile.js"

type StackFinding = "PASS" | "WARN"

export type StackAlignmentSummary = {
  readonly stackAlignment: string
  readonly stackAlignmentBlocking: boolean
  readonly stackAlignmentFinding: StackFinding
}

type GeneratedStackEvidence = {
  readonly buildText: string
  readonly hasBuildGradle: boolean
  readonly hasController: boolean
  readonly hasDbDependency: boolean
  readonly hasFakeGradleShim: boolean
  readonly hasGradleWrapper: boolean
  readonly hasJavaSource: boolean
  readonly hasJpaDependency: boolean
  readonly hasMaven: boolean
  readonly hasSettingsGradle: boolean
  readonly hasSpringBootApplication: boolean
  readonly hasSpringBootBuild: boolean
  readonly hasWebStarter: boolean
  readonly javaText: string
  readonly migrationEvidence: readonly string[]
  readonly sourceFilesPresent: boolean
}

const DATABASE_STORAGE_PATTERN = /\b(?:database|db|postgres|postgresql|mysql|mariadb|h2)\b/i
const JPA_PATTERN = /\b(?:jpa|hibernate)\b/i
const DB_DEPENDENCY_PATTERN = /com\.h2database:h2|org\.postgresql:postgresql|mysql:mysql-connector|com\.mysql:mysql-connector|mariadb-java-client/i
const FAKE_GRADLE_PATTERN = /gradle-shim|fake\s+gradle|fake\s+build/i
const JPA_DEPENDENCY_PATTERN = /spring-boot-starter-data-jpa|hibernate-core|jakarta\.persistence/i
const SPRING_BOOT_PATTERN = /org\.springframework\.boot|spring-boot-starter/i
const WEB_STARTER_PATTERN = /spring-boot-starter-web|spring-boot-starter-webflux|spring-webmvc/i

function pass(stackAlignment: string): StackAlignmentSummary {
  return { stackAlignment, stackAlignmentBlocking: false, stackAlignmentFinding: "PASS" }
}

function warn(stackAlignment: string, stackAlignmentBlocking: boolean): StackAlignmentSummary {
  return { stackAlignment, stackAlignmentBlocking, stackAlignmentFinding: "WARN" }
}

function readIfExists(projectDir: string, relativePath: string): string {
  const filePath = join(projectDir, relativePath)
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
}

function hasAny(projectDir: string, relativePaths: readonly string[]): boolean {
  return relativePaths.some((relativePath) => existsSync(join(projectDir, relativePath)))
}

function hasFileDeep(dirPath: string, predicate: (filePath: string) => boolean, depth = 0): boolean {
  if (depth > 64) return false
  const entries = safeDirectoryEntries(dirPath)
  if (entries === undefined) return false
  for (const entry of entries) {
    const entryPath = join(dirPath, entry)
    const stat = safeLstat(entryPath)
    if (stat === undefined || stat.isSymbolicLink()) continue
    if (stat.isFile() && predicate(entryPath)) return true
    if (stat.isDirectory() && hasFileDeep(entryPath, predicate, depth + 1)) return true
  }
  return false
}

function readFilesDeep(dirPath: string, predicate: (filePath: string) => boolean, depth = 0): string {
  if (depth > 64) return ""
  const entries = safeDirectoryEntries(dirPath)
  if (entries === undefined) return ""
  const chunks: string[] = []
  for (const entry of entries) {
    const entryPath = join(dirPath, entry)
    const stat = safeLstat(entryPath)
    if (stat === undefined || stat.isSymbolicLink()) continue
    if (stat.isDirectory()) {
      chunks.push(readFilesDeep(entryPath, predicate, depth + 1))
    } else if (stat.isFile() && predicate(entryPath)) {
      try {
        chunks.push(readFileSync(entryPath, "utf8"))
      } catch {
        return ""
      }
    }
  }
  return chunks.join("\n")
}

function safeDirectoryEntries(dirPath: string): readonly string[] | undefined {
  const stat = safeLstat(dirPath)
  if (stat === undefined || stat.isSymbolicLink() || !stat.isDirectory()) return undefined
  try {
    return readdirSync(dirPath)
  } catch {
    return undefined
  }
}

function safeLstat(path: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path)
  } catch {
    return undefined
  }
}

function canRunSystemGradle(): boolean {
  try {
    execFileSync("gradle", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 })
    return true
  } catch (error) {
    if (error instanceof Error) return false
    throw error
  }
}

function migrationEvidence(projectDir: string, buildText: string): readonly string[] {
  return [
    ...(existsSync(join(projectDir, "src", "main", "resources", "schema.sql")) || existsSync(join(projectDir, "schema.sql")) ? ["schema.sql"] : []),
    ...(hasFileDeep(join(projectDir, "src", "main", "resources", "db", "migration"), (filePath) => /\.(?:sql|java)$/.test(filePath)) ? ["flyway"] : []),
    ...(hasFileDeep(join(projectDir, "src", "main", "resources", "db", "changelog"), (filePath) => /\.(?:xml|ya?ml|json|sql)$/.test(filePath)) ? ["liquibase"] : []),
    ...(buildText.includes("org.flywaydb") ? ["flyway"] : []),
    ...(buildText.includes("liquibase") ? ["liquibase"] : []),
  ]
}

function generatedStackEvidence(projectDir: string): GeneratedStackEvidence {
  const buildText = `${readIfExists(projectDir, "build.gradle")}\n${readIfExists(projectDir, "build.gradle.kts")}`
  const javaText = readFilesDeep(join(projectDir, "src", "main", "java"), (filePath) => filePath.endsWith(".java"))
  const gradlewText = `${readIfExists(projectDir, "gradlew")}\n${readIfExists(projectDir, "gradlew.bat")}`
  return {
    buildText,
    hasBuildGradle: hasAny(projectDir, ["build.gradle", "build.gradle.kts"]),
    hasController: /@(RestController|Controller)\b/.test(javaText),
    hasDbDependency: DB_DEPENDENCY_PATTERN.test(buildText),
    hasFakeGradleShim: hasAny(projectDir, ["gradle-shim.js", "tools/gradle-shim.js"]) || FAKE_GRADLE_PATTERN.test(`${buildText}\n${gradlewText}`),
    hasGradleWrapper: hasAny(projectDir, ["gradlew", "gradlew.bat"]),
    hasJavaSource: hasFileDeep(join(projectDir, "src", "main", "java"), (filePath) => filePath.endsWith(".java")),
    hasJpaDependency: JPA_DEPENDENCY_PATTERN.test(buildText),
    hasMaven: hasAny(projectDir, ["pom.xml"]),
    hasSettingsGradle: hasAny(projectDir, ["settings.gradle", "settings.gradle.kts"]),
    hasSpringBootApplication: /@SpringBootApplication\b/.test(javaText),
    hasSpringBootBuild: SPRING_BOOT_PATTERN.test(buildText),
    hasWebStarter: WEB_STARTER_PATTERN.test(buildText),
    javaText,
    migrationEvidence: migrationEvidence(projectDir, buildText),
    sourceFilesPresent: hasFileDeep(join(projectDir, "src"), () => true),
  }
}

function expectsJpaDatabase(intent: ProfileIntent): boolean {
  return intent.language === "java"
    && intent.framework === "spring"
    && intent.buildTool === "gradle"
    && DATABASE_STORAGE_PATTERN.test(intent.storage)
    && JPA_PATTERN.test(intent.persistenceTechnology)
}

function migrationDetail(intent: ProfileIntent, evidence: GeneratedStackEvidence): readonly string[] {
  if (intent.migrationStyle === "schema.sql") return evidence.migrationEvidence.includes("schema.sql") ? [] : ["missing schema.sql migration"]
  if (intent.migrationStyle === "flyway") return evidence.migrationEvidence.includes("flyway") ? [] : ["missing Flyway migration"]
  if (intent.migrationStyle === "liquibase") return evidence.migrationEvidence.includes("liquibase") ? [] : ["missing Liquibase migration"]
  return evidence.migrationEvidence.length > 0 ? [] : ["missing schema/migration evidence"]
}

function jpaDatabaseStackAlignment(intent: ProfileIntent, evidence: GeneratedStackEvidence): StackAlignmentSummary {
  const hasUsableGradle = evidence.hasGradleWrapper || (!evidence.hasFakeGradleShim && canRunSystemGradle())
  const details = [
    ...(evidence.hasBuildGradle ? [] : ["missing build.gradle/build.gradle.kts"]),
    ...(evidence.hasSettingsGradle ? [] : ["missing settings.gradle/settings.gradle.kts"]),
    ...(evidence.hasMaven ? ["Maven pom.xml observed"] : []),
    ...(evidence.hasJavaSource ? [] : ["missing src/main/java Java source"]),
    ...(evidence.hasSpringBootBuild ? [] : ["missing Spring Boot plugin/dependency"]),
    ...(evidence.hasWebStarter ? [] : ["missing spring-boot-starter-web equivalent"]),
    ...(evidence.hasSpringBootApplication ? [] : ["missing @SpringBootApplication"]),
    ...(evidence.hasController ? [] : ["missing @RestController/@Controller"]),
    ...(hasUsableGradle ? [] : ["missing Gradle wrapper or executable Gradle"]),
    ...(evidence.hasFakeGradleShim ? ["fake Gradle shim observed"] : []),
    ...(evidence.hasJpaDependency ? [] : ["missing JPA dependency"]),
    ...(evidence.hasDbDependency ? [] : ["missing DB dependency"]),
    ...migrationDetail(intent, evidence),
  ]
  if (details.length === 0) {
    return pass("profile expects Java/Spring/Gradle/JPA/database and generated project has Spring Boot + Gradle + JPA/database evidence")
  }
  return warn(`STACK_MISMATCH: profile/generated stack mismatch; ${details.join("; ")}`, false)
}

function baselineJavaSpringGradleAlignment(projectDir: string, evidence: GeneratedStackEvidence): StackAlignmentSummary {
  const hasGradle = evidence.hasBuildGradle || evidence.hasSettingsGradle || evidence.hasGradleWrapper
  if (hasGradle && evidence.hasJavaSource) {
    return pass("profile expects Java/Spring/Gradle and generated project has Gradle + src/main/java")
  }
  const hasNodeMarkers = hasAny(projectDir, ["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"])
    || hasFileDeep(join(projectDir, "src"), (filePath) => /\.(?:js|cjs|mjs|ts|tsx)$/.test(filePath))
  if (!hasGradle && !evidence.hasJavaSource && !evidence.hasMaven && !hasNodeMarkers && !evidence.sourceFilesPresent) {
    return pass("not checked; no generated project stack markers observed")
  }
  const mismatchDetails = [
    ...(hasGradle ? [] : ["missing build.gradle/settings.gradle/gradlew"]),
    ...(evidence.hasJavaSource ? [] : ["missing src/main/java Java source"]),
    ...(evidence.hasMaven ? ["Maven pom.xml observed"] : []),
    ...(hasNodeMarkers ? ["Node/CommonJS markers observed"] : []),
  ]
  return warn(`STACK_MISMATCH: profile expects Java/Spring/Gradle; ${mismatchDetails.join("; ")}`, true)
}

export function readStackAlignment(projectDir: string, implementationStatus: string): StackAlignmentSummary {
  if (implementationStatus !== "filled") {
    return pass("not checked until implementation report is filled")
  }
  const intent = readProfileIntent(projectDir)
  const evidence = generatedStackEvidence(projectDir)
  if (intent !== undefined && expectsJpaDatabase(intent)) {
    return jpaDatabaseStackAlignment(intent, evidence)
  }
  return baselineJavaSpringGradleAlignment(projectDir, evidence)
}
