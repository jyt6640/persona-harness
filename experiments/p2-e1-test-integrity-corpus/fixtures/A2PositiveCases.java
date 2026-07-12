package fixture.p2e1;

class A2PositiveCases {
  @org.junit.jupiter.api.Disabled
  @org.junit.jupiter.api.Test
  void disabledWithoutReason() {
    // P2E1_CASE:e1-a2-pos-disabled-bare-jupiter-001
    org.junit.jupiter.api.Assertions.assertTrue(true);
  }

  @org.junit.jupiter.api.Disabled(" ")
  @org.junit.jupiter.api.Test
  void disabledWithBlankReason() {
    // P2E1_CASE:e1-a2-pos-disabled-blank-jupiter-002
    org.junit.jupiter.api.Assertions.assertTrue(true);
  }

  @org.junit.Ignore
  @org.junit.Test
  public void ignoredWithoutReason() {
    // P2E1_CASE:e1-a2-pos-ignore-bare-vintage-003
    org.junit.Assert.assertTrue(true);
  }

  @org.junit.Ignore("")
  @org.junit.Test
  public void ignoredWithBlankReason() {
    // P2E1_CASE:e1-a2-pos-ignore-blank-vintage-004
    org.junit.Assert.assertTrue(true);
  }
}
