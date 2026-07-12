import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { candidateFromDetections, detectCorpus } from "./detector.mjs"
import { measureCandidate, validateCorpus } from "./measure.mjs"

const directory = dirname(fileURLToPath(import.meta.url))

if (isDirectExecution()) {
  main()
}

export function buildReport(corpusPath = resolve(directory, "corpus.json")) {
  const corpus = readJson(corpusPath)
  const validation = validateCorpus(corpus, dirname(corpusPath))
  const detections = detectCorpus(corpus, dirname(corpusPath))
  const candidate = candidateFromDetections(corpus, detections)
  const evaluation = measureCandidate(corpus, candidate, validation)

  return {
    boundary: corpus.boundary,
    candidate,
    corpusId: corpus.corpusId,
    decision: evaluation.decision,
    detections,
    enforcement: false,
    evaluation,
    productRuntimeInvocation: { permitted: false },
    reportOnly: true,
    schemaVersion: "p2-e1-test-integrity-report.1",
    sourceOnly: true,
  }
}

function main() {
  try {
    const report = buildReport()
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    process.exitCode = report.decision === "pass" ? 0 : 1
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`P2 E1 report-only detector error: ${message}\n`)
    process.exitCode = 1
  }
}

function readJson(filePath) {
  if (!existsSync(filePath)) throw new Error(`Missing file: ${filePath}`)
  try {
    return JSON.parse(readFileSync(filePath, "utf8"))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid JSON at ${filePath}: ${message}`)
  }
}

function isDirectExecution() {
  const invokedPath = process.argv[1]
  return typeof invokedPath === "string" && resolve(invokedPath) === fileURLToPath(import.meta.url)
}
