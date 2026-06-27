import { describe, expect, it } from "vitest"

import { collectJavaParameterLists, splitJavaParameters } from "../src/observer/java-source.js"

describe("Java source parameter tokenizer", () => {
  it("keeps nested generic commas, annotation argument commas, lambdas, method references, and text blocks out of top-level parameter splits", () => {
    const parameters = `
      @Qualifier(name = "primary,repository") Map<Long, List<Foo>> values,
      Function<Foo, Bar> mapper,
      Supplier<String> messageSupplier,
      Runnable cleanup
    `

    expect(splitJavaParameters(parameters)).toEqual([
      '@Qualifier(name = "primary,repository") Map<Long, List<Foo>> values',
      "Function<Foo, Bar> mapper",
      "Supplier<String> messageSupplier",
      "Runnable cleanup",
    ])

    const source = `
class OtherController {
  OtherController(String ignored) {}
}

class ReservationController {
  ReservationController(
    @Qualifier(name = "primary,repository") Map<Long, List<Foo>> values,
    Function<Foo, Bar> mapper,
    Supplier<String> messageSupplier,
    Runnable cleanup
  ) {
    var method = SomeType::factory;
    var lambda = (Foo foo, Bar bar) -> mapper.apply(foo, bar);
    String text = """
      GET /reservations, POST /reservations,
      SELECT * FROM reservation
    """;
  }
}
`

    expect(collectJavaParameterLists(source, "ReservationController")).toEqual([
      `
    @Qualifier(name = "primary,repository") Map<Long, List<Foo>> values,
    Function<Foo, Bar> mapper,
    Supplier<String> messageSupplier,
    Runnable cleanup
  `,
    ])
  })
})
