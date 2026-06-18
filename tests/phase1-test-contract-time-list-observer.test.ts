import { describe, expect, it } from "vitest"

import { observeTestContractAnchors } from "../src/phase1/observer/test-contract-observer.js"

const testPath = "src/test/java/com/example/reservation/ReservationIntegrationTest.java"
const timeListAnchor = "reservation_time table or time list size 1"

describe("Test Contract Anchor observer time-list matcher", () => {
  it("recognizes jsonPath length value 1 near GET /times as time list size 1", () => {
    const source = step23SourceWithTimeListAssertion(`
    mockMvc.perform(get("/times"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(1));
`)

    const observation = observeTestContractAnchors({ filePath: testPath, scenario: "step2-3", source })

    expect(observation.evidence.presentAnchors).toContain(timeListAnchor)
    expect(observation.evidence.missingAnchors).not.toContain(timeListAnchor)
    expect(observation.evidence.evidence).toContain("time list length 1")
  })

  it("recognizes jsonPath length value 1 inside a time API test block", () => {
    const source = step23SourceWithTimeListAssertion(`
    @Test
    void manageTimes() throws Exception {
      mockMvc.perform(get("/times"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1));
    }
`)

    const observation = observeTestContractAnchors({ filePath: testPath, scenario: "step2-3", source })

    expect(observation.evidence.presentAnchors).toContain(timeListAnchor)
    expect(observation.evidence.missingAnchors).not.toContain(timeListAnchor)
  })

  it("does not treat jsonPath length value 1 near GET /reservations as a time list anchor", () => {
    const source = step23SourceWithTimeListAssertion(`
    mockMvc.perform(get("/times"))
      .andExpect(status().isOk());

    mockMvc.perform(get("/reservations"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(1));
`)

    const observation = observeTestContractAnchors({ filePath: testPath, scenario: "step2-3", source })

    expect(observation.evidence.presentAnchors).not.toContain(timeListAnchor)
    expect(observation.evidence.missingAnchors).toContain(timeListAnchor)
  })

  it("does not treat comments or string literals as time list anchor evidence", () => {
    const source = step23SourceWithTimeListAssertion(`
    mockMvc.perform(get("/times"))
      .andExpect(status().isOk());

    // mockMvc.perform(get("/times")).andExpect(jsonPath("$.length()").value(1));
    String note = "jsonPath(\\"$.length()\\").value(1)";
`)

    const observation = observeTestContractAnchors({ filePath: testPath, scenario: "step2-3", source })

    expect(observation.evidence.presentAnchors).not.toContain(timeListAnchor)
    expect(observation.evidence.missingAnchors).toContain(timeListAnchor)
  })

  it("keeps existing hasSize(1) based time-list anchor behavior", () => {
    const source = step23SourceWithTimeListAssertion(`
    mockMvc.perform(get("/times"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$", hasSize(1)));
`)

    const observation = observeTestContractAnchors({ filePath: testPath, scenario: "step2-3", source })

    expect(observation.evidence.presentAnchors).toContain(timeListAnchor)
    expect(observation.evidence.missingAnchors).not.toContain(timeListAnchor)
  })

  it("keeps existing row-count helper matcher behavior", () => {
    const source = step23SourceWithTimeListAssertion(`
    mockMvc.perform(get("/times"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$", hasSize(1)));
`)

    const observation = observeTestContractAnchors({ filePath: testPath, scenario: "step2-3", source })

    expect(observation.evidence.presentAnchors).toContain("reservation row count 1/0")
    expect(observation.evidence.missingAnchors).not.toContain("reservation row count 1/0")
  })
})

function step23SourceWithTimeListAssertion(timeListAssertion: string): string {
  return `
class ReservationIntegrationTest {
  @Test
  void reservationAndTimeCrud() throws Exception {
    mockMvc.perform(post("/times").content("{\\"startAt\\":\\"10:00\\"}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.id").value(1))
      .andExpect(jsonPath("$.startAt").value("10:00"));

${timeListAssertion}

    mockMvc.perform(post("/reservations")
      .content("{\\"name\\":\\"브라운\\",\\"date\\":\\"2026-06-18\\",\\"timeId\\":1}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.time.id").value(1))
      .andExpect(jsonPath("$.time.startAt").value("10:00"));

    mockMvc.perform(get("/reservations"))
      .andExpect(status().isOk());

    mockMvc.perform(delete("/reservations/1"))
      .andExpect(status().isOk());

    mockMvc.perform(delete("/times/1"))
      .andExpect(status().isOk());

    assertThat(countReservations()).isEqualTo(1L);
    assertThat(countReservations()).isEqualTo(0L);
  }

  private Long countReservations() {
    return jdbcTemplate.queryForObject("select count(*) from reservation", Long.class);
  }
}
`
}
