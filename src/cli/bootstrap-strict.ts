import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { isRecord, stripJsonComments } from "../config/jsonc.js"
import type { CliRunResult } from "./bearshell.js"

const HARNESS_CONFIG_PATH = ".persona/harness.jsonc"

function readHarnessConfigObject(projectDir: string, step: string): Record<string, unknown> | CliRunResult {
  const harnessConfigPath = join(projectDir, HARNESS_CONFIG_PATH)
  let parsed: unknown = {}
  try {
    parsed = existsSync(harnessConfigPath) ? JSON.parse(stripJsonComments(readFileSync(harnessConfigPath, "utf8"))) : {}
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        status: 1,
        stdout: "",
        stderr: `Persona Harness backend bootstrap failed during ${step}.\n\nFailed to parse ${HARNESS_CONFIG_PATH}: ${error.message}\n`,
      }
    }
    throw error
  }
  if (!isRecord(parsed)) {
    return {
      status: 1,
      stdout: "",
      stderr: `Persona Harness backend bootstrap failed during ${step}.\n\n${HARNESS_CONFIG_PATH} must contain a JSON object.\n`,
    }
  }
  return parsed
}

function writeHarnessConfigObject(projectDir: string, config: Record<string, unknown>): void {
  writeFileSync(join(projectDir, HARNESS_CONFIG_PATH), `${JSON.stringify(config, null, 2)}\n`, "utf8")
}

function isCliRunResult(value: Record<string, unknown> | CliRunResult): value is CliRunResult {
  return typeof value.status === "number" && typeof value.stdout === "string" && typeof value.stderr === "string"
}

function withRuntimeInjection(config: Record<string, unknown>): Record<string, unknown> {
  const features = isRecord(config.features) ? config.features : {}
  return {
    ...config,
    features: {
      ...features,
      runtimeInjection: true,
    },
  }
}

export function enableRuntimeInjectionPreview(projectDir: string): CliRunResult | undefined {
  const parsed = readHarnessConfigObject(projectDir, "runtime injection preview config")
  if (isCliRunResult(parsed)) {
    return parsed
  }
  writeHarnessConfigObject(projectDir, withRuntimeInjection(parsed))
  return undefined
}

export function enableStrictClosureVerification(projectDir: string): CliRunResult | undefined {
  const parsed = readHarnessConfigObject(projectDir, "strict verification config")
  if (isCliRunResult(parsed)) {
    return parsed
  }
  const enforce = isRecord(parsed.enforce) ? parsed.enforce : {}
  const nextConfig = {
    ...parsed,
    enforce: {
      ...enforce,
      executeVerification: true,
    },
  }
  writeHarnessConfigObject(projectDir, nextConfig)
  return undefined
}
