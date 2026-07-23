import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { rulePackContentHash } from "../../src/rules/rule-delivery.js"

export function writeCurrentWorkflowLifecycleLoopStates(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  const workflowStatePath = join(projectDir, ".persona", "workflow", "workflow-loop-state.json")
  if (!existsSync(workflowStatePath)) {
    writeFileSync(
      workflowStatePath,
      `${JSON.stringify({
        finalDecision: "not-run",
        iterations: [],
        rulePackHash: rulePackContentHash(projectDir),
        schemaVersion: "workflow-loop-state.2",
        startedAt: "2026-07-01T00:00:00.000Z",
      }, null, 2)}\n`,
    )
  }
  const ralphStatePath = join(projectDir, ".persona", "workflow", "ralph-loop-state.json")
  if (!existsSync(ralphStatePath)) {
    writeFileSync(
      ralphStatePath,
      `${JSON.stringify({
        schemaVersion: "workflow-ralph-loop-state.1",
        sessions: {},
        updatedAt: "2026-07-01T00:00:00.000Z",
      }, null, 2)}\n`,
    )
  }
}
