import { existsSync, readFileSync } from "node:fs"
import process from "node:process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { isRecord } from "../config/jsonc.js"
import { walkBoundedFiles } from "../io/bounded-path-walker.js"
import {
  detectCommandVersion,
} from "./doctor-command-detection.js"
import {
  readDoctorRegistry,
  type DoctorRegistryResponse,
  type DoctorRegistrySummary,
} from "./doctor-registry.js"
import { readDoctorRegistryFromNpm } from "./doctor-registry-readback.js"
import type {
  DoctorExternalTrustSummary,
  DoctorOptions,
  StaleFixtureFinding,
} from "./doctor-types.js"
import type { FinishAttestationAssessment } from "./workflow-finish-attestation.js"

const STALE_FIXTURE_TOKENS = [
  "step1-api-contract",
  "step2-3-api-contract",
] as const

export function commandVersion(command: string, args: readonly string[], options: DoctorOptions): string {
  return detectCommandVersion(command, args, {
    env: options.env ?? process.env,
    finder: options.commandFinder,
    platform: options.platform,
    runner: options.commandRunner,
  })
}

export function opencodeVersion(options: DoctorOptions): string {
  const env = options.env ?? process.env
  return env.PH_DOCTOR_OPENCODE_VERSION ?? commandVersion("opencode", ["--version"], options)
}

export function pathStatus(absolutePath: string): "present" | "missing" {
  return existsSync(absolutePath) ? "present" : "missing"
}

export function platformFindings(platform: NodeJS.Platform): readonly string[] {
  return platform === "win32"
    ? [
        "Unverified platform: Windows has not been measured or verified for Persona Harness.",
        "Lock identity device/inode behavior is not measured or verified on Windows; stale-lock and concurrency conclusions are limited.",
      ]
    : []
}

export function packageVersion(): string {
  const packagePath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json")
  try {
    const parsed: unknown = JSON.parse(readFileSync(packagePath, "utf8"))
    return isRecord(parsed) && typeof parsed.version === "string" ? parsed.version : "unknown"
  } catch {
    return process.env.npm_package_version ?? "unknown"
  }
}

export function registrySummary(installedVersion: string, options: DoctorOptions): DoctorRegistrySummary {
  const env = options.env ?? process.env
  const distTagOverride = env.PH_DOCTOR_REGISTRY_DIST_TAGS
  const forcedStatus = forcedRegistryStatus(env.PH_DOCTOR_REGISTRY_FAILURE)
  const readback = forcedStatus === undefined && distTagOverride === undefined
    ? readDoctorRegistryFromNpm(installedVersion, options.registryReader)
    : {
        deprecation: forcedStatus ?? registryResponseFromOverride(env.PH_DOCTOR_REGISTRY_DEPRECATED),
        distTags: forcedStatus ?? registryResponseFromOverride(distTagOverride),
      }
  return readDoctorRegistry({
    deprecation: readback.deprecation,
    distTags: readback.distTags,
    installedVersion,
  })
}

export function summarizeDoctorExternalTrust(
  assessment: FinishAttestationAssessment,
): DoctorExternalTrustSummary {
  switch (assessment.state) {
    case "trusted":
      return {
        availability: "trusted",
        consumption: assessment.consumptionState,
        state: assessment.state,
      }
    case "missing":
      return {
        availability: "missing",
        consumption: assessment.consumptionState,
        state: assessment.state,
      }
    case "binding-mismatch":
    case "crypto-failed":
    case "malformed":
    case "replayed":
    case "runtime-unsupported":
    case "source-drift":
    case "stale":
    case "wrong-policy":
      return {
        availability: "untrusted",
        consumption: assessment.consumptionState,
        state: assessment.state,
      }
    default:
      return assertNever(assessment.state)
  }
}

export function runtimeBlockedExternalTrust(): DoctorExternalTrustSummary {
  return {
    availability: "untrusted",
    consumption: "not-applicable",
    state: "runtime-unsupported",
  }
}

export function scanStaleFixtureRules(projectDir: string, rulesDir: string, displayRoot: string): {
  readonly pathSafetyDiagnostics: readonly string[]
  readonly rulesFileCount: number
  readonly staleFixtureFindings: readonly StaleFixtureFinding[]
} {
  const walked = walkBoundedFiles(rulesDir, projectDir, {
    displayRoot,
    extensions: [".md"],
    includeText: true,
  })
  const findings = walked.files.flatMap((file): readonly StaleFixtureFinding[] => {
    const relativePath = file.absolutePath === rulesDir
      ? ""
      : file.absolutePath.slice(rulesDir.length + 1).replace(/\\/g, "/")
    const haystack = `${relativePath}\n${file.text ?? ""}`
    const matches = STALE_FIXTURE_TOKENS.filter((token) => haystack.includes(token))
    return matches.length > 0 ? [{ relativePath, matches }] : []
  })
  return {
    pathSafetyDiagnostics: walked.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`),
    rulesFileCount: walked.files.length,
    staleFixtureFindings: findings,
  }
}

function forcedRegistryStatus(value: string | undefined): DoctorRegistryResponse | undefined {
  switch (value) {
    case "malformed":
    case "timeout":
    case "unavailable":
      return { status: value }
    case undefined:
      return undefined
    default:
      return undefined
  }
}

function registryResponseFromOverride(value: string | undefined): DoctorRegistryResponse {
  switch (value) {
    case "malformed":
    case "timeout":
    case "unavailable":
      return { status: value }
    case undefined:
      return { status: "unavailable" }
    default:
      return { status: "available", text: value }
  }
}

function assertNever(value: never): never {
  throw new TypeError(`Unknown doctor external trust state: ${String(value)}`)
}
