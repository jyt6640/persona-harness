import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { isRecord, stripJsonComments } from "../config/jsonc.js"
import type { CliRunResult } from "./bearshell.js"

const OPENCODE_CONFIG_PATH = ".opencode/opencode.json"
const LSP_MCP_ID = "persona-harness-lsp"

type JsonObject = Record<string, unknown>
type ReadConfigResult =
  | { readonly kind: "config"; readonly value: JsonObject }
  | { readonly kind: "failure"; readonly result: CliRunResult }

function defaultPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
}

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
          stderr: `Persona Harness backend bootstrap failed during LSP MCP preview.\n\n${label} must contain a JSON object.\n`,
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
          stderr: `Persona Harness backend bootstrap failed during LSP MCP preview.\n\nFailed to parse ${label}: ${error.message}\n`,
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

function lspMcpCommand(packageRoot: string): readonly string[] {
  return ["node", join(packageRoot, "packages", "lsp-mcp", "bin", "lsp-mcp.mjs"), "mcp"]
}

export function enableLspMcpPreview(projectDir: string, packageRoot?: string): CliRunResult | undefined {
  const opencodeConfigPath = join(projectDir, OPENCODE_CONFIG_PATH)
  const parsed = readJsonObject(opencodeConfigPath, OPENCODE_CONFIG_PATH)
  if (parsed.kind === "failure") {
    return parsed.result
  }
  const existingMcp = isRecord(parsed.value.mcp) ? parsed.value.mcp : {}
  writeJsonObject(opencodeConfigPath, {
    ...parsed.value,
    mcp: {
      ...existingMcp,
      [LSP_MCP_ID]: {
        type: "local",
        enabled: true,
        command: lspMcpCommand(resolve(packageRoot ?? defaultPackageRoot())),
      },
    },
  })
  return undefined
}
