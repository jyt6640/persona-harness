import { describe, expect, it } from "vitest"

import { observeServiceStorageOwnership } from "../src/observer/service-storage-observer.js"

function observe(filePath: string, source: string) {
  return observeServiceStorageOwnership({ filePath, source })
}

const STORAGE_OWNING_IMPL = [
  "package com.example;",
  "",
  "import java.util.HashMap;",
  "import java.util.Map;",
  "import java.util.concurrent.atomic.AtomicLong;",
  "",
  "public class OrderServiceImpl implements OrderService {",
  "",
  "    private final Map<Long, Order> orderStore = new HashMap<>();",
  "    private final AtomicLong nextId = new AtomicLong(1);",
  "",
  "    public Order create(String name) {",
  "        Order order = new Order(nextId.getAndIncrement(), name);",
  "        orderStore.put(order.getId(), order);",
  "        return order;",
  "    }",
  "}",
  "",
].join("\n")

// Every method body in a real implementation declares locals like this. They
// live inside a method and carry no access modifier, so they are not state the
// Service owns.
const LOCALS_ONLY_IMPL = [
  "package com.example;",
  "",
  "import java.util.ArrayList;",
  "import java.util.List;",
  "",
  "public class CartServiceImpl implements CartService {",
  "",
  "    private final CartRepository cartRepository;",
  "",
  "    public CartServiceImpl(CartRepository cartRepository) {",
  "        this.cartRepository = cartRepository;",
  "    }",
  "",
  "    public List<CartItem> listPromotion(Long memberId, List<Long> cartIds) {",
  "        List<CartItem> cartItemList = new ArrayList<>();",
  "        List<PromotionItem> promotionItemList = new ArrayList<>();",
  "        cartItemList.addAll(cartRepository.findAllById(cartIds));",
  "        return cartItemList;",
  "    }",
  "}",
  "",
].join("\n")

const SERVICE_INTERFACE = [
  "package com.example;",
  "",
  "import java.util.List;",
  "",
  "public interface OrderService {",
  "",
  "    List<Order> listOrders(Long memberId);",
  "}",
  "",
].join("\n")

describe("Service implementations are observed", () => {
  it("reports a ServiceImpl that owns storage", () => {
    // `FooService` + `FooServiceImpl` is the dominant Spring shape, and only the
    // implementation can own state. Matching `*Service.java` alone inspected the
    // interface — which structurally cannot fail — and skipped this file.
    const observation = observe("src/main/java/com/example/OrderServiceImpl.java", STORAGE_OWNING_IMPL)

    expect(observation.finding).toBe("WARN")
    expect(observation.evidence.storageFields).toContain("private final Map<Long, Order> orderStore =")
    expect(observation.evidence.sequenceFields).toContain("private final AtomicLong nextId =")
  })

  it("does not treat a local variable inside a method as owned storage", () => {
    const observation = observe("src/main/java/com/example/CartServiceImpl.java", LOCALS_ONLY_IMPL)

    expect(observation.finding).toBe("PASS")
    expect(observation.evidence.storageFields).toHaveLength(0)
  })

  it("does not let a generic type argument swallow a method signature", () => {
    const observation = observe("src/main/java/com/example/CartServiceImpl.java", LOCALS_ONLY_IMPL)

    // The type-argument pattern used to match across newlines, so
    // `List<CartItem> listPromotion(...) {` was captured whole as a field.
    for (const field of observation.evidence.storageFields) {
      expect(field).not.toContain("(")
      expect(field).not.toContain("\n")
    }
  })

  it("still declines to judge the interface", () => {
    const observation = observe("src/main/java/com/example/OrderService.java", SERVICE_INTERFACE)

    // An interface has no fields, so there is nothing to observe either way.
    expect(observation.finding).toBe("UNKNOWN")
  })

  it("ignores a file that is neither a Service nor an implementation", () => {
    const observation = observe("src/main/java/com/example/OrderController.java", STORAGE_OWNING_IMPL)

    expect(observation.finding).toBe("UNKNOWN")
  })
})
