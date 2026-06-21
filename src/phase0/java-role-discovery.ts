import { isJavaTargetFile } from "./file-role.js"
import { createInjectionBlock } from "./injection.js"
import { isInstalledPersonaHarnessPackageFile } from "./target-file.js"
import type { PendingInjection } from "./types.js"

const JAVA_PATH_PATTERN = /(?:[A-Za-z]:)?(?:\/|\.{1,2}\/)?[^\s"'`<>|]*src\/(?:main|test)\/java\/[^\s"'`<>|]+?\.java\b/g
const DISCOVERY_TOOL_NAMES = new Set(["glob", "ls", "list", "find"])

export function isJavaRoleDiscoveryTool(toolName: string): boolean {
  const normalizedToolName = toolName.toLowerCase()
  return DISCOVERY_TOOL_NAMES.has(normalizedToolName) || normalizedToolName.includes("glob")
}

export function extractJavaTargetFilesFromText(source: string): readonly string[] {
  const matches: string[] = []
  for (const match of source.matchAll(JAVA_PATH_PATTERN)) {
    const targetFile = match[0]?.replace(/[),.;:\]]+$/g, "")
    if (targetFile && isJavaTargetFile(targetFile) && !isInstalledPersonaHarnessPackageFile(targetFile)) {
      matches.push(targetFile)
    }
  }
  return [...new Set(matches)]
}

export function discoverJavaRoleInjections(
  toolName: string,
  toolOutput: string,
  projectDir: string,
): readonly PendingInjection[] {
  if (!isJavaRoleDiscoveryTool(toolName)) {
    return []
  }

  return extractJavaTargetFilesFromText(toolOutput).map((targetFile) => createInjectionBlock(targetFile, projectDir))
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function uniqueRuleMetadata(
  injections: readonly PendingInjection[],
): PendingInjection["selectedRuleMetadata"] {
  const metadataByKey = new Map<string, PendingInjection["selectedRuleMetadata"][number]>()
  for (const injection of injections) {
    for (const metadata of injection.selectedRuleMetadata) {
      metadataByKey.set(`${metadata.path}:${metadata.id}`, metadata)
    }
  }
  return [...metadataByKey.values()]
}

function uniqueSharedSkills(injections: readonly PendingInjection[]): PendingInjection["selectedSharedSkills"] {
  const skillsByKey = new Map<string, PendingInjection["selectedSharedSkills"][number]>()
  for (const injection of injections) {
    for (const skill of injection.selectedSharedSkills) {
      skillsByKey.set(`${skill.domain}:${skill.name}:${skill.path}`, skill)
    }
  }
  return [...skillsByKey.values()]
}

export function formatJavaRoleDiscoveryBlock(injections: readonly PendingInjection[]): string {
  const roleLines = injections.map((injection) => `- ${injection.fileRole}: ${injection.targetFile}`)
  return [
    "[Persona Harness Java Role Discovery]",
    "",
    "발견된 Java 역할 파일:",
    ...roleLines,
    "",
    "다음 단계:",
    "- Controller, Service, Repository, Request DTO, Response DTO 역할 파일을 read 도구로 최소 1개씩 열어 역할별 rule injection을 실제 model input에 태운다.",
  ].join("\n")
}

export function createJavaRoleReadFollowUp(injections: readonly PendingInjection[]): PendingInjection | undefined {
  if (injections.length === 0) {
    return undefined
  }

  const readLines = injections.map((injection) => `- read ${injection.targetFile} (${injection.fileRole})`)
  return {
    targetFile: "<java-role-read-follow-up>",
    fileRole: "java-common",
    selectedRules: uniqueValues(injections.flatMap((injection) => injection.selectedRules)),
    selectedRuleMetadata: uniqueRuleMetadata(injections),
    selectedSharedSkills: uniqueSharedSkills(injections),
    selectedPolicyOverlay: {
      enabled: false,
      sources: [],
      diagnostics: [],
    },
    policies: [
      "Discovered Java role files must be read so role-specific rule injection reaches model input before further edits.",
    ],
    block: [
      "[Persona Harness Injection]",
      "",
      "[Persona Harness Java Role Read Follow-up]",
      "",
      "발견된 Java 역할 파일을 다음 수정 전에 read 도구로 연다.",
      "이 단계는 Controller/Service/Repository/Request DTO/Response DTO 등 역할별 rule injection을 실제 model input에 태운다.",
      "",
      ...readLines,
    ].join("\n"),
  }
}
