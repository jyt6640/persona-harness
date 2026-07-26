import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { isRecord, stripJsonComments } from "../config/jsonc.js"
import type { BootstrapWriteBoundary } from "../io/bootstrap-write-boundary.js"
import type { CliRunResult } from "./bearshell.js"

const HARNESS_CONFIG_PATH = ".persona/harness.jsonc"

function readHarnessConfigObject(
  projectDir: string,
  step: string,
  bootstrapWriteBoundary?: BootstrapWriteBoundary,
): Record<string, unknown> | CliRunResult {
  const harnessConfigPath = join(projectDir, HARNESS_CONFIG_PATH)
  let parsed: unknown = {}
  try {
    const text = bootstrapWriteBoundary?.readProjectFile(HARNESS_CONFIG_PATH)?.toString("utf8")
    parsed = bootstrapWriteBoundary !== undefined
      ? (text === undefined ? {} : JSON.parse(stripJsonComments(text)))
      : (existsSync(harnessConfigPath) ? JSON.parse(stripJsonComments(readFileSync(harnessConfigPath, "utf8"))) : {})
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

function writeHarnessConfigObject(
  projectDir: string,
  config: Record<string, unknown>,
  bootstrapWriteBoundary?: BootstrapWriteBoundary,
): void {
  const text = `${JSON.stringify(config, null, 2)}\n`
  if (bootstrapWriteBoundary !== undefined) {
    bootstrapWriteBoundary.writeProjectFileAtomically(HARNESS_CONFIG_PATH, text)
    return
  }
  writeFileSync(join(projectDir, HARNESS_CONFIG_PATH), text, "utf8")
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

export function enableRuntimeInjectionPreview(
  projectDir: string,
  bootstrapWriteBoundary?: BootstrapWriteBoundary,
): CliRunResult | undefined {
  const parsed = readHarnessConfigObject(projectDir, "runtime injection preview config", bootstrapWriteBoundary)
  if (isCliRunResult(parsed)) {
    return parsed
  }
  writeHarnessConfigObject(projectDir, withRuntimeInjection(parsed), bootstrapWriteBoundary)
  return undefined
}

export function enableStrictClosureVerification(
  projectDir: string,
  bootstrapWriteBoundary?: BootstrapWriteBoundary,
): CliRunResult | undefined {
  const parsed = readHarnessConfigObject(projectDir, "strict verification config", bootstrapWriteBoundary)
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
  writeHarnessConfigObject(projectDir, nextConfig, bootstrapWriteBoundary)
  return undefined
}
