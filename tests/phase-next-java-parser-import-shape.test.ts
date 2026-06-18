import { describe, expect, expectTypeOf, it } from "vitest"

import { BaseJavaCstVisitor, BaseJavaCstVisitorWithDefaults, lexAndParse, parse } from "java-parser"
import type { CstNode, IToken, JavaCstVisitor, JavaCstVisitorWithDefaults } from "java-parser"

type ParseShape = CstNode & {
  readonly comments?: readonly IToken[]
}

type LexAndParseShape = {
  readonly tokens: readonly IToken[]
  readonly cst: CstNode
}

describe("Phase next java-parser compile/import spike", () => {
  it("exposes ESM named exports for parser and visitor entry points", () => {
    expect(typeof parse).toBe("function")
    expect(typeof lexAndParse).toBe("function")
    expect(typeof BaseJavaCstVisitor).toBe("function")
    expect(typeof BaseJavaCstVisitorWithDefaults).toBe("function")
  })

  it("typechecks parser and visitor shapes without calling the parser", () => {
    expectTypeOf(parse).parameter(0).toEqualTypeOf<string>()
    expectTypeOf(parse).parameter(1).toEqualTypeOf<string | undefined>()
    expectTypeOf(parse).returns.toMatchTypeOf<ParseShape>()
    expectTypeOf(lexAndParse).returns.toMatchTypeOf<LexAndParseShape>()
    expectTypeOf<InstanceType<typeof BaseJavaCstVisitor>>().toMatchTypeOf<JavaCstVisitor<unknown, unknown>>()
    expectTypeOf<InstanceType<typeof BaseJavaCstVisitorWithDefaults>>().toMatchTypeOf<
      JavaCstVisitorWithDefaults<unknown, unknown>
    >()
  })
})
