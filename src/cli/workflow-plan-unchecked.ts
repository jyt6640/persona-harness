import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { PLAN_PATH } from "./plan.js"

export function planUncheckedItems(projectDir: string): readonly string[] {
  const planPath = join(projectDir, PLAN_PATH)
  if (!existsSync(planPath)) {
    return []
  }
  return readFileSync(planPath, "utf8")
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = /^-\s*\[\s\]\s+(.+)$/.exec(line)
      return match?.[1] === undefined ? [] : [`- ${match[1]}`]
    })
}
