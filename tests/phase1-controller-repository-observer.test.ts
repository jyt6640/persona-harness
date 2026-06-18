import { describe, expect, it } from "vitest"

import { observeControllerRepositoryDependency } from "../src/phase1/observer/controller-repository-observer.js"
import { formatObserverReport } from "../src/phase1/observer/report.js"

const controllerPath = "src/main/java/com/example/reservation/ReservationController.java"

describe("Phase 1.2 Controller direct Repository dependency observer", () => {
  it("returns PASS when a Controller depends only on a Service", () => {
    const source = `
package com.example.reservation;

import com.example.reservation.ReservationService;

class ReservationController {
  private final ReservationService service;

  ReservationController(ReservationService service) {
    this.service = service;
  }

  ReservationResponse create(ReservationRequest request) {
    return service.create(request);
  }
}
`

    const observation = observeControllerRepositoryDependency({ filePath: controllerPath, source })

    expect(observation.finding).toBe("PASS")
    expect(observation.evidence.imports).toEqual([])
    expect(observation.evidence.fields).toEqual([])
    expect(observation.evidence.constructorParameters).toEqual([])
    expect(observation.evidence.methodCalls).toEqual([])
  })

  it("returns WARN when a Controller imports a Repository", () => {
    const source = `
package com.example.reservation;

import com.example.reservation.ReservationRepository;

class ReservationController {
  private final ReservationService service;
}
`

    const observation = observeControllerRepositoryDependency({ filePath: controllerPath, source })

    expect(observation.finding).toBe("WARN")
    expect(observation.evidence.imports).toEqual(["import com.example.reservation.ReservationRepository;"])
  })

  it("returns WARN when a Controller field has a Repository type", () => {
    const source = `
package com.example.reservation;

class ReservationController {
  private final ReservationRepository repository;
}
`

    const observation = observeControllerRepositoryDependency({ filePath: controllerPath, source })

    expect(observation.finding).toBe("WARN")
    expect(observation.evidence.fields).toEqual(["private final ReservationRepository repository;"])
  })

  it("returns WARN when a Controller constructor parameter has a Repository type", () => {
    const source = `
package com.example.reservation;

class ReservationController {
  ReservationController(ReservationRepository repository) {
    this.repository = repository;
  }
}
`

    const observation = observeControllerRepositoryDependency({ filePath: controllerPath, source })

    expect(observation.finding).toBe("WARN")
    expect(observation.evidence.constructorParameters).toEqual(["ReservationRepository repository"])
  })

  it("returns WARN when a Controller method directly calls a repository variable", () => {
    const source = `
package com.example.reservation;

class ReservationController {
  private final ReservationRepository reservationRepository;

  ReservationController(ReservationRepository reservationRepository) {
    this.reservationRepository = reservationRepository;
  }

  ReservationResponse find(long id) {
    return reservationRepository.findById(id);
  }
}
`

    const observation = observeControllerRepositoryDependency({ filePath: controllerPath, source })

    expect(observation.finding).toBe("WARN")
    expect(observation.evidence.methodCalls).toEqual(["reservationRepository.findById("])
  })

  it("does not exaggerate Repository mentions inside comments into WARN", () => {
    const source = `
package com.example.reservation;

class ReservationController {
  // Repository should stay behind the service.
  private final ReservationService service;
}
`

    const observation = observeControllerRepositoryDependency({ filePath: controllerPath, source })

    expect(observation.finding).toBe("PASS")
  })

  it("does not exaggerate Repository mentions inside string literals into WARN", () => {
    const source = `
package com.example.reservation;

class ReservationController {
  private final ReservationService service;

  String label() {
    return "Repository is not injected here";
  }
}
`

    const observation = observeControllerRepositoryDependency({ filePath: controllerPath, source })

    expect(observation.finding).toBe("PASS")
  })

  it("returns UNKNOWN for files that are not Controller files", () => {
    const observation = observeControllerRepositoryDependency({
      filePath: "src/main/java/com/example/reservation/ReservationService.java",
      source: "class ReservationService {}",
    })

    expect(observation.finding).toBe("UNKNOWN")
    expect(observation.limitations).toContain("Target is not a Controller Java file.")
  })

  it("formats a report without turning WARN into a gate", () => {
    const observation = observeControllerRepositoryDependency({
      filePath: controllerPath,
      source: `
class ReservationController {
  private final ReservationRepository repository;
}
`,
    })

    const report = formatObserverReport({
      runId: "unit-test",
      filePath: controllerPath,
      observation,
      nextRulePromptImprovementCandidate: true,
    })

    expect(report).toContain("# Phase 1.2 Observer Report")
    expect(report).toContain("WARN")
    expect(report).toContain("quality gate: no")
    expect(report).toContain("build/test failure: no")
    expect(report).toContain("private final ReservationRepository repository;")
  })
})
