#!/usr/bin/env node
import { realpathSync } from "node:fs"
import { pathToFileURL } from "node:url"

import {
  OBSERVER_GH_WORKFLOW_SELECTOR_STAGES,
  WorkflowObserverGhToolError,
  provisionWorkflowObserverGhTool,
} from "../../scripts/consumer-authority-observer-gh-workflow-selector.mjs"

export {
  OBSERVER_GH_WORKFLOW_SELECTOR_STAGES,
  WorkflowObserverGhToolError,
  provisionWorkflowObserverGhTool,
}

if (isDirectInvocation()) {
  const result = provisionWorkflowObserverGhTool()
  process.stdout.write(`${JSON.stringify(result)}\n`)
  if (result.state !== "ready") process.exitCode = 1
}

function isDirectInvocation() {
  if (process.argv[1] === undefined) return false
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
  } catch {
    return false
  }
}
