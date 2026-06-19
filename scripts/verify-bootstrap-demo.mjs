import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs"
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
    throw new Error(
      [
        `Command failed: ${[command, ...args].join(" ")}`,
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

const tempRoot = mkdtempSync(join(tmpdir(), "persona-bootstrap-demo-"))

try {
  const packDir = join(tempRoot, "pack")
  mkdirSync(packDir, { recursive: true })
  const packOutput = run("npm", ["pack", "--json", "--pack-destination", packDir])
  const tarballPath = resolvePackedTarball(packOutput, packDir)
  const demoProjectDir = join(tempRoot, "demo-project")
  mkdirSync(demoProjectDir, { recursive: true })
  writeFileSync(
    join(demoProjectDir, "package.json"),
    `${JSON.stringify({ private: true, type: "module", dependencies: {} }, null, 2)}\n`,
  )
  writeFileSync(join(demoProjectDir, "README.md"), "# Coupon API\n\nBuild a Gradle Spring backend.\n")

  run("npm", ["install", "--silent", "--no-audit", "--no-fund", tarballPath], { cwd: demoProjectDir })
  const installedPackageDir = join(demoProjectDir, "node_modules", "persona-harness")
  const binPath = join(demoProjectDir, "node_modules", ".bin", "persona-harness")
  run(binPath, ["init"], { cwd: demoProjectDir })

  if (existsSync(join(demoProjectDir, ".persona", "evidence"))) {
    throw new Error("Init created evidence before any hook ran")
  }

  const installedEntry = join(installedPackageDir, "dist", "index.js")
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

  const sessionID = "bootstrap-demo-session"
  const toolOutput = { title: "README.md", output: "# Coupon API", metadata: {} }
  await toolAfterHook(
    {
      tool: "read",
      sessionID,
      callID: "bootstrap-demo-call",
      args: { path: "README.md" },
    },
    toolOutput,
  )
  assertIncludes("tool output", toolOutput.output, "[Persona Harness Injection]")
  assertIncludes("tool output", toolOutput.output, "파일 역할: project-bootstrap")
  assertIncludes("tool output", toolOutput.output, "backend/java-backend-bootstrap.md")

  const messagesOutput = {
    messages: [
      {
        info: { id: "demo-message", role: "user", sessionID },
        parts: [{ type: "text", text: "README.md를 끝까지 읽고 Gradle 기반 Spring 백엔드를 만들어줘." }],
      },
    ],
  }
  await messagesTransformHook({}, messagesOutput)
  const transformedText = JSON.stringify(messagesOutput)
  assertIncludes("model input", transformedText, "backend/java-backend-bootstrap.md")
  assertIncludes("model input", transformedText, "Service는 Map/List/AtomicLong/nextId/idCounter")

  const evidenceFiles = collectFiles(join(demoProjectDir, ".persona", "evidence", "phase0"), (file) =>
    file.endsWith(".json"),
  )
  if (evidenceFiles.length < 2) {
    throw new Error(`Expected README bootstrap evidence files, found ${evidenceFiles.length}`)
  }

  console.log("Persona bootstrap demo: PASS")
  console.log(`Packed tarball: ${tarballPath}`)
  console.log("Target file: README.md")
  console.log(`Evidence files: ${evidenceFiles.length}`)
  if (KEEP_DEMO_PROJECT) {
    console.log(`Demo project kept: ${demoProjectDir}`)
  }
} finally {
  if (!KEEP_DEMO_PROJECT) {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}
