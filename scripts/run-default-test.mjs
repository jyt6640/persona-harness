#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const sourceCheckout = existsSync(join(packageRoot, "tests"))
const command = sourceCheckout ? (process.platform === "win32" ? "npm.cmd" : "npm") : process.execPath
const args = sourceCheckout
  ? ["run", "test:fast"]
  : [join(packageRoot, "dist", "cli", "index.js"), "--help"]

process.stdout.write(`Persona Harness ${sourceCheckout ? "source test contract" : "installed package smoke"}\n`)

const result = spawnSync(command, args, {
  cwd: packageRoot,
  env: process.env,
  stdio: "inherit",
})

if (result.error !== undefined) {
  process.exitCode = 1
} else if (result.status !== 0) {
  process.exitCode = result.status ?? 1
}
