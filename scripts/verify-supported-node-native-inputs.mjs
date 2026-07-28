#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

const PROFILE_CODE = "project-finish-producer-profile"
const packageRoot = packageRootFromEnvironment()
const temporaryRoot = realpathSync(mkdtempSync(join(tmpdir(), "persona-supported-native-inputs-")))
const originalCwd = process.cwd()
const originalDlopen = process.dlopen

let afterNativeCaptureRoot
let afterNativeTree
let nativeCaptureRootCount = 0
let nativeTreeCount = 0

try {
  process.chdir(temporaryRoot)
  installNativeAuditHook()
  const inputs = await importPackageModule("dist/cli/project-finish-attestation-inputs.js")
  const runtime = await importPackageModule("dist/io/native-project-read.js")
  assertNativeRuntime(runtime)

  assertReady(inputs, createProject("profileless"), "absent")
  const profileProject = createProject("profile")
  writeFileSync(join(profileProject, ".persona", "project-profile.jsonc"), `${JSON.stringify(canonicalProfile())}\n`)
  assertReady(inputs, profileProject, "ready")

  assertDescriptorRace(inputs)
  assertProfileLeafRace(inputs)
  assertProfileParentRace(inputs)
  assertProjectRootRace(inputs)
  assertStandaloneDescriptorAudits()

  process.stdout.write(`${JSON.stringify({ nativeProjectRead: "PASS" })}\n`)
} catch {
  process.stderr.write("Native project read support verification failed\n")
  process.exitCode = 1
} finally {
  process.dlopen = originalDlopen
  process.chdir(originalCwd)
  rmSync(temporaryRoot, { force: true, recursive: true })
}

function packageRootFromEnvironment() {
  const value = process.env.PH_SUPPORT_PACKAGE_ROOT
  if (typeof value !== "string" || value.length === 0) throw new Error("native-project-read-package-root")
  return resolve(value)
}

function installNativeAuditHook() {
  process.dlopen = function patchedNativeDlopen(nativeModule, filename, flags) {
    if (arguments.length === 2) {
      originalDlopen(nativeModule, filename)
    } else {
      originalDlopen(nativeModule, filename, flags)
    }
    const exportsDescriptor = Object.getOwnPropertyDescriptor(nativeModule, "exports")
    const nativeExports = exportsDescriptor?.value
    if (!isRecord(nativeExports) || typeof nativeExports.run !== "function") return
    const run = nativeExports.run
    Object.defineProperty(nativeExports, "run", {
      configurable: true,
      enumerable: true,
      value: (...args) => {
        const result = run(...args)
        const command = Array.isArray(args[0]) ? args[0][1] : undefined
        if (command === "capture-root") {
          nativeCaptureRootCount += 1
          afterNativeCaptureRoot?.()
        }
        if (command === "tree") {
          nativeTreeCount += 1
          afterNativeTree?.()
        }
        return result
      },
      writable: true,
    })
  }
}

async function importPackageModule(relativePath) {
  return import(pathToFileURL(join(packageRoot, relativePath)).href)
}

function assertNativeRuntime(runtime) {
  if (typeof runtime.inspectNativeProjectReadRuntime !== "function") throw new Error("native-project-read-runtime")
  const inspection = runtime.inspectNativeProjectReadRuntime()
  if (!isRecord(inspection) || inspection.availability !== "ready" || inspection.platform !== process.platform) {
    throw new Error("native-project-read-runtime")
  }
}

function createProject(name) {
  const project = join(temporaryRoot, name)
  mkdirSync(join(project, ".persona"), { recursive: true })
  writeFileSync(join(project, "build.gradle"), "plugins { id 'java' }\n")
  writeFileSync(join(project, "settings.gradle"), "rootProject.name = 'fixture'\n")
  return project
}

function canonicalProfile() {
  return {
    defaults: { buildTool: "gradle", framework: "spring", language: "java" },
    schema: "persona.project-profile.v1",
    scope: { mvp: "java-spring-clean-code", role: "backend" },
    status: "ready",
  }
}

function assertReady(inputs, project, profile) {
  const result = inputs.captureProjectFinishAttestationInputSnapshot(project)
  if (!isRecord(result) || result.kind !== "ready" || !isRecord(result.value) || result.value.profile !== profile) {
    throw new Error("native-project-read-input-ready")
  }
}

function assertDescriptorRace(inputs) {
  const project = createProject("descriptor-race")
  const source = join(project, "build.gradle")
  const draft = join(project, "build.draft.gradle")
  const outside = outsideFile("descriptor", "plugins { id 'outside' }\n")
  assertTreeRace(inputs, project, source, draft, outside)
}

function assertProfileLeafRace(inputs) {
  const project = createProject("profile-leaf-race")
  const source = join(project, ".persona", "project-profile.jsonc")
  const draft = join(project, ".persona", "project-profile.draft.jsonc")
  writeFileSync(source, `${JSON.stringify(canonicalProfile())}\n`)
  const outside = outsideFile("profile-leaf", `${JSON.stringify({ marker: "external-marker", ...canonicalProfile() })}\n`)
  assertTreeRace(inputs, project, source, draft, outside)
}

