package fixture.p2e1;

@interface Ignore {
}

class A2LexicalDecoys {
  @Ignore
  void customIgnoreAnnotation() {
    // P2E1_CASE:e1-a2-neg-non-test-annotation-004
  }

  void commentAndStringOnly() {
    // P2E1_CASE:e1-a2-neg-comments-and-strings-005
    String sourceLikeText = "@Disabled @Ignore";
    // @Disabled
  }
}
