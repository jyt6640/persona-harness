import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { isRecord, stripJsonComments } from "./jsonc.js"

const POLICY_OVERLAY_PATH = ".persona/policies/overlay.jsonc"
const SUPPORTED_SCHEMA = "persona.policy-overlay.v1"
const SUPPORTED_ROLE = "backend"
const SUPPORTED_MVP = "java-spring-clean-code"
const DEFAULT_MAX_BULLETS_PER_SOURCE = 5

type PolicySourceName = "company" | "personal"

type PolicyOverlaySource = {
  readonly name: PolicySourceName
  readonly heading: string
  readonly path: string
  readonly bullets: readonly string[]
}

export type SelectedPolicyOverlay = {
  readonly enabled: boolean
  readonly sources: readonly PolicySourceName[]
  readonly diagnostics: readonly string[]
}

export type BackendPolicyOverlay = {
  readonly summaryLines: readonly string[]
  readonly metadata: SelectedPolicyOverlay
}

function inactiveOverlay(diagnostics: readonly string[] = []): BackendPolicyOverlay {
  return {
    summaryLines: [],
    metadata: {
      enabled: false,
      sources: [],
      diagnostics,
    },
  }
}

function maxBulletsPerSource(value: unknown): number {
  if (!isRecord(value) || !isRecord(value.limits)) {
    return DEFAULT_MAX_BULLETS_PER_SOURCE
  }
  const maxBullets = value.limits.maxBulletsPerSource
  return typeof maxBullets === "number" && Number.isInteger(maxBullets) && maxBullets > 0
    ? maxBullets
    : DEFAULT_MAX_BULLETS_PER_SOURCE
}

function isSupportedOverlay(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || value.schema !== SUPPORTED_SCHEMA || !isRecord(value.scope)) {
    return false
  }
  return value.scope.role === SUPPORTED_ROLE && value.scope.mvp === SUPPORTED_MVP && value.scope.productized === false
}

function readSourcePath(value: unknown, sourceName: PolicySourceName): string | undefined {
  if (!isRecord(value) || !isRecord(value.sources)) {
    return undefined
  }
  const sourcePath = value.sources[sourceName]
  return typeof sourcePath === "string" && sourcePath.trim().length > 0 ? sourcePath.trim() : undefined
}

function extractBullets(markdown: string, maxBullets: number): readonly string[] {
  const bullets: string[] = []
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\s*-\s+(.+?)\s*$/)
    const bullet = match?.[1]?.trim()
    if (bullet === undefined || bullet.length === 0) {
      continue
    }
    bullets.push(`- ${bullet}`)
    if (bullets.length >= maxBullets) {
      break
    }
  }
  return bullets
}

function readPolicySource(
  projectDir: string,
  overlay: Record<string, unknown>,
  name: PolicySourceName,
  heading: string,
  maxBullets: number,
): { readonly source?: PolicyOverlaySource; readonly diagnostics: readonly string[] } {
  const sourcePath = readSourcePath(overlay, name)
  if (sourcePath === undefined) {
    return { diagnostics: [`missing ${name} policy source`] }
  }

  const absolutePath = join(projectDir, sourcePath)
  if (!existsSync(absolutePath)) {
    return { diagnostics: [`missing ${name} policy file: ${sourcePath}`] }
  }

  const bullets = extractBullets(readFileSync(absolutePath, "utf8"), maxBullets)
  return bullets.length > 0
    ? { source: { name, heading, path: sourcePath, bullets }, diagnostics: [] }
    : { diagnostics: [`empty ${name} policy file: ${sourcePath}`] }
}

function formatSummary(sources: readonly PolicyOverlaySource[]): readonly string[] {
  return [
    "정책/철학 오버레이:",
    "우선순위: company > personal > Clean Code baseline",
    "",
    ...sources.flatMap((source) => [source.heading, ...source.bullets, ""]),
    "오버레이 사용 원칙:",
    "- README, 현재 사용자 지시, accepted plan의 기능 요구사항이 우선한다.",
    "- company policy는 personal philosophy보다 우선한다.",
    "- 이 오버레이는 rule enforcement나 product-quality 보증이 아니다.",
  ]
}

export function loadBackendPolicyOverlay(projectDir: string): BackendPolicyOverlay {
  const overlayPath = join(projectDir, POLICY_OVERLAY_PATH)
  if (!existsSync(overlayPath)) {
    return inactiveOverlay()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonComments(readFileSync(overlayPath, "utf8")))
  } catch (error) {
    if (error instanceof SyntaxError) {
      return inactiveOverlay(["malformed overlay.jsonc"])
    }
    throw error
  }

  if (!isRecord(parsed)) {
    return inactiveOverlay(["overlay.jsonc must contain an object"])
  }

  if (parsed.enabled === false) {
    return inactiveOverlay()
  }

  if (!isSupportedOverlay(parsed)) {
    return inactiveOverlay(["unsupported policy overlay scope"])
  }

  const maxBullets = maxBulletsPerSource(parsed)
  const company = readPolicySource(projectDir, parsed, "company", "Company policy:", maxBullets)
  const personal = readPolicySource(projectDir, parsed, "personal", "Personal philosophy:", maxBullets)
  const sources = [company.source, personal.source].filter((source): source is PolicyOverlaySource => source !== undefined)
  const diagnostics = [...company.diagnostics, ...personal.diagnostics]

  return sources.length > 0
    ? {
        summaryLines: formatSummary(sources),
        metadata: {
          enabled: true,
          sources: sources.map((source) => source.name),
          diagnostics,
        },
      }
    : inactiveOverlay(diagnostics)
}
