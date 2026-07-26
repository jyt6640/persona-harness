import fs, {
  chmodSync,
  existsSync,
  mkdirSync,
  realpathSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { syncBuiltinESMExports } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { BOOTSTRAP_TRANSACTION_OUTPUT_MANIFEST } from "../src/cli/bootstrap.js"
import { runPersonaCli } from "../src/cli/index.js"

const projects: string[] = []
const WORKFLOW_STATE_FILES = ["workflow-loop-state.json", "ralph-loop-state.json"] as const
const WORKFLOW_DRAFT_FILES = [
  "plan.md",
  "roles.md",
  "implementation-report.md",
  "review-report.md",
] as const
const WORKFLOW_BOOTSTRAP_FILES = [
  ...WORKFLOW_DRAFT_FILES,
  ...WORKFLOW_STATE_FILES,
] as const
const PERSONA_BOOTSTRAP_FILES = [
  "harness.jsonc",
  "project-profile.jsonc",
  "policies/overlay.jsonc",
  "policies/company/backend.md",
  "policies/personal/backend.md",
] as const
const BOOTSTRAP_ARTIFACT_PATHS = [
  ...PERSONA_BOOTSTRAP_FILES,
  "workflow/plan.md",
  "workflow/roles.md",
  "workflow/implementation-report.md",
  "workflow/review-report.md",
  "workflow/workflow-loop-state.json",
  "workflow/ralph-loop-state.json",
] as const
const ROOT_INIT_FILES = [".gitignore", ".opencode/opencode.json"] as const
const CAPTURED_BOOTSTRAP_WRITE_STAGES = [
  { kind: "atomic", leaf: "harness.jsonc" },
  { kind: "atomic", leaf: "project-profile.jsonc" },
  { kind: "atomic", leaf: "overlay.jsonc" },
  { kind: "atomic", leaf: "backend.md" },
  { kind: "direct", leaf: "plan.md" },
  { kind: "direct", leaf: "implementation-report.md" },
  { kind: "direct", leaf: "review-report.md" },
  { kind: "direct", leaf: "roles.md" },
  { kind: "state", leaf: "workflow-loop-state.json" },
  { kind: "state", leaf: "ralph-loop-state.json" },
  { kind: "atomic", leaf: "AGENTS.md" },
] as const

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

describe("bootstrap workspace intake", () => {
  it("blocks a fresh .persona parent replacement before initialization writes any artifact", () => {
    const projectDir = createProject()
    const personaDir = join(projectDir, ".persona")
    const canonicalPersonaDir = join(realpathSync(projectDir), ".persona")
    const preserved = join(projectDir, ".persona-preserved")
    const outside = join(projectDir, "outside-fresh-persona")
    mkdirSync(outside)
    const originalRename = fs.renameSync
    let swapped = false

    fs.renameSync = ((...args: Parameters<typeof fs.renameSync>) => {
      const result = originalRename(...args)
      if (!swapped && args[1] === ".persona") {
        swapped = true
        originalRename(canonicalPersonaDir, preserved)
        symlinkSync(outside, personaDir)
      }
      return result
    }) as typeof fs.renameSync
    syncBuiltinESMExports()
    try {
      const result = runBootstrap(projectDir)

      expect(swapped).toBe(true)
      expect(result.status).toBe(1)
      expect(fs.readdirSync(outside)).toEqual([])
      expect(`${result.stdout}${result.stderr}`).not.toContain(outside)
      expect(authorityEvidenceExists(projectDir)).toBe(false)
    } finally {
      fs.renameSync = originalRename
      syncBuiltinESMExports()
      if (swapped) {
        unlinkSync(personaDir)
        renameSync(preserved, personaDir)
      }
    }
  })

  it("blocks a project-root replacement before fresh initialization writes any root artifact", () => {
    const projectDir = createProject()
    const canonicalProjectDir = realpathSync(projectDir)
    const preserved = join(dirname(projectDir), `${projectDir.split("/").at(-1)}-preserved`)
    const outside = join(dirname(projectDir), `${projectDir.split("/").at(-1)}-outside`)
    mkdirSync(outside)
    const originalOpen = fs.openSync
    let swapped = false

    fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
      if (!swapped && args[0] === ".gitignore") {
        swapped = true
        renameSync(canonicalProjectDir, preserved)
        symlinkSync(outside, projectDir)
      }
      return originalOpen(...args)
    }) as typeof fs.openSync
    syncBuiltinESMExports()
    try {
      const result = runBootstrap(projectDir)

      expect(swapped).toBe(true)
      expect(result.status).toBe(1)
      expect(fs.readdirSync(outside)).toEqual([])
      expect(`${result.stdout}${result.stderr}`).not.toContain(outside)
      expect(authorityEvidenceExists(projectDir)).toBe(false)
    } finally {
      fs.openSync = originalOpen
      syncBuiltinESMExports()
      if (swapped) {
        unlinkSync(projectDir)
        renameSync(preserved, projectDir)
      }
    }
  })

  it("blocks a captured project-root replacement during AGENTS staging without writing outside", () => {
    const projectDir = createProject()
    const canonicalProjectDir = realpathSync(projectDir)
    const preserved = join(dirname(projectDir), `${projectDir.split("/").at(-1)}-preserved`)
    const outside = join(dirname(projectDir), `${projectDir.split("/").at(-1)}-outside`)
    mkdirSync(outside)
    const originalWrite = fs.writeFileSync
    const originalOpen = fs.openSync
    let swapped = false

    const swapProjectRoot = (): void => {
      if (swapped) return
      swapped = true
      renameSync(canonicalProjectDir, preserved)
      symlinkSync(outside, projectDir)
    }

    fs.writeFileSync = ((...args: Parameters<typeof fs.writeFileSync>) => {
      const target = args[0]
      const leaf = typeof target === "string" ? target.split("/").at(-1) : undefined
      if (!swapped && leaf?.startsWith(".AGENTS.md.")) {
        swapProjectRoot()
      }
      return originalWrite(...args)
    }) as typeof fs.writeFileSync
    fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
      const target = args[0]
      const leaf = typeof target === "string" ? target.split("/").at(-1) : undefined
      if (!swapped && leaf?.startsWith(".AGENTS.md.")) {
        swapProjectRoot()
      }
      return originalOpen(...args)
    }) as typeof fs.openSync
    syncBuiltinESMExports()
    try {
      const result = runBootstrap(projectDir)

      expect(swapped).toBe(true)
      expect(result.status).toBe(1)
      expect(fs.readdirSync(outside)).toEqual([])
      expect(`${result.stdout}${result.stderr}`).not.toContain(outside)
      expect(authorityEvidenceExists(projectDir)).toBe(false)
    } finally {
      fs.writeFileSync = originalWrite
      fs.openSync = originalOpen
      syncBuiltinESMExports()
      if (swapped && fs.lstatSync(projectDir).isSymbolicLink()) {
        unlinkSync(projectDir)
        renameSync(preserved, projectDir)
      }
      rmSync(outside, { force: true, recursive: true })
    }
  })

  it("keeps every captured bootstrap output stage inside the reserved project transaction", () => {
    expect(BOOTSTRAP_TRANSACTION_OUTPUT_MANIFEST).toEqual(expect.arrayContaining([
      ".gitignore",
      ".opencode/opencode.json",
      "AGENTS.md",
      ".persona/harness.jsonc",
      ".persona/project-profile.jsonc",
      ".persona/policies/overlay.jsonc",
      ".persona/workflow/plan.md",
      ".persona/workflow/workflow-loop-state.json",
      "temporary: .<leaf>.<uuid>.tmp",
    ]))

    for (const stage of CAPTURED_BOOTSTRAP_WRITE_STAGES) {
      const projectDir = createProject()
      expect(runBootstrap(projectDir).status).toBe(0)
      if (stage.kind === "state") {
        unlinkSync(join(projectDir, ".persona", "workflow", stage.leaf))
      }
      const canonicalProjectDir = realpathSync(projectDir)
      const preserved = join(dirname(projectDir), `${projectDir.split("/").at(-1)}-${stage.leaf}-preserved`)
      const outside = join(dirname(projectDir), `${projectDir.split("/").at(-1)}-${stage.leaf}-outside`)
      mkdirSync(outside)
      const originalOpen = fs.openSync
      let swapped = false

      fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
        const target = args[0]
        const leaf = typeof target === "string" ? target.split("/").at(-1) : undefined
        const matches = leaf === stage.leaf
          || (stage.kind === "atomic" && leaf?.startsWith(`.${stage.leaf}.`) === true)
        if (!swapped && matches) {
          swapped = true
          renameSync(canonicalProjectDir, preserved)
          symlinkSync(outside, projectDir)
        }
        return originalOpen(...args)
      }) as typeof fs.openSync
      syncBuiltinESMExports()
      try {
        const result = runBootstrap(projectDir, ["--force"])

        expect(swapped, stage.leaf).toBe(true)
        expect(result.status, stage.leaf).toBe(1)
        expect(fs.readdirSync(outside), stage.leaf).toEqual([])
        expect(`${result.stdout}${result.stderr}`, stage.leaf).not.toContain(outside)
        expect(authorityEvidenceExists(projectDir), stage.leaf).toBe(false)
      } finally {
        fs.openSync = originalOpen
        syncBuiltinESMExports()
        if (swapped && fs.lstatSync(projectDir).isSymbolicLink()) {
          unlinkSync(projectDir)
          renameSync(preserved, projectDir)
        }
        rmSync(outside, { force: true, recursive: true })
      }
    }
  })

  it("blocks root init parent and leaf aliases before fresh bootstrap writes them", () => {
    for (const relativePath of ROOT_INIT_FILES) {
      const projectDir = createProject()
      const target = join(projectDir, relativePath)
      const outside = join(projectDir, `outside-root-${relativePath.replaceAll("/", "-")}`)
      mkdirSync(dirname(target), { recursive: true })
      symlinkSync(outside, target)

      const result = runBootstrap(projectDir)

      expect(result.status).toBe(1)
      expect(existsSync(outside)).toBe(false)
      expect(fs.lstatSync(target).isSymbolicLink()).toBe(true)
      expect(`${result.stdout}${result.stderr}`).not.toContain(outside)
      expect(authorityEvidenceExists(projectDir)).toBe(false)
    }

    const projectDir = createProject()
    const parent = join(projectDir, ".opencode")
    const outside = join(projectDir, "outside-opencode-parent")
    mkdirSync(outside)
    symlinkSync(outside, parent)

    const result = runBootstrap(projectDir)

    expect(result.status).toBe(1)
    expect(fs.readdirSync(outside)).toEqual([])
    expect(`${result.stdout}${result.stderr}`).not.toContain(outside)
    expect(authorityEvidenceExists(projectDir)).toBe(false)
  })

  it("blocks a symlinked workflow parent before strict bootstrap can write any workflow artifact", () => {
    const projectDir = createProject()
    expect(runBootstrap(projectDir).status).toBe(0)
    const workflowDir = join(projectDir, ".persona", "workflow")
    const preserved = join(projectDir, ".persona", "workflow-preserved")
    const outside = join(projectDir, "outside-workflow")
    mkdirSync(outside)
    renameSync(workflowDir, preserved)
    symlinkSync(outside, workflowDir)

    const rerun = runBootstrap(projectDir)

    expect(rerun.status).toBe(1)
    expect(externalWorkflowBootstrapFiles(outside)).toEqual([])
    expect(`${rerun.stdout}${rerun.stderr}`).not.toContain(outside)
    expect(existsSync(join(preserved, "workflow-loop-state.json"))).toBe(true)
    expect(existsSync(join(preserved, "ralph-loop-state.json"))).toBe(true)
    expect(authorityEvidenceExists(projectDir)).toBe(false)
  })

  it("blocks a symlinked .persona parent before strict bootstrap writes any persona artifact", () => {
    const projectDir = createProject()
    expect(runBootstrap(projectDir).status).toBe(0)
    const personaDir = join(projectDir, ".persona")
    const preserved = join(projectDir, ".persona-preserved")
    const outside = join(projectDir, "outside-persona")
    mkdirSync(outside)
    renameSync(personaDir, preserved)
    symlinkSync(outside, personaDir)

    const rerun = runBootstrap(projectDir, ["--force"])

    expect(rerun.status).toBe(1)
    expect(externalPersonaBootstrapFiles(outside)).toEqual([])
    expect(`${rerun.stdout}${rerun.stderr}`).not.toContain(outside)
    expect(authorityEvidenceExists(projectDir)).toBe(false)
  })

  it("blocks a .persona parent replacement race before strict bootstrap opens any artifact", () => {
    const projectDir = createProject()
    expect(runBootstrap(projectDir).status).toBe(0)
    const personaDir = join(projectDir, ".persona")
    const canonicalPersonaDir = realpathSync(personaDir)
    const preserved = join(projectDir, ".persona-preserved")
    const outside = join(projectDir, "outside-persona-race")
    mkdirSync(outside)
    const originalOpen = fs.openSync
    let swapped = false

    fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
      if (!swapped && args[0] === canonicalPersonaDir) {
        swapped = true
        renameSync(personaDir, preserved)
        symlinkSync(outside, personaDir)
      }
      return originalOpen(...args)
    }) as typeof fs.openSync
    syncBuiltinESMExports()
    try {
      const rerun = runBootstrap(projectDir, ["--force"])

      expect(swapped).toBe(true)
      expect(rerun.status).toBe(1)
      expect(externalPersonaBootstrapFiles(outside)).toEqual([])
      expect(`${rerun.stdout}${rerun.stderr}`).not.toContain(outside)
      expect(authorityEvidenceExists(projectDir)).toBe(false)
    } finally {
      fs.openSync = originalOpen
      syncBuiltinESMExports()
      if (swapped) {
        unlinkSync(personaDir)
        renameSync(preserved, personaDir)
      }
    }
  })

  it("blocks every bootstrap-owned leaf alias before force bootstrap can write it", () => {
    for (const relativePath of BOOTSTRAP_ARTIFACT_PATHS) {
      const projectDir = createProject()
      expect(runBootstrap(projectDir).status).toBe(0)
      const target = join(projectDir, ".persona", relativePath)
      const outside = join(projectDir, `outside-${relativePath.replaceAll("/", "-")}`)
      unlinkSync(target)
      symlinkSync(outside, target)

      const rerun = runBootstrap(projectDir, ["--force"])

      expect(rerun.status).toBe(1)
      expect(existsSync(outside)).toBe(false)
      expect(fs.lstatSync(target).isSymbolicLink()).toBe(true)
      expect(`${rerun.stdout}${rerun.stderr}`).not.toContain(outside)
      expect(authorityEvidenceExists(projectDir)).toBe(false)
    }
  })

  it("blocks either symlinked loop-state leaf without replacing the alias", () => {
    for (const stateName of WORKFLOW_STATE_FILES) {
      const projectDir = createProject()
      expect(runBootstrap(projectDir).status).toBe(0)
      const workflowDir = join(projectDir, ".persona", "workflow")
      const statePath = join(workflowDir, stateName)
      const outside = join(projectDir, `outside-${stateName}`)
      unlinkSync(statePath)
      symlinkSync(outside, statePath)

      const rerun = runBootstrap(projectDir)

      expect(rerun.status).toBe(1)
      expect(existsSync(outside)).toBe(false)
      expect(fs.lstatSync(statePath).isSymbolicLink()).toBe(true)
      expect(`${rerun.stdout}${rerun.stderr}`).not.toContain(outside)
    }
  })

  it("blocks a workflow-parent replacement race before any bootstrap artifact is opened", () => {
    const projectDir = createProject()
    expect(runBootstrap(projectDir).status).toBe(0)
    const workflowDir = join(projectDir, ".persona", "workflow")
    const canonicalWorkflowDir = realpathSync(workflowDir)
    const preserved = join(projectDir, ".persona", "workflow-preserved")
    const outside = join(projectDir, "outside-workflow")
    mkdirSync(outside)
    const originalOpen = fs.openSync
    let swapped = false

    fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
      if (!swapped && args[0] === canonicalWorkflowDir) {
        swapped = true
        renameSync(workflowDir, preserved)
        symlinkSync(outside, workflowDir)
      }
      return originalOpen(...args)
    }) as typeof fs.openSync
    syncBuiltinESMExports()
    try {
      const rerun = runBootstrap(projectDir)

      expect(swapped).toBe(true)
      expect(rerun.status).toBe(1)
      expect(externalWorkflowBootstrapFiles(outside)).toEqual([])
      expect(`${rerun.stdout}${rerun.stderr}`).not.toContain(outside)
      expect(authorityEvidenceExists(projectDir)).toBe(false)
    } finally {
      fs.openSync = originalOpen
      syncBuiltinESMExports()
      if (swapped) {
        unlinkSync(workflowDir)
        renameSync(preserved, workflowDir)
      }
    }
  })

  it("blocks a loop-state replacement race before either existing leaf is opened", () => {
    for (const stateName of WORKFLOW_STATE_FILES) {
      const projectDir = createProject()
      expect(runBootstrap(projectDir).status).toBe(0)
      const workflowDir = join(projectDir, ".persona", "workflow")
      const statePath = join(realpathSync(workflowDir), stateName)
      const outside = join(projectDir, `outside-race-${stateName}`)
      const originalOpen = fs.openSync
      let swapped = false

      fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
        if (!swapped && args[0] === statePath) {
          swapped = true
          unlinkSync(statePath)
          symlinkSync(outside, statePath)
        }
        return originalOpen(...args)
      }) as typeof fs.openSync
      syncBuiltinESMExports()
      try {
        const rerun = runBootstrap(projectDir)

        expect(swapped).toBe(true)
        expect(rerun.status).toBe(1)
        expect(existsSync(outside)).toBe(false)
        expect(fs.lstatSync(statePath).isSymbolicLink()).toBe(true)
        expect(`${rerun.stdout}${rerun.stderr}`).not.toContain(outside)
      } finally {
        fs.openSync = originalOpen
        syncBuiltinESMExports()
      }
    }
  })

  it("blocks every workflow draft replacement race before force bootstrap can write outside", () => {
    for (const name of WORKFLOW_DRAFT_FILES) {
      const projectDir = createProject()
      expect(runBootstrap(projectDir).status).toBe(0)
      const workflowDir = join(projectDir, ".persona", "workflow")
      const target = join(realpathSync(workflowDir), name)
      const outside = join(projectDir, `outside-race-${name}`)
      const originalOpen = fs.openSync
      let swapped = false

      fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
        if (!swapped && args[0] === name) {
          swapped = true
          unlinkSync(target)
          symlinkSync(outside, target)
        }
        return originalOpen(...args)
      }) as typeof fs.openSync
      syncBuiltinESMExports()
      try {
        const rerun = runBootstrap(projectDir, ["--force"])

        expect(swapped).toBe(true)
        expect(rerun.status).toBe(1)
        expect(existsSync(outside)).toBe(false)
        expect(fs.lstatSync(target).isSymbolicLink()).toBe(true)
        expect(`${rerun.stdout}${rerun.stderr}`).not.toContain(outside)
        expect(authorityEvidenceExists(projectDir)).toBe(false)
      } finally {
        fs.openSync = originalOpen
        syncBuiltinESMExports()
      }
    }
  })

  it("blocks every persona bootstrap file replacement race before force bootstrap can write outside", () => {
    for (const relativePath of PERSONA_BOOTSTRAP_FILES) {
      const projectDir = createProject()
      expect(runBootstrap(projectDir).status).toBe(0)
      const target = join(realpathSync(join(projectDir, ".persona")), relativePath)
      const outside = join(projectDir, `outside-race-${relativePath.replaceAll("/", "-")}`)
      const originalOpen = fs.openSync
      let swapped = false
      const leaf = relativePath.split("/").at(-1)

      fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
        if (!swapped && args[0] === leaf) {
          swapped = true
          unlinkSync(target)
          symlinkSync(outside, target)
        }
        return originalOpen(...args)
      }) as typeof fs.openSync
      syncBuiltinESMExports()
      try {
        const rerun = runBootstrap(projectDir, ["--force"])

        expect(swapped).toBe(true)
        expect(rerun.status).toBe(1)
        expect(existsSync(outside)).toBe(false)
        expect(fs.lstatSync(target).isSymbolicLink()).toBe(true)
        expect(`${rerun.stdout}${rerun.stderr}`).not.toContain(outside)
        expect(authorityEvidenceExists(projectDir)).toBe(false)
      } finally {
        fs.openSync = originalOpen
        syncBuiltinESMExports()
      }
    }
  })
})

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-lifecycle-state-intake-"))
  projects.push(projectDir)
  mkdirSync(join(projectDir, "src", "main", "java"), { recursive: true })
  writeFileSync(join(projectDir, "README.md"), "# Lifecycle state intake fixture\\n")
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'lifecycle-state-intake'\\n")
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\\n")
  writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App {}\\n")
  writeFileSync(join(projectDir, "gradlew"), "#!/bin/sh\\nprintf '%s\\n' 'BUILD SUCCESSFUL'\\n")
  chmodSync(join(projectDir, "gradlew"), 0o755)
  return projectDir
}

function runBootstrap(projectDir: string, args: readonly string[] = []) {
  return runPersonaCli(["bootstrap", "backend", "--strict", "--no-developer-mcp", ...args], {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
  })
}

function externalWorkflowBootstrapFiles(directory: string): readonly string[] {
  return WORKFLOW_BOOTSTRAP_FILES.filter((name) => existsSync(join(directory, name)))
}

function externalStateFiles(directory: string): readonly string[] {
  return WORKFLOW_STATE_FILES.filter((name) => existsSync(join(directory, name)))
}

function externalPersonaBootstrapFiles(directory: string): readonly string[] {
  return [
    ...PERSONA_BOOTSTRAP_FILES.filter((path) => existsSync(join(directory, path))),
    ...WORKFLOW_BOOTSTRAP_FILES.filter((name) => existsSync(join(directory, "workflow", name))),
  ]
}

function authorityEvidenceExists(projectDir: string): boolean {
  return ["finish-attestation", "project-finish-attestation", "verification-receipts"].some((directory) =>
    existsSync(join(projectDir, ".persona", "evidence", directory)),
  )
}
