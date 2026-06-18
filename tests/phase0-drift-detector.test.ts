import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { detectBackendDrift } from "../src/phase0/drift-detector.js"

const sandboxes: string[] = []

afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) {
    rmSync(sandbox, { recursive: true, force: true })
  }
})

function createSandbox(): string {
  const sandbox = mkdtempSync(join(tmpdir(), "persona-drift-"))
  sandboxes.push(sandbox)
  return sandbox
}

function writeJavaFile(sandbox: string, relativePath: string, content: string): void {
  const fullPath = join(sandbox, "src", relativePath)
  const directory = fullPath.replace(/\/[^/]+$/, "")
  mkdirSync(directory, { recursive: true })
  writeFileSync(fullPath, content)
}

function detect(sandbox: string, runOutput = "") {
  return detectBackendDrift({
    sandboxDir: sandbox,
    runOutput,
    timedOut: false,
    buildSuccessDetected: false,
    testFailureDetected: runOutput.includes("BUILD FAILURE"),
  })
}

describe("Phase 0 backend drift detector", () => {
  it("detects service id state, HTTP DELETE reset, and missing repository id reset", () => {
    const sandbox = createSandbox()
    writeJavaFile(
      sandbox,
      "main/java/com/example/reservation/ReservationService.java",
      `package com.example.reservation;
class ReservationService {
  private int nextId = 1;
}`,
    )
    writeJavaFile(
      sandbox,
      "main/java/com/example/reservation/InMemoryReservationRepository.java",
      `package com.example.reservation;
import java.util.concurrent.atomic.AtomicLong;
class InMemoryReservationRepository {
  private final AtomicLong sequence = new AtomicLong(1);
  void clear() { storage.clear(); }
}`,
    )
    writeJavaFile(
      sandbox,
      "test/java/com/example/reservation/ReservationControllerTest.java",
      `class ReservationControllerTest {
  void setup() { restTemplate.delete("/reservations"); }
}`,
    )

    const kinds = detect(sandbox).findings.map((finding) => finding.kind)
    expect(kinds).toContain("Service nextId")
    expect(kinds).toContain("HTTP DELETE reset")
    expect(kinds).toContain("Repository clear id reset missing")
  })

  it("detects Spring bean, API status, controller access, and response DTO storage drift", () => {
    const sandbox = createSandbox()
    writeJavaFile(
      sandbox,
      "main/java/com/example/reservation/ReservationController.java",
      `package com.example.reservation;
class ReservationController {
  private final ReservationRepository repository;
  ResponseEntity<?> create() { return ResponseEntity.created(null).build(); }
  ResponseEntity<?> delete() { return ResponseEntity.noContent().build(); }
}`,
    )
    writeJavaFile(
      sandbox,
      "main/java/com/example/reservation/ReservationService.java",
      "package com.example.reservation; class ReservationService {}",
    )
    writeJavaFile(
      sandbox,
      "main/java/com/example/reservation/ReservationResponse.java",
      `package com.example.reservation;
import java.util.Map;
class ReservationResponse { private Map<Long, String> storage; }`,
    )

    const report = detect(sandbox, "BUILD FAILURE\nNo qualifying bean of type 'com.example.reservation.ReservationService' available")
    const kinds = report.findings.map((finding) => finding.kind)
    expect(kinds).toContain("Spring bean missing")
    expect(kinds).toContain("API status drift")
    expect(kinds).toContain("Controller repository access")
    expect(kinds).toContain("Response DTO storage usage")
  })

  it("does not flag the happy path used by the current Phase 0 target", () => {
    const sandbox = createSandbox()
    writeJavaFile(
      sandbox,
      "main/java/com/example/reservation/ReservationService.java",
      `package com.example.reservation;
@Service
class ReservationService {
  private final ReservationRepository repository;
  ReservationService(ReservationRepository repository) { this.repository = repository; }
}`,
    )
    writeJavaFile(
      sandbox,
      "main/java/com/example/reservation/InMemoryReservationRepository.java",
      `package com.example.reservation;
@Repository
class InMemoryReservationRepository implements ReservationRepository {
  private final AtomicLong sequence = new AtomicLong(0L);
  Reservation save() { return new Reservation(sequence.incrementAndGet()); }
  void clear() { storage.clear(); sequence.set(0L); }
}`,
    )
    writeJavaFile(
      sandbox,
      "main/java/com/example/reservation/ReservationRepository.java",
      "package com.example.reservation; import java.util.List; interface ReservationRepository { List<ReservationResponse> findAll(); }",
    )
    writeJavaFile(
      sandbox,
      "main/java/com/example/reservation/ReservationController.java",
      `package com.example.reservation;
import java.util.List;
class ReservationController {
  private final ReservationService service;
  public List<ReservationResponse> getReservations() { return service.getReservations(); }
}`,
    )
    writeJavaFile(
      sandbox,
      "main/java/com/example/reservation/ReservationResponse.java",
      "package com.example.reservation; class ReservationResponse { Long id; String name; String date; String time; }",
    )
    writeJavaFile(
      sandbox,
      "test/java/com/example/reservation/ReservationControllerTest.java",
      `class ReservationControllerTest {
  void test() {
    mockMvc.perform(get("/reservations"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$").isEmpty());
    mockMvc.perform(post("/reservations"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.id", is(1)))
      .andExpect(jsonPath("$.name", is("Alice")))
      .andExpect(jsonPath("$.date", is("2026-01-01")))
      .andExpect(jsonPath("$.time", is("14:00")));
    mockMvc.perform(get("/reservations"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(1))
      .andExpect(jsonPath("[0].id", is(1)));
    assertEquals(0, before.size());
  }
}`,
    )

    expect(detect(sandbox).findings).toEqual([])
  })
})
