package fixture.p2e1;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.stream.Stream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class A1NegativeCases extends AssertionSupport {
  @Test
  void jupiterExpectedException() {
    // P2E1_CASE:e1-a1-neg-jupiter-expected-exception-001
    assertThrows(IllegalStateException.class, () -> {
      throw new IllegalStateException("expected");
    });
  }

  @org.junit.Test(expected = IllegalArgumentException.class)
  public void vintageExpectedException() {
    // P2E1_CASE:e1-a1-neg-vintage-expected-exception-002
    throw new IllegalArgumentException("expected");
  }

  @ParameterizedTest
  @ValueSource(strings = {"value"})
  void parameterizedAssertion(String value) {
    // P2E1_CASE:e1-a1-neg-parameterized-003
    assertEquals("value", value);
  }

  @Test
  void inheritedHelperAssertion() {
    // P2E1_CASE:e1-a1-neg-inherited-helper-assertion-004
    assertPersisted("saved");
  }

  @Test
  void interactionOnlyVerification() {
    // P2E1_CASE:e1-a1-neg-interaction-only-005
    Gateway gateway = mock(Gateway.class);
    gateway.send("event");
    verify(gateway).send("event");
  }

  @TestFactory
  Stream<DynamicTest> dynamicTestFactory() {
    // P2E1_CASE:e1-a1-neg-framework-annotation-006
    return Stream.of(DynamicTest.dynamicTest("dynamic", () -> assertEquals(2, 1 + 1)));
  }

  @BeforeEach
  void emptyLifecycleMethod() {
    // P2E1_CASE:e1-a1-neg-empty-lifecycle-007
  }

  private interface Gateway {
    void send(String value);
  }
}

abstract class AssertionSupport {
  final void assertPersisted(String value) {
    assertEquals("saved", value);
  }
}
