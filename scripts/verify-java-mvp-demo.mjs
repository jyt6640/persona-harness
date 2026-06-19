import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const KEEP_DEMO_PROJECT = process.argv.includes("--keep")

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? PROJECT_DIR,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  })

  if (result.status !== 0) {
    const commandLine = [command, ...args].join(" ")
    throw new Error(
      [
        `Command failed: ${commandLine}`,
        `cwd: ${options.cwd ?? PROJECT_DIR}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    )
  }

  return result.stdout
}

function resolvePackedTarball(packOutput, packDir) {
  const parsed = JSON.parse(packOutput)
  if (!Array.isArray(parsed) || parsed.length !== 1 || typeof parsed[0]?.filename !== "string") {
    throw new Error("npm pack did not return one tarball filename")
  }

  const filename = parsed[0].filename
  return isAbsolute(filename) ? filename : join(packDir, basename(filename))
}

function collectFiles(dir, predicate) {
  if (!existsSync(dir)) {
    return []
  }

  const matches = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      matches.push(...collectFiles(entryPath, predicate))
      continue
    }
    if (predicate(entryPath)) {
      matches.push(entryPath)
    }
  }
  return matches
}

function assertIncludes(label, source, expected) {
  if (!source.includes(expected)) {
    throw new Error(`${label} did not include expected text: ${expected}`)
  }
}

const tempRoot = mkdtempSync(join(tmpdir(), "persona-java-mvp-demo-"))

try {
  const packDir = join(tempRoot, "pack")
  mkdirSync(packDir, { recursive: true })

  const packOutput = run("npm", ["pack", "--json", "--pack-destination", packDir])
  const tarballPath = resolvePackedTarball(packOutput, packDir)
  if (!existsSync(tarballPath)) {
    throw new Error(`Packed tarball was not created: ${tarballPath}`)
  }

  const demoProjectDir = join(tempRoot, "demo-project")
  mkdirSync(demoProjectDir, { recursive: true })
  writeFileSync(
    join(demoProjectDir, "package.json"),
    `${JSON.stringify({ private: true, type: "module", dependencies: {} }, null, 2)}\n`,
  )

  run("npm", ["install", "--silent", "--no-audit", "--no-fund", tarballPath], { cwd: demoProjectDir })

  const installedPackageDir = join(demoProjectDir, "node_modules", "persona-harness")
  const installedEntry = join(installedPackageDir, "dist", "index.js")
  const installedPersonaDir = join(installedPackageDir, ".persona")
  if (!existsSync(installedEntry)) {
    throw new Error(`Installed package entry is missing: ${installedEntry}`)
  }
  if (!existsSync(installedPersonaDir)) {
    throw new Error(`Installed package .persona directory is missing: ${installedPersonaDir}`)
  }

  cpSync(installedPersonaDir, join(demoProjectDir, ".persona"), { recursive: true })

  const targetFile = "src/main/java/com/example/coupon/presentation/CouponController.java"
  const targetPath = join(demoProjectDir, targetFile)
  mkdirSync(dirname(targetPath), { recursive: true })
  writeFileSync(
    targetPath,
    [
      "package com.example.coupon.presentation;",
      "",
      "public class CouponController {",
      "}",
      "",
    ].join("\n"),
  )

  const pluginModule = await import(pathToFileURL(installedEntry).href)
  const plugin = pluginModule.default
  if (plugin?.id !== "persona-harness" || typeof plugin.server !== "function") {
    throw new Error("Installed package default export is not the persona-harness OpenCode plugin module")
  }

  const hooks = await plugin.server({ directory: demoProjectDir })
  const toolAfterHook = hooks["tool.execute.after"]
  const messagesTransformHook = hooks["experimental.chat.messages.transform"]
  if (typeof toolAfterHook !== "function" || typeof messagesTransformHook !== "function") {
    throw new Error("Installed plugin did not expose the expected Phase 0 hooks")
  }

  const sessionID = "demo-session"
  const toolOutput = {
    title: targetFile,
    output: "public class CouponController {}",
    metadata: {},
  }
  await toolAfterHook(
    {
      tool: "read",
      sessionID,
      callID: "demo-call",
      args: { path: targetFile },
    },
    toolOutput,
  )

  assertIncludes("tool output", toolOutput.output, "[Persona Harness Injection]")
  assertIncludes("tool output", toolOutput.output, "파일 역할: controller")
  assertIncludes("tool output", toolOutput.output, "backend/java-common.md")
  assertIncludes("tool output", toolOutput.output, "backend/spring-controller.md")

  const messagesOutput = {
    messages: [
      {
        info: { id: "demo-message", role: "user", sessionID },
        parts: [{ type: "text", text: "Implement the coupon controller." }],
      },
    ],
  }
  await messagesTransformHook({}, messagesOutput)
  const transformedText = JSON.stringify(messagesOutput)
  assertIncludes("model input", transformedText, "[Persona Harness Injection]")
  assertIncludes("model input", transformedText, "backend/spring-controller.md")

  const evidenceFiles = collectFiles(join(demoProjectDir, ".persona", "evidence"), (file) => file.endsWith(".json"))
  if (evidenceFiles.length < 2) {
    throw new Error(`Expected at least 2 evidence files, found ${evidenceFiles.length}`)
  }

  console.log("Java MVP demo readiness: PASS")
  console.log(`Packed tarball: ${tarballPath}`)
  console.log(`Installed package entry: ${installedEntry}`)
  console.log(`Target file: ${targetFile}`)
  console.log(`Evidence files: ${evidenceFiles.length}`)
  if (KEEP_DEMO_PROJECT) {
    console.log(`Demo project kept: ${demoProjectDir}`)
  }
} finally {
  if (!KEEP_DEMO_PROJECT) {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}
