package com.kds.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.kds.enums.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Order {

    @EqualsAndHashCode.Include
    private String id;
    private int tableNumber;
    private volatile OrderStatus orderStatus;
    private List<OrderComponent> components;
    private Instant createdAt;
    private Instant readyAt;
    private Instant collectedAt;

    @JsonIgnore
    @EqualsAndHashCode.Exclude
    @ToString.Exclude
    private final transient ReentrantLock lock = new ReentrantLock();

    @JsonIgnore
    @EqualsAndHashCode.Exclude
    @ToString.Exclude
    private final transient Condition readyCondition = lock.newCondition();

    // ── Lock lifecycle ────────────────────────────────────────────────────────

    public void lockOrder() {
        lock.lock();
    }

    public void unlockOrder() {
        lock.unlock();
    }

    // ── Condition coordination ────────────────────────────────────────────────

    /** Blocks the calling thread until the order is ready or the timeout elapses. */
    public void awaitReady(long timeoutMs) throws InterruptedException {
        readyCondition.await(timeoutMs, TimeUnit.MILLISECONDS);
    }

    /** Wakes all threads waiting on readyCondition. Must be called while holding the lock. */
    public void signalReady() {
        readyCondition.signalAll();
    }

    // ── Component aggregation ─────────────────────────────────────────────────

    public boolean allComponentsDone() {
        if (components == null || components.isEmpty()) return false;
        return components.stream().allMatch(OrderComponent::isDone);
    }

    public int doneCount() {
        if (components == null) return 0;
        return (int) components.stream().filter(OrderComponent::isDone).count();
    }

    /**
     * Total wall-clock ms from order creation to the moment it became ready.
     * Returns -1 if readyAt has not been set yet.
     */
    public long totalElapsedMs() {
        if (createdAt == null || readyAt == null) return -1;
        return ChronoUnit.MILLIS.between(createdAt, readyAt);
    }
}
