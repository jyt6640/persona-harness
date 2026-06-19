package sample.bad;

class BroadCatchCase {
    void run() {
        try {
            risky();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private void risky() {
    }
}
