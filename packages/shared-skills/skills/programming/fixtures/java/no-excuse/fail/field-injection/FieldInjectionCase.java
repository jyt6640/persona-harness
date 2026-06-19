package sample.bad;

import org.springframework.beans.factory.annotation.Autowired;

class FieldInjectionCase {
    @Autowired
    private Object dependency;
}
