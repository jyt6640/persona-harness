import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { observeTestContractAnchors } from "../dist/observer/test-contract-observer.js"
import {
  defaultTestContractObserverReportPath,
  writeTestContractObserverReport,
} from "../dist/observer/report.js"

const fixturePath = join(
  ".persona-test-fixtures",
  "phase-next",
  "src",
  "test",
  "java",
  "com",
  "example",
  "reservation",
  "ReservationIntegrationTest.java",
)

const fixtureSource = `package com.example.reservation;

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

    mockMvc.perform(get("/reservations")).andExpect(status().isOk());
    mockMvc.perform(delete("/reservations/1")).andExpect(status().isOk());
    assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM reservation", Integer.class)).isEqualTo(0);
    mockMvc.perform(delete("/times/1")).andExpect(status().isOk());
  }
}
`

mkdirSync(dirname(fixturePath), { recursive: true })
writeFileSync(fixturePath, fixtureSource)

const observation = observeTestContractAnchors({
  filePath: fixturePath,
  scenario: "step2-3",
  source: fixtureSource,
})

writeTestContractObserverReport({
  outputPath: defaultTestContractObserverReportPath,
  runId: "test-contract-smoke",
  filePath: fixturePath,
  observation,
  nextGeneratedRunCandidate: observation.finding === "WARN",
})

console.log(`Test contract anchor observer smoke finding: ${observation.finding}`)
console.log(`Test contract anchor observer report: ${defaultTestContractObserverReportPath}`)
