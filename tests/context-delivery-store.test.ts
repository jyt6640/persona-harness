import { describe, expect, it } from "vitest"
import { ContextDeliveryStore, MAX_TRACKED_CONTEXT_SESSIONS } from "../src/context-delivery/context-delivery-store.js"
import { MAX_CONTEXT_TARGETS } from "../src/context-delivery/context-tool-targets.js"

describe("pending Context target store", () => {
  it("unions duplicate and distinct observations without retaining rule bodies", () => {
    const store = new ContextDeliveryStore()
    store.observe("session", { kind: "targets", paths: ["b.java", "a.java"] })
    store.observe("session", { kind: "targets", paths: ["a.java", "c.java"] })
    expect(store.take("session")).toEqual({ kind: "targets", paths: ["a.java", "b.java", "c.java"] })
    expect(store.take("session")).toBeUndefined()
  })

  it("blocks an entire overflowing batch until it is consumed", () => {
    const store = new ContextDeliveryStore()
    store.observe("session", { kind: "targets", paths: Array.from({ length: MAX_CONTEXT_TARGETS }, (_, i) => `${i}.java`) })
    expect(store.observe("session", { kind: "targets", paths: ["extra.java"] })).toEqual({ kind: "blocked", reason: "target-limit" })
    store.observe("session", { kind: "targets", paths: ["safe.java"] })
    expect(store.take("session")).toEqual({ kind: "blocked", reason: "target-limit" })
    expect(store.observe("session", { kind: "targets", paths: ["safe.java"] })).toEqual({ kind: "targets", paths: ["safe.java"] })
  })

  it("does not evict an existing batch to admit another session", () => {
    const store = new ContextDeliveryStore()
    for (let i = 0; i < MAX_TRACKED_CONTEXT_SESSIONS; i += 1) store.observe(`session-${i}`, { kind: "targets", paths: [`${i}.java`] })
    expect(store.observe("overflow", { kind: "targets", paths: ["new.java"] })).toEqual({ kind: "blocked", reason: "session-limit" })
    expect(store.take("session-0")).toEqual({ kind: "targets", paths: ["0.java"] })
    expect(store.observe("overflow", { kind: "targets", paths: ["later.java"] })).toEqual({ kind: "blocked", reason: "session-limit" })
    expect(store.take("overflow")).toEqual({ kind: "blocked", reason: "session-limit" })
  })

  it("preserves admitted batches but cannot forget untracked overflow after clearing sessions", () => {
    const store = new ContextDeliveryStore()
    for (let i = 0; i < MAX_TRACKED_CONTEXT_SESSIONS; i += 1) store.observe(`session-${i}`, { kind: "targets", paths: [`${i}.java`] })
    store.observe("overflow", { kind: "targets", paths: ["first.java"] })
    store.clear("session-0")
    store.clear("overflow")
    expect(store.take("session-1")).toEqual({ kind: "targets", paths: ["1.java"] })
    expect(store.take("overflow")).toEqual({ kind: "blocked", reason: "session-limit" })
    expect(store.observe("another", { kind: "targets", paths: ["next.java"] })).toEqual({ kind: "blocked", reason: "session-limit" })
    expect(new ContextDeliveryStore().observe("overflow", { kind: "targets", paths: ["first.java", "later.java"] }).kind).toBe("targets")
  })

  it("keeps a rejected observation from being replaced by a later valid target", () => {
    const store = new ContextDeliveryStore()
    store.observe("session", { kind: "blocked", reason: "tool-input-invalid" })
    store.observe("session", { kind: "targets", paths: ["safe.java"] })
    expect(store.take("session")).toEqual({ kind: "blocked", reason: "tool-input-invalid" })
    store.observe("session", { kind: "targets", paths: ["safe.java"] })
    store.clear("session")
    expect(store.take("session")).toBeUndefined()
  })
})
