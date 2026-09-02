import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import {
  HOST_PLUGIN_HOSTS,
  HostPluginDistributionError,
  hostPluginDistributionPath,
  type HostPluginHost,
} from "./host-plugin-distribution.js"

export type HostPluginCommandOptions = {
  readonly packageRoot?: string
}

function hostPluginUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} plugin path <codex|claude>`,
    "",
    "Print a verified, read-only installed plugin path. This command never registers a marketplace or edits host configuration.",
  ].join("\n")
}

function parseHost(value: string | undefined): HostPluginHost | undefined {
  return HOST_PLUGIN_HOSTS.find((host) => host === value)
}

export function runHostPluginCommand(
  args: readonly string[],
  options: HostPluginCommandOptions = {},
  invocationName = "ph",
): CliRunResult {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h" || args[0] === "help")) {
    return { status: 0, stdout: `${hostPluginUsage(invocationName)}\n`, stderr: "" }
  }
  const host = parseHost(args[1])
  if (args.length !== 2 || args[0] !== "path" || host === undefined) {
    return { status: 1, stdout: "", stderr: `${hostPluginUsage(invocationName)}\n` }
  }
  try {
    const root = options.packageRoot ?? process.cwd()
    return { status: 0, stdout: `${hostPluginDistributionPath(root, host)}\n`, stderr: "" }
  } catch (error) {
    if (error instanceof HostPluginDistributionError) {
      return { status: 1, stdout: "", stderr: `${error.code}\n` }
    }
    throw error
  }
}
