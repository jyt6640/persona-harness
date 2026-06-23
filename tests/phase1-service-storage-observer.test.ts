import { describe, expect, it } from "vitest"

import { observeServiceStorageOwnership } from "../src/observer/service-storage-observer.js"
import { formatServiceStorageObserverReport } from "../src/observer/report.js"

const servicePath = "src/main/java/com/example/reservation/ReservationService.java"

describe("Service Storage Ownership observer", () => {
  it("returns PASS when a Service only depends on a Repository", () => {
    const source = `
class ReservationService {
  private final ReservationRepository repository;

  ReservationService(ReservationRepository repository) {
    this.repository = repository;
  }

  ReservationResponse create(ReservationRequest request) {
    return repository.save(request.toEntity());
  }
}
`

    const observation = observeServiceStorageOwnership({ filePath: servicePath, source })

    expect(observation.finding).toBe("PASS")
    expect(observation.confidence).toBeUndefined()
    expect(observation.evidence.storageFields).toEqual([])
    expect(observation.evidence.sequenceFields).toEqual([])
    expect(observation.evidence.constructorParameters).toEqual([])
    expect(observation.evidence.mutationCalls).toEqual([])
    expect(observation.evidence.literalOnly).toEqual([])
  })

  it("returns WARN/HIGH when Service fields directly own storage state", () => {
    const source = `
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

class ReservationService {
  private final Map<Long, Reservation> reservations = new HashMap<>();
  private final List<Reservation> reservationCache = new ArrayList<>();
  private final AtomicLong idCounter = new AtomicLong();
}
`

    const observation = observeServiceStorageOwnership({ filePath: servicePath, source })

    expect(observation.finding).toBe("WARN")
    expect(observation.confidence).toBe("HIGH")
    expect(observation.evidence.storageFields).toEqual([
      "private final Map<Long, Reservation> reservations =",
      "private final List<Reservation> reservationCache =",
    ])
    expect(observation.evidence.sequenceFields).toEqual(["private final AtomicLong idCounter ="])
  })

  it("returns WARN/HIGH when id sequence state is owned by Service fields or constructor init", () => {
    const source = `
class ReservationService {
  private long nextId = 1L;
  private int sequence;

  ReservationService(long idCounter) {
    this.sequence = idCounter;
  }
}
`

    const observation = observeServiceStorageOwnership({ filePath: servicePath, source })

    expect(observation.finding).toBe("WARN")
    expect(observation.confidence).toBe("HIGH")
    expect(observation.evidence.sequenceFields).toEqual(["private long nextId =", "private int sequence;"])
    expect(observation.evidence.constructorParameters).toEqual(["long idCounter"])
  })

  it("returns WARN for confirmed mutation calls on storage or sequence variables", () => {
    const source = `
class ReservationService {
  private final Map<Long, Reservation> reservations = new HashMap<>();
  private final AtomicLong sequence = new AtomicLong();

  Reservation create(Reservation reservation) {
    reservations.put(sequence.incrementAndGet(), reservation);
    reservations.remove(0L);
    reservations.clear();
    return reservation;
  }
}
`

    const observation = observeServiceStorageOwnership({ filePath: servicePath, source })

    expect(observation.finding).toBe("WARN")
    expect(["HIGH", "MEDIUM"]).toContain(observation.confidence)
    expect(observation.evidence.mutationCalls).toEqual([
      "reservations.put(",
      "sequence.incrementAndGet(",
      "reservations.remove(",
      "reservations.clear(",
    ])
  })

  it("does not exaggerate storage words in comments into WARN", () => {
    const source = `
class ReservationService {
  // Map nextId idCounter sequence put remove clear
  private final ReservationRepository repository;
}
`

    const observation = observeServiceStorageOwnership({ filePath: servicePath, source })

    expect(observation.finding).toBe("PASS")
    expect(observation.evidence.storageFields).toEqual([])
    expect(observation.evidence.sequenceFields).toEqual([])
    expect(observation.evidence.mutationCalls).toEqual([])
  })

  it("keeps literal-only storage evidence at INFO/LOW", () => {
    const source = `
class ReservationService {
  String diagnosticLabel() {
    return "nextId map storage clear";
  }
}
`

    const observation = observeServiceStorageOwnership({ filePath: servicePath, source })

    expect(observation.finding).toBe("INFO")
    expect(observation.confidence).toBe("LOW")
    expect(observation.evidence.literalOnly).toEqual(["nextId map storage clear"])
  })

  it("returns UNKNOWN for files that are not Service Java files", () => {
    const observation = observeServiceStorageOwnership({
      filePath: "src/main/java/com/example/reservation/ReservationController.java",
      source: "class ReservationController {}",
    })

    expect(observation.finding).toBe("UNKNOWN")
    expect(observation.limitations).toContain("Target is not a Service Java file.")
  })

  it("returns UNKNOWN when a Service file cannot be recognized as a Java class or record", () => {
    const observation = observeServiceStorageOwnership({
      filePath: servicePath,
      source: "not really java",
    })

    expect(observation.finding).toBe("UNKNOWN")
    expect(observation.limitations).toContain("Service Java class or record was not recognized.")
  })

  it("formats PASS/WARN/INFO/UNKNOWN and HIGH/MEDIUM/LOW confidence without turning report into a gate", () => {
    const warnObservation = observeServiceStorageOwnership({
      filePath: servicePath,
      source: `
class ReservationService {
  private final AtomicLong idCounter = new AtomicLong();
}
`,
    })
    const unknownObservation = observeServiceStorageOwnership({
      filePath: "src/main/java/com/example/reservation/ReservationController.java",
      source: "class ReservationController {}",
    })

    const warnReport = formatServiceStorageObserverReport({
      runId: "unit-test",
      filePath: servicePath,
      observation: warnObservation,
      nextGeneratedRunCandidate: true,
    })
    const infoReport = formatServiceStorageObserverReport({
      runId: "unit-test",
      filePath: servicePath,
      observation: observeServiceStorageOwnership({
        filePath: servicePath,
        source: `class ReservationService { String label() { return "sequence store"; } }`,
      }),
      nextGeneratedRunCandidate: false,
    })
    const unknownReport = formatServiceStorageObserverReport({
      runId: "unit-test",
      filePath: "src/main/java/com/example/reservation/ReservationController.java",
      observation: unknownObservation,
      nextGeneratedRunCandidate: false,
    })

    expect(warnReport).toContain("# Service Storage Ownership Observer Report")
    expect(warnReport).toContain("WARN")
    expect(warnReport).toContain("HIGH")
    expect(warnReport).toContain("sequence field: private final AtomicLong idCounter =")
    expect(warnReport).toContain("quality gate: no")
    expect(warnReport).toContain("build/test failure: no")
    expect(warnReport).toContain("next generated run candidate: yes")
    expect(infoReport).toContain("INFO")
    expect(infoReport).toContain("LOW")
    expect(unknownReport).toContain("UNKNOWN")
  })
})
