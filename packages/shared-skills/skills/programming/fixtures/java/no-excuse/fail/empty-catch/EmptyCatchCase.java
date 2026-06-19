package sample.bad;

class EmptyCatchCase {
    void run() {
        try {
            risky();
        } catch (IllegalStateException e) {}
    }

    private void risky() {
    }
}
