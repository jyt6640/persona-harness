import { describe, expect, it } from "vitest"

import { observeControllerSqlAccess } from "../src/observer/controller-sql-observer.js"
import { formatControllerSqlObserverReport } from "../src/observer/report.js"

const controllerPath = "src/main/java/com/example/reservation/ReservationController.java"

describe("Controller SQL Access observer", () => {
  it("returns PASS when a Controller depends only on a Service", () => {
    const source = `
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

    const observation = observeControllerSqlAccess({ filePath: controllerPath, source })

    expect(observation.finding).toBe("PASS")
    expect(observation.confidence).toBeUndefined()
    expect(observation.evidence.imports).toEqual([])
    expect(observation.evidence.fields).toEqual([])
    expect(observation.evidence.constructorParameters).toEqual([])
    expect(observation.evidence.methodCalls).toEqual([])
    expect(observation.evidence.sqlLiterals).toEqual([])
  })

  it("returns WARN/HIGH when a Controller imports JdbcTemplate", () => {
    const source = `
import org.springframework.jdbc.core.JdbcTemplate;

class ReservationController {
}
`

    const observation = observeControllerSqlAccess({ filePath: controllerPath, source })

    expect(observation.finding).toBe("WARN")
    expect(observation.confidence).toBe("HIGH")
    expect(observation.evidence.imports).toEqual(["import org.springframework.jdbc.core.JdbcTemplate;"])
  })

  it("returns WARN/HIGH when a Controller field has a JdbcTemplate type", () => {
    const source = `
class ReservationController {
  private final JdbcTemplate jdbcTemplate;
}
`

    const observation = observeControllerSqlAccess({ filePath: controllerPath, source })

    expect(observation.finding).toBe("WARN")
    expect(observation.confidence).toBe("HIGH")
    expect(observation.evidence.fields).toEqual(["private final JdbcTemplate jdbcTemplate;"])
  })

  it("returns WARN/HIGH when a Controller constructor parameter has a JdbcTemplate type", () => {
    const source = `
class ReservationController {
  ReservationController(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }
}
`

    const observation = observeControllerSqlAccess({ filePath: controllerPath, source })

    expect(observation.finding).toBe("WARN")
    expect(observation.confidence).toBe("HIGH")
    expect(observation.evidence.constructorParameters).toEqual(["JdbcTemplate jdbcTemplate"])
  })

  it("keeps annotation commas and lambda-like text from splitting constructor parameters", () => {
    const source = `
import java.util.function.BiFunction;

class ReservationController {
  ReservationController(
    @Qualifier(name = "primary,jdbc") JdbcTemplate jdbcTemplate,
    BiFunction<Foo, Bar, Baz> mapper,
    ReservationService service
  ) {
    String textBlock = """
      JdbcTemplate fakeTemplate,
      jdbcTemplate.update("DELETE FROM reservation")
    """;
    mapper.apply(new Foo(), new Bar());
    this.jdbcTemplate = jdbcTemplate;
  }
}
`

    const observation = observeControllerSqlAccess({ filePath: controllerPath, source })

    expect(observation.finding).toBe("WARN")
    expect(observation.confidence).toBe("HIGH")
    expect(observation.evidence.constructorParameters).toEqual(["JdbcTemplate jdbcTemplate"])
  })

  it("returns WARN/HIGH when a typed jdbcTemplate method call is found", () => {
    const source = `
class ReservationController {
  private final JdbcTemplate jdbcTemplate;

  int reserve() {
    return jdbcTemplate.update("INSERT INTO reservation VALUES (?)");
  }
}
`

    const observation = observeControllerSqlAccess({ filePath: controllerPath, source })

    expect(observation.finding).toBe("WARN")
    expect(observation.confidence).toBe("HIGH")
    expect(observation.evidence.methodCalls).toEqual(["jdbcTemplate.update("])
  })

  it("returns INFO/LOW for SQL-like literal-only evidence", () => {
    const source = `
class ReservationController {
  String queryLabel() {
    return "SELECT * FROM reservation";
  }
}
`

    const observation = observeControllerSqlAccess({ filePath: controllerPath, source })

    expect(observation.finding).toBe("INFO")
    expect(observation.confidence).toBe("LOW")
    expect(observation.evidence.sqlLiterals).toEqual(["SELECT * FROM reservation"])
  })

  it("does not exaggerate SQL-like text in comments into INFO or WARN", () => {
    const source = `
class ReservationController {
  // SELECT * FROM reservation
  private final ReservationService service;
}
`

    const observation = observeControllerSqlAccess({ filePath: controllerPath, source })

    expect(observation.finding).toBe("PASS")
    expect(observation.evidence.sqlLiterals).toEqual([])
  })

  it("returns UNKNOWN for files that are not Controller files", () => {
    const observation = observeControllerSqlAccess({
      filePath: "src/main/java/com/example/reservation/ReservationService.java",
      source: "class ReservationService {}",
    })

    expect(observation.finding).toBe("UNKNOWN")
    expect(observation.limitations).toContain("Target is not a Controller Java file.")
  })

  it("formats a report with INFO finding and without turning it into a gate", () => {
    const observation = observeControllerSqlAccess({
      filePath: controllerPath,
      source: `
class ReservationController {
  String queryLabel() {
    return "DELETE FROM reservation";
  }
}
`,
    })

    const report = formatControllerSqlObserverReport({
      runId: "unit-test",
      filePath: controllerPath,
      observation,
      nextRulePromptImprovementCandidate: false,
    })

    expect(report).toContain("# Controller SQL Access Observer Report")
    expect(report).toContain("INFO")
    expect(report).toContain("LOW")
    expect(report).toContain("sql literal: DELETE FROM reservation")
    expect(report).toContain("quality gate: no")
    expect(report).toContain("build/test failure: no")
    expect(report).toContain("next rule/prompt improvement candidate: no")
  })
})
