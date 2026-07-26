import { existsSync } from "node:fs"
import { join } from "node:path"

import { writeWorkflowLoopState } from "../../src/cli/workflow-loop-state.js"
import { rulePackContentHash } from "../../src/rules/rule-delivery.js"
import { emptyRalphLoopState, writeRalphLoopState } from "../../src/runtime/ralph-loop-state.js"

export function writeCurrentWorkflowLifecycleLoopStates(projectDir: string): void {
  const workflowStatePath = join(projectDir, ".persona", "workflow", "workflow-loop-state.json")
  if (!existsSync(workflowStatePath)) {
    writeWorkflowLoopState(projectDir, {
      finalDecision: "not-run",
      iterations: [],
      rulePackHash: rulePackContentHash(projectDir),
      schemaVersion: "workflow-loop-state.2",
      startedAt: "2026-07-01T00:00:00.000Z",
    })
  }
  const ralphStatePath = join(projectDir, ".persona", "workflow", "ralph-loop-state.json")
  if (!existsSync(ralphStatePath)) {
    if (!writeRalphLoopState(projectDir, emptyRalphLoopState("2026-07-01T00:00:00.000Z"))) {
      throw new Error("workflow lifecycle state fixture setup failed")
    }
  }
}
