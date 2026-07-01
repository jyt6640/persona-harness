import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { isRecord, stripJsonComments } from "../config/jsonc.js"
import {
  firstExisting,
  inferredRule,
  INSTRUCTION_INFERENCE_LIMITATIONS,
  INSTRUCTIONS_OUTPUT_DIR,
  lineFor,
  listFiles,
  readText,
  sourceRef,
  type InferredRule,
  type InstructionConflict,
  type InstructionInferenceResult,
  type ProfileObservation,
} from "./instructions-model.js"

export function inferBackendInstructions(projectDir: string): InstructionInferenceResult {
  const profile = readProfile(projectDir)
  const rules = [
    ...profileRules(profile),
    ...buildRules(projectDir, profile),
    ...sourceShapeRules(projectDir),
    ...testNamingRules(projectDir),
    ...dtoRules(projectDir),
  ]
  const conflicts = instructionConflicts(projectDir, profile)
  const outputDir = join(projectDir, INSTRUCTIONS_OUTPUT_DIR)
  const inferred = {
    conflictsPath: join(outputDir, "conflicts.json"),
    generatedAt: new Date().toISOString(),
    limitations: INSTRUCTION_INFERENCE_LIMITATIONS,
    projectDir,
    rules,
    schemaVersion: "instructions-inferred.1",
  } satisfies InstructionInferenceResult["inferred"]
  const conflictReport = {
    conflicts,
    limitations: INSTRUCTION_INFERENCE_LIMITATIONS,
    schemaVersion: "instructions-conflicts.1",
  } satisfies InstructionInferenceResult["conflicts"]
  mkdirSync(outputDir, { recursive: true })
  writeFileSync(join(outputDir, "inferred.json"), `${JSON.stringify(inferred, null, 2)}\n`)
  writeFileSync(join(outputDir, "conflicts.json"), `${JSON.stringify(conflictReport, null, 2)}\n`)
  return { conflicts: conflictReport, inferred }
}

function profileRules(profile: ProfileObservation): readonly InferredRule[] {
  const sourceRefs = profile.sourceRef === null ? [] : [profile.sourceRef]
  return [
    profile.packageStyle === null
      ? []
      : [
          inferredRule(
            "profile.package-style",
            "architecture",
            "high",
            "project-profile",
            "advisory",
            `Project profile selects package style '${profile.packageStyle}'.`,
            sourceRefs,
          ),
        ],
    profile.architectureStyle === null
      ? []
      : [
          inferredRule(
            "profile.architecture-style",
            "architecture",
            "high",
            "project-profile",
            "advisory",
            `Project profile selects architecture style '${profile.architectureStyle}'.`,
            sourceRefs,
          ),
        ],
  ].flat()
}

function buildRules(projectDir: string, profile: ProfileObservation): readonly InferredRule[] {
  const gradlePath = firstExisting(projectDir, ["build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"])
  if (gradlePath === null) {
    return []
  }
  return [
    inferredRule(
      "build.gradle-shape",
      "build",
      profile.buildTool === "gradle" ? "high" : "medium",
      "code",
      "advisory",
      "Gradle build shape observed in repository files.",
      [sourceRef(projectDir, gradlePath, 1, "Gradle build file exists")],
    ),
  ]
}

function sourceShapeRules(projectDir: string): readonly InferredRule[] {
  const javaFiles = listFiles(join(projectDir, "src", "main", "java"), ".java")
  const hasController = javaFiles.some((filePath) => filePath.endsWith("Controller.java"))
  const hasService = javaFiles.some((filePath) => filePath.endsWith("Service.java"))
  const hasRepository = javaFiles.some((filePath) => filePath.endsWith("Repository.java"))
  if (!hasController || !hasService || !hasRepository) {
    return []
  }
  const sourceRefs = javaFiles
    .filter((filePath) => /(?:Controller|Service|Repository)\.java$/u.test(filePath))
    .slice(0, 6)
    .map((filePath) => sourceRef(projectDir, filePath, 1, "Layer role filename observed"))
  return [
    inferredRule(
      "architecture.controller-service-repository",
      "architecture",
      "high",
      "code",
      "candidate-blocker",
      "Controller/Service/Repository role files are present; preserve the boundary before adopting blockers.",
      sourceRefs,
    ),
  ]
}

