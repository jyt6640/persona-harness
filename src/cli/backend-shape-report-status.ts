import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { BACKEND_SHAPE_REPORT_PATH } from "./backend-shape.js"

export function backendShapeReportStatus(projectDir: string): string {
  const reportPath = join(projectDir, BACKEND_SHAPE_REPORT_PATH)
  if (!existsSync(reportPath)) {
    return "missing (report-only; run `npx ph review backend-shape`)"
  }

  const report = readFileSync(reportPath, "utf8")
  const warnCount = report.split(/\r?\n/).filter((line) => /\|\s*WARN\s*\|/.test(line)).length
  const failCount = report.split(/\r?\n/).filter((line) => /\|\s*FAIL\s*\|/.test(line)).length
  if (failCount > 0) {
    return `FAIL findings: ${failCount}; WARN findings: ${warnCount}; see ${BACKEND_SHAPE_REPORT_PATH}`
  }
  if (warnCount > 0) {
    return `WARN findings: ${warnCount}; see ${BACKEND_SHAPE_REPORT_PATH}`
  }
  return `PASS; see ${BACKEND_SHAPE_REPORT_PATH}`
}