function assertProfileParentRace(inputs) {
  const project = createProject("profile-parent-race")
  const source = join(project, ".persona")
  const draft = join(project, ".persona.draft")
  writeFileSync(join(source, "project-profile.jsonc"), `${JSON.stringify(canonicalProfile())}\n`)
  const outside = join(temporaryRoot, "outside-profile-parent")
  mkdirSync(outside)
  const marker = join(outside, "marker")
  writeFileSync(marker, "external-marker\n")
  writeFileSync(join(outside, "project-profile.jsonc"), `${JSON.stringify({ marker: "external-marker", ...canonicalProfile() })}\n`)
  assertTreeRace(inputs, project, source, draft, outside, marker)
}

function assertProjectRootRace(inputs) {
  const project = createProject("root-race")
  const draft = join(temporaryRoot, "root-race.draft")
  const outside = join(temporaryRoot, "outside-root")
  mkdirSync(outside)
  const marker = join(outside, "marker")
  writeFileSync(marker, "external-marker\n")
  writeFileSync(join(outside, "build.gradle"), "plugins { id 'outside' }\n")
  writeFileSync(join(outside, "settings.gradle"), "rootProject.name = 'outside'\n")

  let swapped = false
  const before = nativeCaptureRootCount
  afterNativeCaptureRoot = () => {
    if (swapped) return
    swapped = true
    renameSync(project, draft)
    symlinkSync(outside, project)
  }
  try {
    assertBlocked(inputs.captureProjectFinishAttestationInputSnapshot(project))
    if (!swapped || nativeCaptureRootCount <= before || readFileSync(marker, "utf8") !== "external-marker\n") {
      throw new Error("native-project-read-root-race")
    }
  } finally {
    afterNativeCaptureRoot = undefined
    if (swapped) {
      unlinkSync(project)
      renameSync(draft, project)
    }
  }
}

function assertTreeRace(inputs, project, source, draft, outside, marker = outside) {
  const markerBytes = readFileSync(marker)
  let swapped = false
  const before = nativeTreeCount
  afterNativeTree = () => {
    if (swapped) return
    swapped = true
    renameSync(source, draft)
    symlinkSync(outside, source)
  }
  try {
    assertBlocked(inputs.captureProjectFinishAttestationInputSnapshot(project))
    if (!swapped || nativeTreeCount <= before || !readFileSync(marker).equals(markerBytes)) {
      throw new Error("native-project-read-tree-race")
    }
  } finally {
    afterNativeTree = undefined
    if (swapped) {
      unlinkSync(source)
      renameSync(draft, source)
    }
  }
}

function assertBlocked(result) {
  if (!isRecord(result) || result.kind !== "blocked" || result.code !== PROFILE_CODE) {
    throw new Error("native-project-read-input-blocked")
  }
  if (JSON.stringify(result).includes("external-marker")) throw new Error("native-project-read-input-privacy")
}

function outsideFile(name, contents) {
  const path = join(temporaryRoot, `outside-${name}`)
  writeFileSync(path, contents)
  return path
}

function assertStandaloneDescriptorAudits() {
  const executable = join(temporaryRoot, "ph-native-project-read-audit")
  const compile = spawnSync(
    "cc",
    [
      "-std=c11",
      "-O2",
      "-I",
      join(packageRoot, "native", "project-read"),
      join(packageRoot, "native", "project-read", "ph_native_project_read.c"),
      "-o",
      executable,
    ],
    { cwd: temporaryRoot, encoding: "buffer", shell: false, stdio: ["ignore", "ignore", "ignore"] },
  )
  if (compile.status !== 0) throw new Error("native-project-read-audit-compile")

  for (const replace of [replaceRoot, replaceIntermediate, replaceLeaf]) {
    const runner = mkdtempSync(join(temporaryRoot, "audit-"))
    const project = join(runner, "project")
    const outside = join(runner, "outside")
    try {
      mkdirSync(join(project, "src", "main", "java"), { recursive: true })
      mkdirSync(outside)
      writeFileSync(join(project, "src", "main", "java", "App.java"), "class App {}\n")
      writeFileSync(join(outside, "App.java"), "class External {}\n")
      if (replace === replaceRoot) {
        mkdirSync(join(outside, "src", "main", "java"), { recursive: true })
        writeFileSync(join(outside, "src", "main", "java", "App.java"), "class External {}\n")
      }
      const identity = lstatSync(outside, { bigint: true })
      replace(project, outside)
      const result = spawnSync(
        executable,
        [
          "read",
          "src/main/java/App.java",
          "4096",
          "--root",
          "project",
          "--audit",
          identity.dev.toString(),
          identity.ino.toString(),
        ],
        { cwd: runner, encoding: "buffer", env: {}, shell: false, stdio: ["ignore", "pipe", "ignore"] },
      )
      if (result.status !== 0 || !Buffer.isBuffer(result.stdout) || !result.stdout.equals(Buffer.from([2, 0]))) {
        throw new Error("native-project-read-audit")
      }
    } finally {
      rmSync(runner, { force: true, recursive: true })
    }
  }
}

function replaceRoot(project, outside) {
  renameSync(project, `${project}.draft`)
  symlinkSync(outside, project)
}

function replaceIntermediate(project, outside) {
  const source = join(project, "src", "main", "java")
  renameSync(source, `${source}.draft`)
  symlinkSync(outside, source)
}

function replaceLeaf(project, outside) {
  const source = join(project, "src", "main", "java", "App.java")
  unlinkSync(source)
  symlinkSync(join(outside, "App.java"), source)
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
