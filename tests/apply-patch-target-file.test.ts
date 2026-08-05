import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import { OBSERVER_OUTPUT_MARKER } from "../src/runtime/observer-report-only.js"
import { extractTargetFile } from "../src/runtime/target-file.js"

const tempProjects: string[] = []

afterEach(() => {
  while (tempProjects.length > 0) {
    const projectDir = tempProjects.pop()
    if (projectDir !== undefined) {
      rmSync(projectDir, { recursive: true, force: true })
    }
  }
})

function codexPatch(path: string): string {
  return [
    "*** Begin Patch",
    `*** Update File: ${path}`,
    "@@",
    "-    private OrderRepository orderRepository;",
    "+    private OrderRepository orderRepository; // touched",
    "*** End Patch",
    "",
  ].join("\n")
}

describe("apply_patch target extraction", () => {
  it("reads the target out of a Codex apply_patch body", () => {
    const target = extractTargetFile("apply_patch", {
      patchText: codexPatch("src/main/java/com/example/OrderController.java"),
    })

    expect(target).toBe("src/main/java/com/example/OrderController.java")
  })

  it("reads the target out of a unified diff body", () => {
    const target = extractTargetFile("apply_patch", {
      patchText: ["--- a/src/main/java/Foo.java", "+++ b/src/main/java/Foo.java", "@@", "+x", ""].join("\n"),
    })

    expect(target).toBe("src/main/java/Foo.java")
  })

  it("prefers the Java source when one patch touches several files", () => {
    const target = extractTargetFile("apply_patch", {
      patchText: [
        "*** Begin Patch",
        "*** Update File: build.gradle",
        "*** Update File: src/main/java/com/example/Order.java",
        "*** End Patch",
        "",
      ].join("\n"),
    })

    expect(target).toBe("src/main/java/com/example/Order.java")
  })

  it("ignores /dev/null delete markers", () => {
    const target = extractTargetFile("apply_patch", {
      patchText: ["--- a/src/main/java/Gone.java", "+++ /dev/null", ""].join("\n"),
    })

    expect(target).toBe("src/main/java/Gone.java")
  })

  it("does not treat a shell command as a file target", () => {
    expect(extractTargetFile("bash", { command: "ls -a", workdir: "/tmp" })).toBeUndefined()
  })

  it("surfaces observer findings for a file edited through apply_patch", async () => {
    const projectDir = mkdtempSync(join(tmpdir(), "persona-apply-patch-test-"))
    tempProjects.push(projectDir)
    mkdirSync(join(projectDir, ".persona"), { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "harness.jsonc"),
      `${JSON.stringify({
        features: { runtimeInjection: false, observerFindings: true },
        enabledDomains: ["backend", "programming", "workflow"],
      }, null, 2)}\n`,
    )
    const javaDir = join(projectDir, "src", "main", "java", "com", "example")
    mkdirSync(javaDir, { recursive: true })
    const relativePath = "src/main/java/com/example/OrderController.java"
    writeFileSync(
      join(javaDir, "OrderController.java"),
      [
        "package com.example;",
        "",
        "class OrderController {",
        "    private OrderRepository orderRepository;",
        "    Object all() { return orderRepository.findAll(); }",
        "}",
        "",
      ].join("\n"),
    )

    const hooks = createPhase0Hooks({ projectDir })
    const output = { title: "apply_patch", output: "ok", metadata: {} }
    await hooks["tool.execute.after"]?.(
      {
        tool: "apply_patch",
        sessionID: "session-apply-patch",
        callID: "call-apply-patch",
        args: { patchText: codexPatch(relativePath) },
      },
      output,
    )

    // Codex-family models carry no path argument, so before the patch-body
    // extraction this write was invisible to every runtime observer.
    expect(output.output).toContain(OBSERVER_OUTPUT_MARKER)
    expect(output.output).toContain("controller.repository-dependency")
  })
})
