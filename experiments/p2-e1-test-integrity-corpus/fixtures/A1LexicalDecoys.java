package fixture.p2e1;

@interface Test {
}

class A1LexicalDecoys {
  @Test
  void emptyNonTestAnnotation() {
    // P2E1_CASE:e1-a1-neg-non-test-annotation-008
  }

  void commentAndStringOnly() {
    // P2E1_CASE:e1-a1-neg-comments-and-strings-009
    String sourceLikeText = "@Test void empty() {}";
    // @Test
  }
}
