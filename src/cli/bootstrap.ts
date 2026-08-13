import type { CliRunResult } from "./bearshell.js"
import {
  bootstrapUsage,
  parseBootstrapArgs,
  type BootstrapOptions,
} from "./bootstrap-contract.js"
import { runBackendBootstrap } from "./bootstrap-runner.js"

export { BOOTSTRAP_TRANSACTION_OUTPUT_MANIFEST, bootstrapUsage } from "./bootstrap-contract.js"

export function runBootstrapCommand(
  args: readonly string[],
  options: BootstrapOptions = {},
  invocationName = "ph",
): CliRunResult {
  const parsed = parseBootstrapArgs(args)
  if (parsed.kind === "help") {
    return { status: 0, stdout: `${bootstrapUsage(invocationName)}\n`, stderr: "" }
  }
  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${bootstrapUsage(invocationName)}\n` }
  }
  return runBackendBootstrap(options, parsed)
}
