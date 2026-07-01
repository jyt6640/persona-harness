import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { isRecord, stripJsonComments } from "../config/jsonc.js"
import type { CliRunResult } from "./bearshell.js"

const OPENCODE_CONFIG_PATH = ".opencode/opencode.json"
const CODEGRAPH_MCP_ID = "codegraph"
const CONTEXT7_MCP_ID = "context7"
const GREP_APP_MCP_ID = "grep_app"

type JsonObject = Record<string, unknown>
type DeveloperMcpBundleResult = { readonly kind: "registered" } | { readonly kind: "failure"; readonly result: CliRunResult }

type DeveloperMcpBundleOptions = {
  readonly codeGraphEnabled?: boolean
  readonly packageRoot?: string
}

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
          stderr: `Persona Harness backend bootstrap failed during developer MCP bundle registration.\n\n${label} must contain a JSON object.\n`,
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
          stderr: `Persona Harness backend bootstrap failed during developer MCP bundle registration.\n\nFailed to parse ${label}: ${error.message}\n`,
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

function defaultPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
}

function codeGraphMcpCommand(packageRoot: string): readonly string[] {
  return ["node", join(packageRoot, "packages", "codegraph-mcp", "bin", "codegraph-mcp.mjs"), "mcp"]
}

export function enableDeveloperMcpBundle(projectDir: string, options: DeveloperMcpBundleOptions = {}): DeveloperMcpBundleResult {
  const opencodeConfigPath = join(projectDir, OPENCODE_CONFIG_PATH)
  const parsed = readJsonObject(opencodeConfigPath, OPENCODE_CONFIG_PATH)
  if (parsed.kind === "failure") {
    return { kind: "failure", result: parsed.result }
  }
  const existingMcp = isRecord(parsed.value.mcp) ? parsed.value.mcp : {}
  const packageRoot = resolve(options.packageRoot ?? defaultPackageRoot())
  const codeGraphEntry = options.codeGraphEnabled === false
    ? {}
    : {
        [CODEGRAPH_MCP_ID]: {
          type: "local",
          enabled: true,
          command: codeGraphMcpCommand(packageRoot),
        },
      }
  writeJsonObject(opencodeConfigPath, {
    ...parsed.value,
    mcp: {
      ...existingMcp,
      [GREP_APP_MCP_ID]: {
        type: "remote",
        url: "https://mcp.grep.app",
      },
      [CONTEXT7_MCP_ID]: {
        type: "remote",
        url: "https://mcp.context7.com/mcp",
      },
      ...codeGraphEntry,
    },
  })
  return { kind: "registered" }
}
