import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { CONTROLLER_REPOSITORY_CONVENTION } from "../config/convention-registry.js"
import { loadHarnessConfig } from "../config/harness-config.js"
import type { ConventionLevel } from "../config/harness-config.js"
import { observeControllerRepositoryDependency } from "../observer/controller-repository-observer.js"
import type { ControllerRepositoryEvidence } from "../observer/controller-repository-observer.js"
import { readProfileIntent } from "./stack-alignment-profile.js"

export type ArchitectureConventionFinding = "PASS" | "WARN"

export type ArchitectureConventionSummary = {
  readonly architectureConventions: string
  readonly architectureConventionsBlocking: boolean
  readonly architectureConventionsFinding: ArchitectureConventionFinding
}

const JAVA_MAIN_DIR = join("src", "main", "java")
const SERVICE_ARCHITECTURE_STYLES = [
  "simple-layered",
  "clean-architecture-light",
  "hexagonal-light",
  "strict-clean-architecture",
] as const

function serviceArchitectureApplies(projectDir: string): boolean {
  const intent = readProfileIntent(projectDir)
  return intent?.language === "java"
    && intent.framework === "spring"
    && SERVICE_ARCHITECTURE_STYLES.some((style) => style === intent.architectureStyle)
}

function collectControllerFiles(projectDir: string): readonly string[] {
  const rootDir = join(projectDir, JAVA_MAIN_DIR)
  const files: string[] = []

  function visit(dirPath: string): void {
    if (!existsSync(dirPath)) {
      return
    }
    for (const entry of readdirSync(dirPath)) {
      const entryPath = join(dirPath, entry)
      const stat = statSync(entryPath)
      if (stat.isDirectory()) {
        visit(entryPath)
        continue
      }
      if (stat.isFile() && entryPath.endsWith("Controller.java")) {
        files.push(entryPath)
      }
    }
  }

  visit(rootDir)
  return files.sort()
}

function className(filePath: string): string {
  return (filePath.replace(/\\/g, "/").split("/").at(-1) ?? filePath).replace(/\.java$/, "")
}

function repositoryName(evidence: ControllerRepositoryEvidence): string | undefined {
  const evidenceTexts = [...evidence.constructorParameters, ...evidence.fields, ...evidence.imports]
  for (const text of evidenceTexts) {
    const match = /\b(?<repository>[A-Za-z_$][\w$]*Repository[\w$]*)\b/u.exec(text)
    if (match?.groups?.repository !== undefined) {
      return match.groups.repository
    }
  }
  return undefined
}

function directDependencyFinding(projectDir: string, filePath: string): string | undefined {
  const source = readFileSync(filePath, "utf8")
  const observation = observeControllerRepositoryDependency({ filePath, source })
  if (observation.finding !== "WARN") {
    return undefined
  }

  const dependency = repositoryName(observation.evidence)
  if (dependency === undefined) {
    return undefined
  }
  return `${className(filePath)} directly depends on ${dependency}; ${CONTROLLER_REPOSITORY_CONVENTION.actionableMessage} Source: ${relative(projectDir, filePath)}`
}

function conventionLevel(projectDir: string): ConventionLevel {
  return loadHarnessConfig(projectDir).conventions[CONTROLLER_REPOSITORY_CONVENTION.id] ?? "report"
}

export function readArchitectureConventions(projectDir: string, implementationStatus: string): ArchitectureConventionSummary {
  if (implementationStatus !== "filled") {
    return {
      architectureConventions: "not checked until implementation report is filled",
      architectureConventionsBlocking: false,
      architectureConventionsFinding: "PASS",
    }
  }
  if (!serviceArchitectureApplies(projectDir)) {
    return {
      architectureConventions: "not checked; Java/Spring service-layer profile not active",
      architectureConventionsBlocking: false,
      architectureConventionsFinding: "PASS",
    }
  }

  const findings = collectControllerFiles(projectDir).flatMap((filePath) => {
    const finding = directDependencyFinding(projectDir, filePath)
    return finding === undefined ? [] : [finding]
  })
  if (findings.length === 0) {
    return {
      architectureConventions: "Controller -> Repository direct dependency not observed",
      architectureConventionsBlocking: false,
      architectureConventionsFinding: "PASS",
    }
  }
  const level = conventionLevel(projectDir)
  const findingText = `${CONTROLLER_REPOSITORY_CONVENTION.id} ${level}: ${findings.join("; ")}`
  return {
    architectureConventions: findingText,
    architectureConventionsBlocking: level === "block",
    architectureConventionsFinding: level === "report" ? "PASS" : "WARN",
  }
}
