#!/usr/bin/env node
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

try {
  const distribution = await import(pathToFileURL(join(packageRoot, "dist", "cli", "host-plugin-distribution.js")).href)
  distribution.writeHostPluginDistribution(packageRoot, { replace: true })
  process.stdout.write("host-plugin-distribution: generated\n")
} catch (error) {
  process.stderr.write(`${error instanceof Error && error.message.startsWith("host-plugin-distribution") ? error.message : "host-plugin-distribution-generation-failed"}\n`)
  process.exitCode = 1
}
