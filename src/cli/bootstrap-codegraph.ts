import { accessSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { delimiter, dirname, join } from "node:path"
import process from "node:process"

import { isRecord, stripJsonComments } from "../config/jsonc.js"
import type { CliRunResult } from "./bearshell.js"

const OPENCODE_CONFIG_PATH = ".opencode/opencode.json"
const CODEGRAPH_MCP_ID = "codegraph"

type JsonObject = Record<string, unknown>
type CodeGraphPreviewResult =
  | { readonly kind: "missing-binary" }
  | { readonly kind: "registered" }
  | { readonly kind: "failure"; readonly result: CliRunResult }

type ReadConfigResult =
  | { readonly kind: "config"; readonly value: JsonObject }
  | { readonly kind: "failure"; readonly result: CliRunResult }

function readJsonObject(path: string, label: string): ReadConfigResult {
  if (!existsSync(path)) {
    return { kind: "config", value: {} }
  }
  try {
    const parsed: unknown = JSON.parse(stripJsonComments(readFileSync(path, "utf8")))
    if (!isRecord(parsed)) {
      return {
        kind: "failure",
        result: {
          status: 1,
          stdout: "",
          stderr: `Persona Harness backend bootstrap failed during external CodeGraph preview.\n\n${label} must contain a JSON object.\n`,
        },
      }
    }
    return { kind: "config", value: parsed }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        kind: "failure",
        result: {
          status: 1,
          stdout: "",
          stderr: `Persona Harness backend bootstrap failed during external CodeGraph preview.\n\nFailed to parse ${label}: ${error.message}\n`,
        },
      }
    }
    throw error
  }
}

function writeJsonObject(path: string, value: JsonObject): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function candidateNames(): readonly string[] {
  return process.platform === "win32" ? ["codegraph.cmd", "codegraph.exe", "codegraph"] : ["codegraph"]
}

function hasExecutableCodeGraph(env: Readonly<Record<string, string | undefined>>): boolean {
  const pathValue = env.PATH ?? process.env.PATH ?? ""
  for (const directory of pathValue.split(delimiter)) {
    if (directory.length === 0) {
      continue
    }
    for (const candidate of candidateNames()) {
      try {
        accessSync(join(directory, candidate), constants.X_OK)
        return true
      } catch {
        continue
      }
    }
  }
  return false
}

export function enableExternalCodeGraphPreview(
  projectDir: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): CodeGraphPreviewResult {
  if (!hasExecutableCodeGraph(env)) {
    return { kind: "missing-binary" }
  }

  const opencodeConfigPath = join(projectDir, OPENCODE_CONFIG_PATH)
  const parsed = readJsonObject(opencodeConfigPath, OPENCODE_CONFIG_PATH)
  if (parsed.kind === "failure") {
    return { kind: "failure", result: parsed.result }
  }
  const existingMcp = isRecord(parsed.value.mcp) ? parsed.value.mcp : {}
  writeJsonObject(opencodeConfigPath, {
    ...parsed.value,
    mcp: {
      ...existingMcp,
      [CODEGRAPH_MCP_ID]: {
        type: "local",
        enabled: true,
        command: ["codegraph", "serve", "--mcp"],
      },
    },
  })
  return { kind: "registered" }
}
