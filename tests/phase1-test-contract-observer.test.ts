import { describe, expect, it } from "vitest"

import { formatTestContractObserverReport } from "../src/observer/report.js"
import { observeTestContractAnchors } from "../src/observer/test-contract-observer.js"

const testPath = "src/test/java/com/example/reservation/ReservationIntegrationTest.java"

describe("Test Contract Anchor observer", () => {
  it("returns PASS/HIGH when step1 test contains reservation route, status, id, count, and body anchors", () => {
    const source = `
class ReservationIntegrationTest {
  @Test
  void reservationCrud() throws Exception {
    mockMvc.perform(get("/reservations"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$", hasSize(0)));

    mockMvc.perform(post("/reservations")
      .content("{\\"name\\":\\"브라운\\",\\"date\\":\\"2026-06-18\\",\\"time\\":\\"10:00\\"}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.id").value(1));

    mockMvc.perform(get("/reservations"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$", hasSize(1)));

    mockMvc.perform(delete("/reservations/1"))
      .andExpect(status().isOk());

    mockMvc.perform(get("/reservations"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$", hasSize(0)));
  }
}
`

    const observation = observeTestContractAnchors({ filePath: testPath, scenario: "step1", source })

    expect(observation.finding).toBe("PASS")
    expect(observation.confidence).toBe("HIGH")
    expect(observation.evidence.presentAnchors).toContain("GET /reservations")
    expect(observation.evidence.presentAnchors).toContain("POST /reservations")
    expect(observation.evidence.presentAnchors).toContain("DELETE /reservations/{id}")
    expect(observation.evidence.presentAnchors).toContain("200 OK")
    expect(observation.evidence.presentAnchors).toContain("id = 1")
    expect(observation.evidence.presentAnchors).toContain("list size 0/1/0")
    expect(observation.evidence.presentAnchors).toContain("request body name/date/time")
    expect(observation.evidence.missingAnchors).toEqual([])
  })

  it("returns WARN when step1 POST or DELETE status anchors are missing", () => {
    const source = `
class ReservationIntegrationTest {
  @Test
  void reservationCrud() throws Exception {
    mockMvc.perform(get("/reservations"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$", hasSize(0)));

    mockMvc.perform(post("/reservations")
      .content("{\\"name\\":\\"브라운\\",\\"date\\":\\"2026-06-18\\",\\"time\\":\\"10:00\\"}"))
      .andExpect(jsonPath("$.id").value(1));

    mockMvc.perform(get("/reservations"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$", hasSize(1)));

    mockMvc.perform(delete("/reservations/1"));
  }
}
`

    const observation = observeTestContractAnchors({ filePath: testPath, scenario: "step1", source })

    expect(observation.finding).toBe("WARN")
    expect(["HIGH", "MEDIUM"]).toContain(observation.confidence)
    expect(observation.evidence.missingAnchors).toContain("POST /reservations 200 OK")
    expect(observation.evidence.missingAnchors).toContain("DELETE /reservations/{id} 200 OK")
    expect(observation.limitations).toContain("WARN is a missing-anchor report-only signal, not a test-quality verdict.")
  })

  it("returns PASS/HIGH when step2-3 test contains reservation, time, body, response, and count anchors", () => {
    const source = `
class ReservationIntegrationTest {
  @Test
  void reservationAndTimeCrud() throws Exception {
    mockMvc.perform(post("/times").content("{\\"startAt\\":\\"10:00\\"}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.id").value(1))
      .andExpect(jsonPath("$.startAt").value("10:00"));

    mockMvc.perform(get("/times"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$", hasSize(1)));

    mockMvc.perform(post("/reservations")
      .content("{\\"name\\":\\"브라운\\",\\"date\\":\\"2026-06-18\\",\\"timeId\\":1}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.time.id").value(1))
      .andExpect(jsonPath("$.time.startAt").value("10:00"));

    assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM reservation", Integer.class)).isEqualTo(1);
    assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM reservation_time", Integer.class)).isEqualTo(1);

    mockMvc.perform(get("/reservations"))
      .andExpect(status().isOk());

    mockMvc.perform(delete("/reservations/1"))
      .andExpect(status().isOk());
    assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM reservation", Integer.class)).isEqualTo(0);

    mockMvc.perform(delete("/times/1"))
      .andExpect(status().isOk());
  }
}
`

    const observation = observeTestContractAnchors({ filePath: testPath, scenario: "step2-3", source })

    expect(observation.finding).toBe("PASS")
    expect(observation.confidence).toBe("HIGH")
    expect(observation.evidence.presentAnchors).toContain("POST /times")
    expect(observation.evidence.presentAnchors).toContain("GET /times")
    expect(observation.evidence.presentAnchors).toContain("DELETE /times/{id}")
    expect(observation.evidence.presentAnchors).toContain("request body name/date/timeId")
    expect(observation.evidence.presentAnchors).toContain("request body startAt")
    expect(observation.evidence.presentAnchors).toContain("reservation response time object")
    expect(observation.evidence.presentAnchors).toContain("reservation row count 1/0")
    expect(observation.evidence.presentAnchors).toContain("reservation_time table or time list size 1")
    expect(observation.evidence.missingAnchors).toEqual([])
  })

  it("returns WARN when step2-3 timeId or secondary collection anchors are missing", () => {
    const source = `
class ReservationIntegrationTest {
  @Test
  void reservationCrud() throws Exception {
    mockMvc.perform(post("/reservations")
      .content("{\\"name\\":\\"브라운\\",\\"date\\":\\"2026-06-18\\",\\"time\\":\\"10:00\\"}"))
      .andExpect(status().isOk());

    mockMvc.perform(get("/reservations"))
      .andExpect(status().isOk());

    mockMvc.perform(delete("/reservations/1"))
      .andExpect(status().isOk());
  }
}
`

    const observation = observeTestContractAnchors({ filePath: testPath, scenario: "step2-3", source })

    expect(observation.finding).toBe("WARN")
    expect(observation.evidence.missingAnchors).toContain("POST /related-resources")
    expect(observation.evidence.missingAnchors).toContain("GET /related-resources")
    expect(observation.evidence.missingAnchors).toContain("DELETE /related-resources/{id}")
    expect(observation.evidence.missingAnchors).toContain("request body name/date/timeId")
  })

  it("lowers confidence when anchors are only visible through helper methods or constants", () => {
    const source = `
class ReservationIntegrationTest {
  private static final String RESERVATIONS = "/reservations";

  @Test
  void reservationCrud() throws Exception {
    assertOk(get(RESERVATIONS));
    assertOk(post(RESERVATIONS));
    assertOk(delete(RESERVATIONS + "/1"));
    assertBodyFields("name", "date", "time");
    assertCreatedId(1);
    assertListTransition(0, 1, 0);
  }
}
`

    const observation = observeTestContractAnchors({ filePath: testPath, scenario: "step1", source })

    expect(observation.finding).toBe("PASS")
    expect(["MEDIUM", "LOW"]).toContain(observation.confidence)
    expect(observation.evidence.evidence).toContain("constant/helper: RESERVATIONS")
    expect(observation.evidence.evidence).toContain("helper: assertOk(")
  })

  it("returns UNKNOWN for targets that are not Java/Spring generated test files", () => {
    const observation = observeTestContractAnchors({
      filePath: "src/main/java/com/example/reservation/ReservationController.java",
      scenario: "step1",
      source: "class ReservationController {}",
    })

    expect(observation.finding).toBe("UNKNOWN")
    expect(observation.confidence).toBeUndefined()
    expect(observation.limitations).toContain("Target is not a Java/Spring generated test file.")
  })

  it("formats a report without turning WARN into a quality gate", () => {
    const observation = observeTestContractAnchors({
      filePath: testPath,
      scenario: "step2-3",
      source: `
class ReservationIntegrationTest {
  @Test
  void reservationCrud() throws Exception {
    mockMvc.perform(get("/reservations")).andExpect(status().isOk());
  }
}
`,
    })

    const report = formatTestContractObserverReport({
      runId: "unit-test",
      filePath: testPath,
      observation,
      nextGeneratedRunCandidate: true,
    })

    expect(report).toContain("# Test Contract Anchor Observer Report")
    expect(report).toContain("Scenario")
    expect(report).toContain("step2-3")
    expect(report).toContain("WARN")
    expect(report).toContain("missing-anchor report-only signal")
    expect(report).toContain("quality gate: no")
    expect(report).toContain("build/test failure: no")
    expect(report).toContain("next generated run candidate: yes")
  })
})
