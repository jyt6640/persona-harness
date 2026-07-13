import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { createHash } from "node:crypto"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { formatInitNonInteractiveInterviewMessage, formatInitResult, initializePersonaHarness } from "../src/cli/init.js"
import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []
const tempPackageRoots: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-init-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function createPackageRoot(): string {
  const packageRoot = mkdtempSync(join(tmpdir(), "persona-init-package-"))
  tempPackageRoots.push(packageRoot)
  cpSync(join(process.cwd(), ".persona"), join(packageRoot, ".persona"), { recursive: true })
  cpSync(join(process.cwd(), "package.json"), join(packageRoot, "package.json"))
  mkdirSync(join(packageRoot, "dist"), { recursive: true })
  writeFileSync(join(packageRoot, "dist", "index.js"), "// synthetic plugin\n")
  return packageRoot
}

function snapshotTree(root: string): Record<string, string> {
  const snapshot: Record<string, string> = {}
  const visit = (current: string): void => {
    const relativePath = relative(root, current).replace(/\\/g, "/")
    if (relativePath.length > 0) {
      const stat = lstatSync(current)
      if (stat.isSymbolicLink()) {
        snapshot[relativePath] = `symlink:${readlinkSync(current)}`
      } else if (stat.isFile()) {
        snapshot[relativePath] = `file:${readFileSync(current).toString("base64")}`
      } else if (stat.isDirectory()) {
        snapshot[relativePath] = "directory"
      }
    }
    if (!lstatSync(current).isDirectory()) {
      return
    }
    for (const entry of readdirSync(current).sort()) {
      visit(join(current, entry))
    }
  }
  visit(root)
  return snapshot
}

function readOpencodeConfig(projectDir: string): unknown {
  return JSON.parse(readFileSync(join(projectDir, ".opencode", "opencode.json"), "utf8"))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

type BackupManifest = {
  readonly manifestDigest: string
  readonly files: readonly { readonly path: string; readonly digest: string; readonly backupPath: string }[]
  readonly schema: string
  readonly marker: string
  readonly sourceManifestDigest: string | null
}

function isBackupManifest(value: unknown): value is BackupManifest {
  if (!isRecord(value) || typeof value.manifestDigest !== "string" || typeof value.schema !== "string" || typeof value.marker !== "string") {
    return false
  }
  if (value.sourceManifestDigest !== null && typeof value.sourceManifestDigest !== "string") {
    return false
  }
  return Array.isArray(value.files) && value.files.every((entry) => (
    isRecord(entry)
    && typeof entry.path === "string"
    && typeof entry.digest === "string"
    && typeof entry.backupPath === "string"
  ))
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
  for (const packageRoot of tempPackageRoots) {
    rmSync(packageRoot, { recursive: true, force: true })
  }
  tempPackageRoots.length = 0
})

