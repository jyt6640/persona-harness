import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { isRecord, stripJsonComments } from "../config/jsonc.js"
import type { BootstrapWriteBoundary } from "../io/bootstrap-write-boundary.js"
import type { CliRunResult } from "./bearshell.js"

const OPENCODE_CONFIG_PATH = ".opencode/opencode.json"
const CODE_NAV_MCP_ID = "persona-harness-code-nav"

type JsonObject = Record<string, unknown>
type ReadConfigResult =
  | { readonly kind: "config"; readonly value: JsonObject }
  | { readonly kind: "failure"; readonly result: CliRunResult }

function defaultPackageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
}

function readJsonObject(
  projectDir: string,
  relativePath: string,
  label: string,
  bootstrapWriteBoundary?: BootstrapWriteBoundary,
): ReadConfigResult {
  const bytes = bootstrapWriteBoundary?.readProjectFile(relativePath)
  const path = join(projectDir, relativePath)
  if (bootstrapWriteBoundary === undefined && !existsSync(path)) {
    return { kind: "config", value: {} }
  }
  if (bootstrapWriteBoundary !== undefined && bytes === undefined) return { kind: "config", value: {} }
  try {
    const parsed: unknown = JSON.parse(stripJsonComments(bytes?.toString("utf8") ?? readFileSync(path, "utf8")))
    if (!isRecord(parsed)) {
      return {
        kind: "failure",
        result: {
          status: 1,
          stdout: "",
          stderr: `Persona Harness backend bootstrap failed during code-nav MCP preview.\n\n${label} must contain a JSON object.\n`,
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
          stderr: `Persona Harness backend bootstrap failed during code-nav MCP preview.\n\nFailed to parse ${label}: ${error.message}\n`,
        },
      }
    }
    throw error
  }
}

function writeJsonObject(
  projectDir: string,
  relativePath: string,
  value: JsonObject,
  bootstrapWriteBoundary?: BootstrapWriteBoundary,
): void {
  const text = `${JSON.stringify(value, null, 2)}\n`
  if (bootstrapWriteBoundary !== undefined) {
    bootstrapWriteBoundary.writeProjectFileAtomically(relativePath, text)
    return
  }
  const path = join(projectDir, relativePath)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text, "utf8")
}

function codeNavMcpCommand(packageRoot: string): readonly string[] {
  return ["node", join(packageRoot, "packages", "lsp-tools-mcp", "bin", "code-nav-mcp.mjs"), "mcp"]
}

export function enableCodeNavMcpPreview(
  projectDir: string,
  packageRoot?: string,
  bootstrapWriteBoundary?: BootstrapWriteBoundary,
): CliRunResult | undefined {
  const parsed = readJsonObject(projectDir, OPENCODE_CONFIG_PATH, OPENCODE_CONFIG_PATH, bootstrapWriteBoundary)
  if (parsed.kind === "failure") {
    return parsed.result
  }
  const existingMcp = isRecord(parsed.value.mcp) ? parsed.value.mcp : {}
  writeJsonObject(projectDir, OPENCODE_CONFIG_PATH, {
    ...parsed.value,
    mcp: {
      ...existingMcp,
      [CODE_NAV_MCP_ID]: {
        type: "local",
        enabled: true,
        command: codeNavMcpCommand(resolve(packageRoot ?? defaultPackageRoot())),
      },
    },
  }, bootstrapWriteBoundary)
  return undefined
}
