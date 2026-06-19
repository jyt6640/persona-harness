package sample.member.domain;

import java.util.List;
import java.util.Optional;

class CleanDomain {
    private static final String TYPE = "member";
    private final List<String> names;
    private final Optional<String> email;

    CleanDomain(List<String> names, Optional<String> email) {
        this.names = List.copyOf(names);
        this.email = email;
    }

    String emailOrDefault() {
        return email.orElse("none");
    }
}