function testNamingRules(projectDir: string): readonly InferredRule[] {
  const tests = listFiles(join(projectDir, "src", "test", "java"), ".java").filter((filePath) => /(?:Test|Tests)\.java$/u.test(filePath))
  if (tests.length === 0) {
    return []
  }
  return [
    inferredRule(
      "testing.java-test-suffix",
      "testing",
      "medium",
      "code",
      "advisory",
      "Java test files use Test/Tests suffix naming.",
      tests.slice(0, 5).map((filePath) => sourceRef(projectDir, filePath, 1, "Test filename suffix observed")),
    ),
  ]
}

function dtoRules(projectDir: string): readonly InferredRule[] {
  const javaFiles = listFiles(join(projectDir, "src", "main", "java"), ".java")
  const dtoFile = javaFiles.find((filePath) => /(?:Dto|Request|Response)\.java$/u.test(filePath))
  const domainFile = javaFiles.find((filePath) => /(?:domain|entity)/u.test(filePath))
  if (dtoFile === undefined || domainFile === undefined) {
    return []
  }
  return [
    inferredRule(
      "architecture.dto-domain-separation",
      "architecture",
      "medium",
      "code",
      "advisory",
      "DTO-like request/response files and domain/entity files are separated.",
      [sourceRef(projectDir, dtoFile, 1, "DTO-like file observed"), sourceRef(projectDir, domainFile, 1, "Domain/entity file observed")],
    ),
  ]
}

function instructionConflicts(projectDir: string, profile: ProfileObservation): readonly InstructionConflict[] {
  const readmePath = join(projectDir, "README.md")
  if (!existsSync(readmePath)) {
    return []
  }
  const readme = readText(readmePath)
  const mentionsMaven = /\bmaven\b|pom\.xml/u.test(readme.toLowerCase())
  if (profile.buildTool !== "gradle" || !mentionsMaven) {
    return []
  }
  return [
    {
      id: "conflict.docs-buildtool-maven-vs-profile-gradle",
      sourceRefs: [sourceRef(projectDir, readmePath, lineFor(readme, /\bmaven\b|pom\.xml/iu), "README mentions Maven while project profile selects Gradle")],
      summary: "README build-tool wording conflicts with the Gradle project profile; inference reports this but does not auto-fix it.",
    },
  ]
}

function readProfile(projectDir: string): ProfileObservation {
  const profilePath = join(projectDir, ".persona", "project-profile.jsonc")
  if (!existsSync(profilePath)) {
    return { architectureStyle: null, buildTool: null, packageStyle: null, sourceRef: null }
  }
  const text = readText(profilePath)
  const parsed: unknown = JSON.parse(stripJsonComments(text))
  const defaults = isRecord(parsed) && isRecord(parsed.defaults) ? parsed.defaults : {}
  const answers = profileAnswers(parsed)
  return {
    architectureStyle: answers["architecture-style"] ?? null,
    buildTool: typeof defaults.buildTool === "string" ? defaults.buildTool : null,
    packageStyle: answers["package-style"] ?? null,
    sourceRef: sourceRef(projectDir, profilePath, 1, "Project profile parsed"),
  }
}

function profileAnswers(parsed: unknown): Readonly<Record<string, string>> {
  if (!isRecord(parsed) || !Array.isArray(parsed.questions)) {
    return {}
  }
  const answers: Record<string, string> = {}
  for (const question of parsed.questions) {
    if (isRecord(question) && typeof question.id === "string" && typeof question.answer === "string") {
      answers[question.id] = question.answer
    }
  }
  return answers
}
