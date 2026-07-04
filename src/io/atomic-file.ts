import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import process from "node:process"

export type WriteFileAtomicOptions = {
  readonly encoding?: BufferEncoding
}

function atomicTempPath(targetPath: string): string {
  const dir = dirname(targetPath)
  const safeName = basename(targetPath).replace(/[^a-zA-Z0-9._-]/gu, "_")
  return join(dir, `.${safeName}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`)
}

export function writeFileAtomic(targetPath: string, data: string, options: WriteFileAtomicOptions = {}): void {
  const dir = dirname(targetPath)
  mkdirSync(dir, { recursive: true })
  const tempPath = atomicTempPath(targetPath)
  try {
    writeFileSync(tempPath, data, options.encoding ?? "utf8")
    renameSync(tempPath, targetPath)
  } finally {
    if (existsSync(tempPath)) {
      rmSync(tempPath, { force: true })
    }
  }
}
