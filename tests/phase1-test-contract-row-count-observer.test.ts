import { describe, expect, it } from "vitest"

import { observeTestContractAnchors } from "../src/observer/test-contract-observer.js"

const testPath = "src/test/java/com/example/reservation/ReservationIntegrationTest.java"

describe("Test Contract Anchor observer row-count matcher", () => {
  it("recognizes reservation row count when countReservations helper assertions use 1L and 0L", () => {
    const source = step23SourceWith(`
    @Test
    void reservationRowsArePersistedAndDeleted() {
      assertThat(countReservations()).isEqualTo(1L);
      assertThat(countReservations()).isEqualTo(0L);
    }

    private Long countReservations() {
      return jdbcTemplate.queryForObject("select count(*) from reservation", Long.class);
    }
`)

    const observation = observeTestContractAnchors({ filePath: testPath, scenario: "step2-3", source })

    expect(observation.evidence.presentAnchors).toContain("reservation row count 1/0")
    expect(observation.evidence.missingAnchors).not.toContain("reservation row count 1/0")
    expect(["HIGH", "MEDIUM"]).toContain(observation.confidence)
  })

  it("recognizes reservation row count when a local rowCount variable is asserted with 1L and 0L", () => {
    const source = step23SourceWith(`
    @Test
    void reservationRowsArePersistedAndDeleted() {
      Long rowCount = jdbcTemplate.queryForObject("select count(*) from reservation", Long.class);
      assertThat(rowCount).isEqualTo(1L);

      Long deletedRowCount = jdbcTemplate.queryForObject("select count(*) from reservation", Long.class);
      assertThat(deletedRowCount).isEqualTo(0L);
    }
`)

    const observation = observeTestContractAnchors({ filePath: testPath, scenario: "step2-3", source })

    expect(observation.evidence.presentAnchors).toContain("reservation row count 1/0")
    expect(observation.evidence.missingAnchors).not.toContain("reservation row count 1/0")
    expect(["HIGH", "MEDIUM"]).toContain(observation.confidence)
  })

  it("does not treat unrelated count helpers as reservation row count evidence", () => {
    const source = step23SourceWith(`
    @Test
    void timeRowsArePersistedAndDeleted() {
      assertThat(countTimes()).isEqualTo(1L);
      assertThat(countTimes()).isEqualTo(0L);
    }

    private Long countTimes() {
      return jdbcTemplate.queryForObject("select count(*) from reservation_time", Long.class);
    }
`)

    const observation = observeTestContractAnchors({ filePath: testPath, scenario: "step2-3", source })

    expect(observation.evidence.presentAnchors).not.toContain("reservation row count 1/0")
    expect(observation.evidence.missingAnchors).toContain("reservation row count 1/0")
  })

  it("does not treat comments or string literals as reservation row count evidence", () => {
    const source = step23SourceWith(`
    @Test
    void commentsAndLiteralsOnly() {
      // assertThat(countReservations()).isEqualTo(1L);
      // assertThat(countReservations()).isEqualTo(0L);
      String note = "assertThat(countReservations()).isEqualTo(1L) select count(*) from reservation";
      String other = "assertThat(countReservations()).isEqualTo(0L)";
    }
`)

    const observation = observeTestContractAnchors({ filePath: testPath, scenario: "step2-3", source })

    expect(observation.evidence.presentAnchors).not.toContain("reservation row count 1/0")
    expect(observation.evidence.missingAnchors).toContain("reservation row count 1/0")
  })
})

function step23SourceWith(extraTestCode: string): string {
  return `
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

    mockMvc.perform(get("/reservations"))
      .andExpect(status().isOk());

    mockMvc.perform(delete("/reservations/1"))
      .andExpect(status().isOk());

    mockMvc.perform(delete("/times/1"))
      .andExpect(status().isOk());
  }

${extraTestCode}
}
`
}
