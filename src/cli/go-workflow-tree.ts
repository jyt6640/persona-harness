import { createHash } from "node:crypto"
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs"
import { join, relative } from "node:path"

export type WorkflowTreeSnapshot = {
  readonly files: ReadonlySet<string>
  readonly fingerprint: string
}

export function workflowTreeSnapshot(
  projectDir: string,
  ignoredFiles: ReadonlySet<string> = new Set(),
): WorkflowTreeSnapshot {
  const workflowDir = join(projectDir, ".persona", "workflow")
  const files = new Set<string>()
  const hash = createHash("sha256")
  if (!existsSync(workflowDir)) {
    return { files, fingerprint: hash.update("missing").digest("hex") }
  }
  const pending = [workflowDir]
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined) {
      continue
    }
    for (const entry of readdirSync(current).sort()) {
      const path = join(current, entry)
      const relativePath = relative(projectDir, path)
      const stat = lstatSync(path)
      if (stat.isDirectory()) {
        pending.push(path)
      } else if (!ignoredFiles.has(relativePath)) {
        files.add(relativePath)
        hash.update(`${relativePath}\0`)
        hash.update(stat.isSymbolicLink() ? readlinkSync(path) : readFileSync(path))
      }
    }
  }
  return { files, fingerprint: hash.digest("hex") }
}
