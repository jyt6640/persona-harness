import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { observeControllerRepositoryDependency } from "../dist/observer/controller-repository-observer.js"
import { defaultPhase12ObserverReportPath, writeObserverReport } from "../dist/observer/report.js"

const fixturePath = join(
  ".persona-test-fixtures",
  "phase1-2",
  "src",
  "main",
  "java",
  "com",
  "example",
  "reservation",
  "ReservationController.java",
)

const fixtureSource = `package com.example.reservation;

class ReservationController {
  private final ReservationRepository repository;

  ReservationController(ReservationRepository repository) {
    this.repository = repository;
  }

  ReservationResponse find(long id) {
    return repository.findById(id);
  }
}
`

mkdirSync(dirname(fixturePath), { recursive: true })
writeFileSync(fixturePath, fixtureSource)

const observation = observeControllerRepositoryDependency({
  filePath: fixturePath,
  source: fixtureSource,
})

writeObserverReport({
  outputPath: defaultPhase12ObserverReportPath,
  runId: "phase1-2-smoke",
  filePath: fixturePath,
  observation,
  nextRulePromptImprovementCandidate: observation.finding === "WARN",
})

console.log(`Phase 1.2 observer smoke finding: ${observation.finding}`)
console.log(`Phase 1.2 observer report: ${defaultPhase12ObserverReportPath}`)
