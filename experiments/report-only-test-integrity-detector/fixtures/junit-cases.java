@interface Test {}
@interface Disabled {
  String value() default "";
}

final class Assertions {
  static void assertEquals(int left, int right) {}
}

class IntegrityCases {
  @Test
  void emptyTest() {}

  @Test
  void assertingTest() {
    Assertions.assertEquals(1, 1);
  }

  @Disabled
  void disabledWithoutReason() {}

  @Disabled("waiting for an upstream contract")
  void disabledWithReason() {}
}
