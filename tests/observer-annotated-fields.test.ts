import { describe, expect, it } from "vitest"

import { observeControllerRepositoryDependency } from "../src/observer/controller-repository-observer.js"
import { observeControllerServiceDependency } from "../src/observer/controller-service-observer.js"

function controller(field: string, call: string): string {
  return [
    "package com.acme.billing;",
    "",
    "@RestController",
    "public class InvoiceController {",
    `    ${field}`,
    `    public Object all() { return ${call}; }`,
    "}",
    "",
  ].join("\n")
}

describe("field scanning across annotations", () => {
  it("sees a repository behind @Autowired", () => {
    const observation = observeControllerRepositoryDependency({
      filePath: "InvoiceController.java",
      source: controller("@Autowired private InvoiceRepository invoiceRepository;", "invoiceRepository.findAll()"),
    })

    // Annotations sit before the modifier. Anchoring on the modifier alone made
    // the most common Spring shape invisible and reported a clean PASS.
    expect(observation.finding).toBe("WARN")
    expect(observation.confidence).toBe("HIGH")
    expect(observation.evidence.fields).toContain("@Autowired private InvoiceRepository invoiceRepository;")
  })

  it("sees a repository behind several annotations including one with arguments", () => {
    const observation = observeControllerRepositoryDependency({
      filePath: "InvoiceController.java",
      source: controller(
        "@Autowired @Qualifier(\"primary\") private InvoiceRepository invoiceRepository;",
        "invoiceRepository.findAll()",
      ),
    })

    expect(observation.finding).toBe("WARN")
    expect(observation.evidence.fields[0]).toContain("@Qualifier")
  })

  it("still sees a plain repository field", () => {
    const observation = observeControllerRepositoryDependency({
      filePath: "InvoiceController.java",
      source: controller("private InvoiceRepository invoiceRepository;", "invoiceRepository.findAll()"),
    })

    expect(observation.finding).toBe("WARN")
    expect(observation.confidence).toBe("HIGH")
  })

  it("sees a service behind @Autowired so the controller is not reported as service-less", () => {
    const observation = observeControllerServiceDependency({
      filePath: "InvoiceController.java",
      source: controller("@Autowired private InvoiceService invoiceService;", "invoiceService.all()"),
    })

    expect(observation.finding).toBe("PASS")
    expect(observation.evidence.fields).toContain("@Autowired private InvoiceService invoiceService;")
  })

  it("reports a controller with no repository at all as PASS", () => {
    const observation = observeControllerRepositoryDependency({
      filePath: "InvoiceController.java",
      source: controller("@Autowired private InvoiceService invoiceService;", "invoiceService.all()"),
    })

    expect(observation.finding).toBe("PASS")
    expect(observation.evidence.fields).toHaveLength(0)
  })
})
