package com.kds.concurrency;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Concept 2 — MUTEX (ReentrantLock):
 * Fine-grained per-order locking. Multiple station workers operate on the same
 * Order concurrently; this lock serialises any status mutation on that order.
 */
@Component
public class OrderLockManager {

    private final ConcurrentHashMap<String, ReentrantLock> orderLocks = new ConcurrentHashMap<>();

    // ── Lock lifecycle ────────────────────────────────────────────────────────

    public ReentrantLock getOrCreateLock(String orderId) {
        return orderLocks.computeIfAbsent(orderId, id -> new ReentrantLock(true));  // fair
    }

    public void lock(String orderId) {
        getOrCreateLock(orderId).lock();
    }

    public void unlock(String orderId) {
        ReentrantLock lock = orderLocks.get(orderId);
        if (lock != null && lock.isHeldByCurrentThread()) {
            lock.unlock();
        }
    }

    public void removeLock(String orderId) {
        orderLocks.remove(orderId);
    }

    // ── Convenience wrapper ───────────────────────────────────────────────────

    /**
     * Runs {@code action} while holding the order lock, always releasing in finally.
     * Prefer this over raw lock/unlock to prevent lock leaks.
     */
    public void withLock(String orderId, Runnable action) {
        ReentrantLock lock = getOrCreateLock(orderId);
        lock.lock();
        try {
            action.run();
        } finally {
            lock.unlock();
        }
    }
}
