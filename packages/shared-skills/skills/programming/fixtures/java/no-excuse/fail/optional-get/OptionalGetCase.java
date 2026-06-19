package sample.bad;

import java.util.Optional;

class OptionalGetCase {
    private Optional<String> name;

    String name() {
        return name.get();
    }
}
