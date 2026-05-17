package com.kds.concurrency;

import com.kds.enums.OrderStatus;
import com.kds.state.OrderStore;
import com.kds.websocket.KitchenEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Concept 3 — CYCLIC BARRIER:
 * Each order gets a CyclicBarrier sized to its distinct station count.
 * Every StationWorker calls await() when done; the last one to arrive
 * triggers the barrier action which marks the order READY and signals
 * the waiter thread waiting on the order's Condition.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BarrierCoordinator {

    private final KitchenEventPublisher eventPublisher;
    private final OrderStore orderStore;

    private final ConcurrentHashMap<String, CyclicBarrier> barriers = new ConcurrentHashMap<>();

    // ── Barrier lifecycle ─────────────────────────────────────────────────────

    public CyclicBarrier createBarrier(String orderId, int stationCount) {
        Runnable barrierAction = () -> {
            log.info("*** BARRIER FIRED for order {} — all {} stations completed! ***",
                orderId, stationCount);

            orderStore.findById(orderId).ifPresent(order -> {
                order.setOrderStatus(OrderStatus.READY);
                order.setReadyAt(Instant.now());

                // Concept 4 — CONDITION VARIABLE:
                // Signal the waiter/service thread that is blocked on awaitReady().
                order.lockOrder();
                try {
                    order.signalReady();
                } finally {
                    order.unlockOrder();
                }

                eventPublisher.publishOrderReady(order);
            });
        };

        CyclicBarrier barrier = new CyclicBarrier(stationCount, barrierAction);
        barriers.put(orderId, barrier);
        log.info("CyclicBarrier created for order {} with {} parties", orderId, stationCount);
        return barrier;
    }

    // ── Barrier coordination ──────────────────────────────────────────────────

    /**
     * Blocks the calling StationWorker thread until all sibling workers arrive
     * or 30 seconds elapse (prevents a deadlock if a worker crashes silently).
     */
    public void await(String orderId)
            throws BrokenBarrierException, InterruptedException, TimeoutException {

        CyclicBarrier barrier = barriers.get(orderId);
        if (barrier == null) {
            throw new IllegalStateException("No barrier registered for order: " + orderId);
        }

        log.debug("Thread [{}] waiting at barrier for order {}",
            Thread.currentThread().getName(), orderId);

        barrier.await(30, TimeUnit.SECONDS);
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    public void removeBarrier(String orderId) {
        barriers.remove(orderId);
    }

    public int getBarrierCount() {
        return barriers.size();
    }

    public boolean hasBarrier(String orderId) {
        return barriers.containsKey(orderId);
    }
}
