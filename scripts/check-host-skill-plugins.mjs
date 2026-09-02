#!/usr/bin/env node
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

try {
  const distribution = await import(pathToFileURL(join(packageRoot, "dist", "cli", "host-plugin-distribution.js")).href)
  distribution.verifyHostPluginDistribution(packageRoot)
} catch (error) {
  process.stderr.write(`${error instanceof Error && error.message.startsWith("host-plugin-distribution") ? error.message : "host-plugin-distribution-check-failed"}\n`)
  process.exitCode = 1
}
