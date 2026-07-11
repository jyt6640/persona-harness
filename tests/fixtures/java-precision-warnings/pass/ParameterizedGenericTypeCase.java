import java.util.List;

class ParameterizedGenericTypeCase {
    private final List<String> values;

    ParameterizedGenericTypeCase(List<String> values) {
        this.values = List.copyOf(values);
    }
}
