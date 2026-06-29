import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { isRecord, stripJsonComments } from "../config/jsonc.js"
import type { CliRunResult } from "./bearshell.js"

const HARNESS_CONFIG_PATH = ".persona/harness.jsonc"

export function enableStrictClosureVerification(projectDir: string): CliRunResult | undefined {
  const harnessConfigPath = join(projectDir, HARNESS_CONFIG_PATH)
  let parsed: unknown = {}
  try {
    parsed = existsSync(harnessConfigPath) ? JSON.parse(stripJsonComments(readFileSync(harnessConfigPath, "utf8"))) : {}
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        status: 1,
        stdout: "",
        stderr: `Persona Harness backend bootstrap failed during strict verification config.\n\nFailed to parse ${HARNESS_CONFIG_PATH}: ${error.message}\n`,
      }
    }
    throw error
  }
  if (!isRecord(parsed)) {
    return {
      status: 1,
      stdout: "",
      stderr: `Persona Harness backend bootstrap failed during strict verification config.\n\n${HARNESS_CONFIG_PATH} must contain a JSON object.\n`,
    }
  }
  const enforce = isRecord(parsed.enforce) ? parsed.enforce : {}
  const nextConfig = {
    ...parsed,
    enforce: {
      ...enforce,
      executeVerification: true,
    },
  }
  writeFileSync(harnessConfigPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8")
  return undefined
}
