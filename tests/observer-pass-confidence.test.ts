import { describe, expect, it } from "vitest"

import { observeControllerRepositoryDependency } from "../src/observer/controller-repository-observer.js"
import { observeControllerServiceDependency } from "../src/observer/controller-service-observer.js"
import { observeControllerSqlAccess } from "../src/observer/controller-sql-observer.js"
import { observeDtoBoundary } from "../src/observer/dto-boundary-observer.js"
import { observeServiceStorageOwnership } from "../src/observer/service-storage-observer.js"

/**
 * A PASS with no confidence renders as `confidence=NONE`, which reads as "do not
 * trust this" when it only ever meant "not set". Two of the five text observers
 * did that, and it showed up on a real project as
 * `PASS service.storage-ownership … confidence=NONE`.
 *
 * MEDIUM is the established answer for an absence-based PASS: a WARN cites
 * concrete spans, a PASS records only that none were found, and a string-based
 * scan supports the second less strongly than the first.
 */
describe("every text observer states a confidence on PASS", () => {
  it("controller.sql-access", () => {
    const observation = observeControllerSqlAccess({
      filePath: "src/main/java/a/OrderController.java",
      source: "package a; public class OrderController { }",
    })

    expect(observation.finding).toBe("PASS")
    expect(observation.confidence).toBe("MEDIUM")
  })

  it("service.storage-ownership", () => {
    const observation = observeServiceStorageOwnership({
      filePath: "src/main/java/a/OrderService.java",
      source: "package a; public class OrderService { }",
    })

    expect(observation.finding).toBe("PASS")
    expect(observation.confidence).toBe("MEDIUM")
  })

  it("leaves the observers that already stated one unchanged", () => {
    // controller.service-dependency is HIGH on PASS because it cites a concrete
    // Service field or constructor parameter — a presence claim, not an absence
    // one. That distinction is the reason MEDIUM is right for the two above.
    const service = observeControllerServiceDependency({
      filePath: "src/main/java/a/OrderController.java",
      source: "package a; public class OrderController {\n  private final OrderService s;\n  public OrderController(OrderService s){ this.s = s; }\n}",
    })
    const repository = observeControllerRepositoryDependency({
      filePath: "src/main/java/a/OrderController.java",
      source: "package a; public class OrderController { }",
    })
    const dto = observeDtoBoundary({
      filePath: "src/main/java/a/OrderRequest.java",
      source: "package a; public class OrderRequest { }",
    })

    expect(service).toMatchObject({ finding: "PASS", confidence: "HIGH" })
    expect(repository).toMatchObject({ finding: "PASS", confidence: "MEDIUM" })
    expect(dto).toMatchObject({ finding: "PASS", confidence: "MEDIUM" })
  })

  it("does not weaken what a WARN reports", () => {
    // The change must not have moved the confidence of a finding that cites
    // evidence.
    const warned = observeServiceStorageOwnership({
      filePath: "src/main/java/a/OrderServiceImpl.java",
      source: [
        "package a;",
        "import java.util.HashMap;",
        "import java.util.Map;",
        "public class OrderServiceImpl {",
        "    private final Map<Long, Object> orderStore = new HashMap<>();",
        "}",
      ].join("\n"),
    })

    expect(warned).toMatchObject({ finding: "WARN", confidence: "HIGH" })
  })
})
