import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { measureEntryIntentCorpus } from "../../dist/runtime/entry-intent-detector.js"

const directory = dirname(fileURLToPath(import.meta.url))
const corpus = JSON.parse(readFileSync(join(directory, "corpus.json"), "utf8"))
const metrics = measureEntryIntentCorpus(corpus.records, corpus.preregistration)

process.stdout.write(`${JSON.stringify({
  schemaVersion: "entry-intent-measurement.1",
  corpusSchemaVersion: corpus.schemaVersion,
  preregistration: corpus.preregistration,
  metrics,
  boundary: "Corpus-only deterministic detector measurement; not product efficacy evidence.",
}, null, 2)}\n`)

process.exitCode = metrics.decision === "pass" ? 0 : 1
