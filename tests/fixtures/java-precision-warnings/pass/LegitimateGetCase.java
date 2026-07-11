import java.util.Map;
import java.util.Optional;

class LegitimateGetCase {
    String mapValue(Map<String, String> values) {
        return values.get("key");
    }

    String knownOptionalValue() {
        return Optional.of("known").get();
    }
}
