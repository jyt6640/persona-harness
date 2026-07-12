package fixture.p2e1;

class A2NegativeCases {
  @org.junit.jupiter.api.Disabled("ticket-INFRA-42")
  @org.junit.jupiter.api.Test
  void disabledWithIntentionalReason() {
    // P2E1_CASE:e1-a2-neg-disabled-intentional-reason-001
    org.junit.jupiter.api.Assertions.assertTrue(true);
  }

  @org.junit.Ignore("ticket-LEGACY-7")
  @org.junit.Test
  public void ignoredWithIntentionalReason() {
    // P2E1_CASE:e1-a2-neg-ignore-intentional-reason-002
    org.junit.Assert.assertTrue(true);
  }

  @org.testng.annotations.Ignore
  @org.testng.annotations.Test
  void ignoredByAnotherFramework() {
    // P2E1_CASE:e1-a2-neg-framework-annotation-003
  }
}
