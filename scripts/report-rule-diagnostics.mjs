import { resolve } from "node:path"

import {
  defaultRuleDiagnosticsReportPath,
  writeRuleDiagnosticsReport,
} from "../dist/rules/rule-diagnostics-report.js"

const projectDir = process.argv[2] === undefined ? process.cwd() : resolve(process.argv[2])
const outputPath = process.argv[3] === undefined ? defaultRuleDiagnosticsReportPath(projectDir) : resolve(process.argv[3])
const summary = writeRuleDiagnosticsReport(projectDir, outputPath)

console.log(`PersonaHarnessRule diagnostics finding: ${summary.finding}`)
console.log(`PersonaHarnessRule diagnostics count: ${summary.diagnosticCount}`)
console.log(`PersonaHarnessRule diagnostics report: ${outputPath}`)
