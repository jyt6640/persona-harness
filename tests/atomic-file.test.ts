import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { writeFileAtomic } from "../src/io/atomic-file.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "persona-atomic-file-test-"))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe("writeFileAtomic", () => {
  it("writes through a same-directory temporary file and leaves no temp file after rename", () => {
    const projectDir = createTempDir()
    const targetPath = join(projectDir, ".persona", "workflow", "state.json")

    writeFileAtomic(targetPath, "{\"ok\":true}\n")

    expect(readFileSync(targetPath, "utf8")).toBe("{\"ok\":true}\n")
    expect(readdirSync(join(projectDir, ".persona", "workflow")).filter((entry) => entry.endsWith(".tmp"))).toEqual([])
  })

  it("creates the target directory before writing", () => {
    const projectDir = createTempDir()
    const targetPath = join(projectDir, "nested", "dir", "file.txt")

    writeFileAtomic(targetPath, "hello\n")

    expect(existsSync(targetPath)).toBe(true)
  })
})
