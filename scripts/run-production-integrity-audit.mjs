#!/usr/bin/env node
import process from "node:process"

import {
  runProductionIntegrityAudit,
  writeProductionIntegrityAuditSummary,
} from "./production-integrity-audit-runner.mjs"

const summary = runProductionIntegrityAudit()
writeProductionIntegrityAuditSummary(process.cwd(), summary)
process.stdout.write(`Production integrity audit: ${summary.status.toUpperCase()}\n`)
process.exitCode = summary.status === "passed" ? 0 : 1
