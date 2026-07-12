package fixture.p2e1;

class A1PositiveCases {
  @org.junit.jupiter.api.Test
  void emptyJupiterTest() {
    // P2E1_CASE:e1-a1-pos-empty-jupiter-001
  }

  @org.junit.jupiter.api.Test
  void effectOnlyJupiterTest() {
    // P2E1_CASE:e1-a1-pos-effect-only-jupiter-002
    new AuditPort().record("value");
  }

  @org.junit.Test
  public void emptyVintageTest() {
    // P2E1_CASE:e1-a1-pos-empty-vintage-003
  }

  private static final class AuditPort {
    void record(String value) {
    }
  }
}
