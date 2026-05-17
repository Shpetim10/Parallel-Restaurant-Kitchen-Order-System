package com.kds.concurrency;

import com.kds.enums.ComponentStatus;
import com.kds.enums.StationType;
import com.kds.model.Order;
import com.kds.model.OrderComponent;
import com.kds.state.OrderStore;
import com.kds.websocket.KitchenEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.slf4j.MDC;

import java.time.Instant;
import java.util.concurrent.CountDownLatch;

/**
 * One StationWorker is created per OrderComponent and submitted to that station's
 * thread pool by StationDispatcher.
 *
 * Coordination concepts used:
 *  1. Semaphore   — gates concurrent component slots at the station
 *  2. Mutex       — serialises status writes on the shared Order
 *  3. CountDownLatch — signals the per-station coordinator when this component is done
 *                      (coordinator then hits the CyclicBarrier once for the whole station)
 *  4. Condition   — waiter thread wakes when all stations complete (via barrier action)
 */
@Slf4j
@RequiredArgsConstructor
public class StationWorker implements Runnable {

    private final Order order;
    private final OrderComponent component;
    private final StationType stationType;
    private final StationSemaphoreRegistry semaphoreRegistry;
    private final BarrierCoordinator barrierCoordinator;   // kept for direct-dispatch fallback
    private final OrderLockManager lockManager;
    private final KitchenEventPublisher eventPublisher;
    private final OrderStore orderStore;
    private final CountDownLatch stationLatch;              // null ⇒ fall back to direct barrier hit

    @Override
    public void run() {

        // ── STEP 1: Announce entry ────────────────────────────────────────────
        log.info("StationWorker started — component [{}] station [{}] thread [{}]",
            component.getName(), stationType.getDisplayName(),
            Thread.currentThread().getName());

        // ── STEP 2: Rename thread for observability ───────────────────────────
        String workerName = "station-" + stationType.name().toLowerCase()
            + "-" + order.getId().substring(0, 6);
        Thread.currentThread().setName(workerName);
        component.setThreadName(workerName);

        // ── MDC context for structured logging ────────────────────────────────
        MDC.put("orderId",   order.getId());
        MDC.put("station",   stationType.name());
        MDC.put("thread",    workerName);
        MDC.put("component", component.getName());

        boolean acquired = false;
        boolean componentFailed = false;

        try {
            // ── STEP 3: Acquire Semaphore (BLOCKS if station is at capacity) ──
            // Concept 1 — SEMAPHORE
            log.debug("Thread [{}] acquiring semaphore for station {}",
                workerName, stationType.getDisplayName());

            semaphoreRegistry.acquire(stationType);
            acquired = true;

            log.debug("Thread [{}] semaphore ACQUIRED for station {}",
                workerName, stationType.getDisplayName());

            // ── STEP 4: Mark IN_PROGRESS under mutex ─────────────────────────
            // Concept 2 — MUTEX (ReentrantLock via OrderLockManager)
            lockManager.withLock(order.getId(), () -> {
                component.setStatus(ComponentStatus.IN_PROGRESS);
                component.setStartedAt(Instant.now());
            });
            eventPublisher.publishComponentUpdate(order, component,
                semaphoreRegistry.getState(stationType));

            // ── STEP 5: Simulate cooking ──────────────────────────────────────
            log.info("Cooking [{}] for {}ms on thread [{}]",
                component.getName(), component.getCookTimeMs(), workerName);
            Thread.sleep(component.getCookTimeMs());

            // ── STEP 6: Mark DONE under mutex ─────────────────────────────────
            lockManager.withLock(order.getId(), () -> {
                component.setStatus(ComponentStatus.DONE);
                component.setCompletedAt(Instant.now());
            });
            eventPublisher.publishComponentUpdate(order, component,
                semaphoreRegistry.getState(stationType));
            log.info("Component [{}] DONE on thread [{}]", component.getName(), workerName);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            componentFailed = true;

            lockManager.withLock(order.getId(),
                () -> component.setStatus(ComponentStatus.FAILED));
            eventPublisher.publishComponentUpdate(order, component,
                semaphoreRegistry.getState(stationType));

            log.warn("StationWorker INTERRUPTED — component [{}] thread [{}]",
                component.getName(), workerName);

        } finally {

            MDC.clear();

            // ── STEP 7: ALWAYS release Semaphore ─────────────────────────────
            if (acquired) {
                semaphoreRegistry.release(stationType);
                eventPublisher.publishStationUpdate(stationType,
                    semaphoreRegistry.getState(stationType));
            }

            // ── STEP 8: Signal completion ─────────────────────────────────────
            // Concept 3 — CYCLIC BARRIER (indirectly, via coordinator latch)
            // Count down the per-station latch; the coordinator awaits it and then
            // hits the CyclicBarrier once for the whole station group.
            if (stationLatch != null) {
                stationLatch.countDown();
                log.debug("Thread [{}] counted down station latch for order {} — {} remaining",
                    workerName, order.getId(), stationLatch.getCount());
            } else if (!componentFailed && !Thread.currentThread().isInterrupted()) {
                // Fallback: no coordinator — hit barrier directly (single-component stations)
                try {
                    log.debug("Thread [{}] hitting barrier directly for order {}",
                        workerName, order.getId());
                    barrierCoordinator.await(order.getId());
                } catch (Exception ex) {
                    log.error("Barrier error — order [{}] thread [{}]: {}",
                        order.getId(), workerName, ex.getMessage());
                }
            }
        }
    }
}