describe("persona-harness init", () => {
  it("installs the Persona template and OpenCode plugin config without copying evidence", () => {
    const projectDir = createTempProject()

    const result = initializePersonaHarness({ projectDir, packageRoot: process.cwd() })

    expect(existsSync(join(projectDir, ".persona", "harness.jsonc"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "conventions", "controller-persistence-import.yml"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "rules", "backend", "java-common.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "rules", "diff-rules"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "rules", "backend", "step1-api-contract.md"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "rules", "backend", "step2-3-api-contract.md"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "project-profile.jsonc"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "evidence"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "workflow", "plan.md"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", ".ph-init-manifest.json"))).toBe(true)
    expect(existsSync(join(projectDir, ".opencode", "opencode.json"))).toBe(true)
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(false)
    expect(readFileSync(join(projectDir, ".gitignore"), "utf8")).toContain("node_modules/")
    expect(readFileSync(join(projectDir, ".gitignore"), "utf8")).toContain(".opencode/node_modules/")
    expect(readFileSync(join(projectDir, ".gitignore"), "utf8")).toContain(".persona/rules/")
    expect(readFileSync(join(projectDir, ".gitignore"), "utf8")).toContain(".persona/evidence/")
    expect(result.installed).toEqual(
      expect.arrayContaining([
        ".persona/harness.jsonc",
        ".persona/conventions/",
        ".persona/rules/",
        ".opencode/opencode.json",
        ".gitignore",
      ]),
    )
    expect(result.evidenceCopied).toBe(false)
    expect(result.decision).toBe("apply")
    expect(result.changed).toContain(".persona/.ph-init-manifest.json")

    const config = readOpencodeConfig(projectDir)
    expect(isRecord(config)).toBe(true)
    if (!isRecord(config)) {
      return
    }
    expect(config.plugin).toEqual([join(process.cwd(), "dist", "index.js")])
  })

  it("preserves an existing OpenCode config while adding the Persona plugin path once", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".opencode"), { recursive: true })
    writeFileSync(
      join(projectDir, ".opencode", "opencode.json"),
      `${JSON.stringify({ model: "openai/gpt-5.4-mini-fast", plugin: ["/tmp/existing-plugin.js"] }, null, 2)}\n`,
    )

    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })
    const rerun = initializePersonaHarness({ projectDir, packageRoot: process.cwd() })

    const config = readOpencodeConfig(projectDir)
    expect(isRecord(config)).toBe(true)
    if (!isRecord(config)) {
      return
    }
    expect(config.model).toBe("openai/gpt-5.4-mini-fast")
    expect(config.plugin).toEqual(["/tmp/existing-plugin.js", join(process.cwd(), "dist", "index.js")])
    expect(existsSync(join(projectDir, ".persona", "evidence"))).toBe(false)
    expect(rerun.decision).toBe("no-op")
  })

  it("is a byte-identical no-op on an unchanged owned rerun", () => {
    const projectDir = createTempProject()
    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })
    const before = snapshotTree(projectDir)

    const result = initializePersonaHarness({ projectDir, packageRoot: process.cwd() })

    expect(result.decision).toBe("no-op")
    expect(result.changed).toEqual([])
    expect(result.backups).toEqual([])
    expect(snapshotTree(projectDir)).toEqual(before)
  })

  it("updates unchanged owned files and records a digest-bound backup", () => {
    const projectDir = createTempProject()
    const firstPackage = createPackageRoot()
    initializePersonaHarness({ projectDir, packageRoot: firstPackage })

    const nextPackage = createPackageRoot()
    const upgradedRule = join(nextPackage, ".persona", "rules", "backend", "java-common.md")
    writeFileSync(upgradedRule, `${readFileSync(upgradedRule, "utf8")}\n# Safe upgrade fixture\n`)
    writeFileSync(
      join(nextPackage, "package.json"),
      `${JSON.stringify({ name: "persona-harness", version: "0.7.0-rc.3" }, null, 2)}\n`,
    )

    const result = initializePersonaHarness({ projectDir, packageRoot: nextPackage })

    expect(result.decision).toBe("apply")
    expect(result.backups).toHaveLength(1)
    expect(readFileSync(join(projectDir, ".persona", "rules", "backend", "java-common.md"), "utf8")).toContain(
      "# Safe upgrade fixture",
    )
    const backupDir = join(projectDir, result.backups[0] ?? "")
    const backupManifestPath = join(backupDir, "manifest.json")
    expect(existsSync(backupManifestPath)).toBe(true)
    const parsedBackupManifest: unknown = JSON.parse(readFileSync(backupManifestPath, "utf8"))
    expect(isBackupManifest(parsedBackupManifest)).toBe(true)
    if (!isBackupManifest(parsedBackupManifest)) {
      return
    }
    const backupManifest = parsedBackupManifest
    const { manifestDigest, ...manifestBody } = backupManifest
    expect(backupManifest.schema).toBe("persona-harness.init-backup.v1")
    expect(backupManifest.marker).toBe("ph-init-owned-v1")
    expect(manifestDigest).toBe(createHash("sha256").update(JSON.stringify(manifestBody)).digest("hex"))
    const backupEntry = backupManifest.files.find((entry) => entry.path.endsWith("java-common.md"))
    expect(backupEntry).toBeDefined()
    if (backupEntry === undefined) {
      return
    }
    expect(createHash("sha256").update(readFileSync(join(projectDir, backupEntry.backupPath))).digest("hex")).toBe(
      backupEntry.digest,
    )
  })

  it("fails closed without writes when a generated config is user-modified", () => {
    const projectDir = createTempProject()
    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })
    const configPath = join(projectDir, ".persona", "harness.jsonc")
    writeFileSync(configPath, `${readFileSync(configPath, "utf8")}\n// user change\n`)
    const before = snapshotTree(projectDir)

    const result = runPersonaCli(["init"], { cwd: projectDir, packageRoot: process.cwd(), invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("harness.jsonc")
    expect(result.stderr).toContain("no files were changed")
    expect(snapshotTree(projectDir)).toEqual(before)
  })

  it("fails closed without writes when a generated rule is user-modified", () => {
    const projectDir = createTempProject()
    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })
    const rulePath = join(projectDir, ".persona", "rules", "backend", "java-common.md")
    writeFileSync(rulePath, `${readFileSync(rulePath, "utf8")}\n# user change\n`)
    const before = snapshotTree(projectDir)

    const result = runPersonaCli(["init"], { cwd: projectDir, packageRoot: process.cwd(), invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("java-common.md")
    expect(snapshotTree(projectDir)).toEqual(before)
  })

  it("does not overwrite a foreign file at a newly introduced generated path", () => {
    const projectDir = createTempProject()
    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })
    const foreignPath = join(projectDir, ".persona", "rules", "backend", "new-rule.md")
    writeFileSync(foreignPath, "# foreign rule\n")
    const packageRoot = createPackageRoot()
    writeFileSync(join(packageRoot, ".persona", "rules", "backend", "new-rule.md"), "# generated rule\n")
    writeFileSync(
      join(packageRoot, "package.json"),
      `${JSON.stringify({ name: "persona-harness", version: "0.7.0-rc.3" }, null, 2)}\n`,
    )
    const before = snapshotTree(projectDir)

    const result = runPersonaCli(["init"], { cwd: projectDir, packageRoot, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("new-rule.md")
    expect(snapshotTree(projectDir)).toEqual(before)
  })

  it("preserves a foreign AGENTS.md without treating it as an init target", () => {
    const projectDir = createTempProject()
    const agentsPath = join(projectDir, "AGENTS.md")
    writeFileSync(agentsPath, "# User instructions\n")

    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })

    expect(readFileSync(agentsPath, "utf8")).toBe("# User instructions\n")
  })

  it("refuses a partial prior initialization without repairing or deleting it", () => {
    const projectDir = createTempProject()
    const partial = join(projectDir, ".persona")
    mkdirSync(partial, { recursive: true })
    writeFileSync(join(partial, "harness.jsonc"), "{\"user\":\"partial\"}\n")
    const before = snapshotTree(projectDir)

    const result = runPersonaCli(["init"], { cwd: projectDir, packageRoot: process.cwd(), invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("partial")
    expect(snapshotTree(projectDir)).toEqual(before)
  })

  it("performs a deterministic dry-run with zero writes", () => {
    const projectDir = createTempProject()
    const before = snapshotTree(projectDir)

    const result = runPersonaCli(["init", "--dry-run"], {
      cwd: projectDir,
      packageRoot: process.cwd(),
      invocationName: "ph",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Dry run")
    expect(result.stdout).toContain("zero writes")
    expect(snapshotTree(projectDir)).toEqual(before)
  })

  it("rejects an invalid init option without writing", () => {
    const projectDir = createTempProject()
    const before = snapshotTree(projectDir)

    const result = runPersonaCli(["init", "--unknown"], {
      cwd: projectDir,
      packageRoot: process.cwd(),
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Unknown init option")
    expect(snapshotTree(projectDir)).toEqual(before)
  })

  it("rejects a symlinked generated directory and preserves the outside target", () => {
    const projectDir = createTempProject()
    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })
    const outside = mkdtempSync(join(tmpdir(), "persona-init-outside-"))
    tempProjects.push(outside)
    const rulesPath = join(projectDir, ".persona", "rules")
    const outsideRule = join(outside, "foreign.md")
    writeFileSync(outsideRule, "foreign\n")
    rmSync(rulesPath, { recursive: true, force: true })
    symlinkSync(outside, rulesPath, "dir")
    const before = snapshotTree(projectDir)

    const result = runPersonaCli(["init"], { cwd: projectDir, packageRoot: process.cwd(), invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("symbolic link")
    expect(snapshotTree(projectDir)).toEqual(before)
    expect(readFileSync(outsideRule, "utf8")).toBe("foreign\n")
  })

  it("rolls back the complete pre-state after an injected write failure", () => {
    const projectDir = createTempProject()
    const before = snapshotTree(projectDir)

    const result = runPersonaCli(["init"], {
      cwd: projectDir,
      packageRoot: process.cwd(),
      invocationName: "ph",
      onAfterInitCommitFile: (relativePath: string) => {
        if (relativePath === ".persona/rules/backend/java-common.md") {
          throw new Error("injected init failure")
        }
      },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Init transaction failed")
    expect(snapshotTree(projectDir)).toEqual(before)
  })

  it("fails closed when a concurrent target appears during preflight", () => {
    const projectDir = createTempProject()
    const before = snapshotTree(projectDir)

    const result = runPersonaCli(["init"], {
      cwd: projectDir,
      packageRoot: process.cwd(),
      invocationName: "ph",
      onBeforeInitCommit: () => {
        mkdirSync(join(projectDir, ".persona"), { recursive: true })
        writeFileSync(join(projectDir, ".persona", "foreign.txt"), "foreign\n")
      },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("changed before commit")
    expect(readFileSync(join(projectDir, ".persona", "foreign.txt"), "utf8")).toBe("foreign\n")
    expect(snapshotTree(projectDir)).not.toEqual(before)
    expect(existsSync(join(projectDir, ".persona", "harness.jsonc"))).toBe(false)
  })

  it("rejects a package binding substitution without changing the project", () => {
    const projectDir = createTempProject()
    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })
    const wrongPackage = createPackageRoot()
    const packageJson = join(wrongPackage, "package.json")
    writeFileSync(packageJson, `${JSON.stringify({ name: "foreign-package", version: "0.0.0" }, null, 2)}\n`)
    const before = snapshotTree(projectDir)

    const result = runPersonaCli(["init"], { cwd: projectDir, packageRoot: wrongPackage, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Package binding")
    expect(snapshotTree(projectDir)).toEqual(before)
  })

  it("rejects same-version package template substitution without changing the project", () => {
    const projectDir = createTempProject()
    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })
    const substitute = createPackageRoot()
    writeFileSync(
      join(substitute, ".persona", "harness.jsonc"),
      `${readFileSync(join(substitute, ".persona", "harness.jsonc"), "utf8")}\n// substitute\n`,
    )
    const before = snapshotTree(projectDir)

    const result = runPersonaCli(["init"], { cwd: projectDir, packageRoot: substitute, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Package binding")
    expect(snapshotTree(projectDir)).toEqual(before)
  })

  it("rejects a profile binding substitution without changing the project", () => {
    const projectDir = createTempProject()
    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })
    const profilePath = join(projectDir, ".persona", "project-profile.jsonc")
    writeFileSync(profilePath, "{\"profile\":\"user-substitution\"}\n")
    const before = snapshotTree(projectDir)

    const result = runPersonaCli(["init"], { cwd: projectDir, packageRoot: process.cwd(), invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("profile binding")
    expect(snapshotTree(projectDir)).toEqual(before)
  })

  it("preserves existing gitignore entries and does not duplicate noise guard entries", () => {
    const projectDir = createTempProject()
    writeFileSync(join(projectDir, ".gitignore"), "custom-output/\nnode_modules/\n")

    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })
    initializePersonaHarness({ projectDir, packageRoot: process.cwd() })

    const gitignore = readFileSync(join(projectDir, ".gitignore"), "utf8")
    const lines = gitignore.split(/\r?\n/)
    expect(gitignore).toContain("custom-output/")
    expect(lines.filter((line) => line === "node_modules/")).toHaveLength(1)
    expect(lines.filter((line) => line === ".opencode/node_modules/")).toHaveLength(1)
    expect(lines.filter((line) => line === ".persona/rules/")).toHaveLength(1)
    expect(lines.filter((line) => line === ".persona/evidence/")).toHaveLength(1)
  })

  it("prints an init-only next flow that matches the files it creates", () => {
    const result = formatInitResult({
      projectDir: "/tmp/project",
      packageRoot: process.cwd(),
      pluginPath: join(process.cwd(), "dist", "index.js"),
      installed: [".persona/harness.jsonc", ".persona/conventions/", ".persona/rules/", ".opencode/opencode.json"],
      backups: [],
      evidenceCopied: false,
      decision: "apply",
      changed: [".persona/harness.jsonc"],
      conflicts: [],
    })

    expect(result).toContain("`ph init` installs Persona Harness config/conventions/rules and OpenCode plugin config only.")
    expect(result).toContain("It does not create `AGENTS.md`, `.persona/project-profile.jsonc`, or workflow plan/report templates.")
    expect(result).toContain("Do not enter implementation before the backend project profile exists.")
    expect(result).toContain("npx ph bootstrap backend")
    expect(result).toContain("npx ph intake --interactive")
    expect(result).toContain("npx ph intake --default backend")
    expect(result).toContain("npx ph policy init")
    expect(result).toContain("npx ph plan --auto-accept")
    expect(result).toContain("opencode")
    expect(result).toContain("TUI")
    expect(result).toContain("$(npx ph plan --prompt)")
    expect(result).not.toContain("starts the backend profile interview")
    expect(result).not.toContain("요구사항 전체를 Gradle 기반 Spring 백엔드로 구현해줘")
  })

  it("explains the AI/non-TTY bootstrap path without creating a default profile", () => {
    const result = formatInitNonInteractiveInterviewMessage("ph")

    expect(result).toContain("interactive terminal")
    expect(result).toContain("npx ph init")
    expect(result).toContain("npx ph bootstrap backend")
    expect(result).toContain("No default profile was created")
  })
})
