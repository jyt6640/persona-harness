package sample.bad;

import java.util.Optional;

class OptionalLocalCase {
    String name(Optional<String> input) {
        Optional<String> value = input;
        return value.get();
    }
}
