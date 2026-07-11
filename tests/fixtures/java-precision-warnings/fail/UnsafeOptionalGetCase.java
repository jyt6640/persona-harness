import java.util.Optional;

class UnsafeOptionalGetCase {
    String nullableValue(String value) {
        return Optional.ofNullable(value).get();
    }

    Object missingValue() {
        return java.util.Optional.empty().get();
    }
}
