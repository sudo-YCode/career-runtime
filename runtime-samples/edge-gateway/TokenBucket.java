package dev.yatin.gateway;

/** Per-caller rate limiter: refills continuously, spends one token per request. */
public final class TokenBucket {

    private final double capacity;
    private final double refillPerNano;
    private double tokens;
    private long lastNanos;

    public TokenBucket(double capacity, double refillPerSecond, long nowNanos) {
        this.capacity = capacity;
        this.refillPerNano = refillPerSecond / 1_000_000_000.0;
        this.tokens = capacity;
        this.lastNanos = nowNanos;
    }

    public synchronized boolean tryAcquire(long nowNanos) {
        tokens = Math.min(capacity, tokens + (nowNanos - lastNanos) * refillPerNano);
        lastNanos = nowNanos;
        if (tokens < 1) {
            return false;
        }
        tokens -= 1;
        return true;
    }
}
