package com.kds.integration;

import com.kds.concurrency.StationSemaphoreRegistry;
import com.kds.dto.OrderItemRequest;
import com.kds.dto.OrderRequest;
import com.kds.enums.ComponentStatus;
import com.kds.enums.OrderStatus;
import com.kds.enums.StationType;
import com.kds.model.Order;
import com.kds.model.OrderComponent;
import com.kds.service.OrderService;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.boot.test.context.SpringBootTest.WebEnvironment.RANDOM_PORT;

@SpringBootTest(webEnvironment = RANDOM_PORT)
@ActiveProfiles("test")
@Slf4j
class ConcurrencyIntegrationTest {

    @Autowired private OrderService orderService;
    @Autowired private StationSemaphoreRegistry semaphoreRegistry;

    // ── Helpers ───────────────────────────────────────────────────────────────

    private OrderRequest singleStationOrder(int tableNumber, StationType type, long cookTimeMs) {
        return OrderRequest.builder()
            .tableNumber(tableNumber)
            .items(List.of(OrderItemRequest.builder()
                .menuItemId(UUID.randomUUID().toString())
                .name(type.getDisplayName() + "-item")
                .stationType(type)
                .cookTimeMs(cookTimeMs)
                .build()))
            .build();
    }

    private Order waitForReady(String orderId, long timeoutMs) throws InterruptedException {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            Order order = orderService.getOrder(orderId).orElseThrow();
            if (order.getOrderStatus() == OrderStatus.READY) return order;
            Thread.sleep(200);
        }
        return orderService.getOrder(orderId).orElseThrow();
    }

    // ── TEST 1 — Threads are parallel, not sequential ─────────────────────────

    /**
     * Concept 5 — THREAD POOL:
     * 5 GRILL orders submitted simultaneously. Each takes 3s. If sequential they'd
     * take 15s total; in parallel they all finish in ~3s wall time.
     * Distinct thread names prove each order ran on its own thread.
     */
    @Test
    void testConcurrentOrdersUseSeparateThreads() throws Exception {
        int orderCount = 5;
        long cookTimeMs = 3000;
        CountDownLatch startGun = new CountDownLatch(1);
        CountDownLatch submitted = new CountDownLatch(orderCount);
        List<String> orderIds = new CopyOnWriteArrayList<>();
        ExecutorService executor = Executors.newFixedThreadPool(orderCount);

        long wallStart = System.currentTimeMillis();

        for (int i = 0; i < orderCount; i++) {
            final int tableNum = i + 1;
            executor.submit(() -> {
                try {
                    startGun.await();
                    Order order = orderService.createOrder(
                        singleStationOrder(tableNum, StationType.GRILL, cookTimeMs));
                    orderIds.add(order.getId());
                } catch (Exception e) {
                    log.error("Order submission failed", e);
                } finally {
                    submitted.countDown();
                }
            });
        }

        startGun.countDown();
        submitted.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(orderIds).hasSize(orderCount);

        for (String id : orderIds) {
            Order ready = waitForReady(id, 15_000);
            assertThat(ready.getOrderStatus())
                .withFailMessage("Order %s never reached READY", id)
                .isEqualTo(OrderStatus.READY);
        }

        long wallElapsed = System.currentTimeMillis() - wallStart;
        log.info("TEST 1: {} GRILL orders completed in {}ms wall time (sequential would take {}ms)",
            orderCount, wallElapsed, orderCount * cookTimeMs);

        // With ±20% variation max cook = 3600ms; 2× = 7200ms is well under sequential 15s
        assertThat(wallElapsed)
            .withFailMessage("Wall time %dms suggests sequential execution, not parallel", wallElapsed)
            .isLessThan(2 * cookTimeMs * 2);

        // Every order must have run on a distinct thread (not recycled)
        List<String> threadNames = new ArrayList<>();
        for (String id : orderIds) {
            orderService.getOrder(id).ifPresent(o ->
                o.getComponents().forEach(c -> threadNames.add(c.getThreadName())));
        }
        long distinctThreadCount = threadNames.stream().distinct().count();
        log.info("TEST 1: thread names = {}", threadNames);
        assertThat(distinctThreadCount)
            .withFailMessage("Expected %d distinct threads but got %d", orderCount, distinctThreadCount)
            .isEqualTo(orderCount);
    }

    // ── TEST 2 — Semaphore blocks at capacity ─────────────────────────────────

    /**
     * Concept 1 — SEMAPHORE:
     * GRILL capacity = 3. Submit 6 orders. Verify that at no instant do more
     * than 3 components overlap (by checking startedAt/completedAt timestamps).
     * Also verify the 4th component started only after the 1st one finished.
     */
    @Test
    void testSemaphoreBlocksWhenAtCapacity() throws Exception {
        int grillCapacity = 3;
        int orderCount = 6;
        long cookTimeMs = 3000;
        CountDownLatch startGun = new CountDownLatch(1);
        CountDownLatch submitted = new CountDownLatch(orderCount);
        List<String> orderIds = new CopyOnWriteArrayList<>();
        ExecutorService executor = Executors.newFixedThreadPool(orderCount);

        for (int i = 0; i < orderCount; i++) {
            final int tableNum = i + 1;
            executor.submit(() -> {
                try {
                    startGun.await();
                    Order order = orderService.createOrder(
                        singleStationOrder(tableNum, StationType.GRILL, cookTimeMs));
                    orderIds.add(order.getId());
                } catch (Exception e) {
                    log.error("Order submission failed", e);
                } finally {
                    submitted.countDown();
                }
            });
        }

        startGun.countDown();
        submitted.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        for (String id : orderIds) {
            waitForReady(id, 30_000);
        }

        // Collect all GRILL components across all orders
        List<OrderComponent> grillComponents = new ArrayList<>();
        for (String id : orderIds) {
            orderService.getOrder(id).ifPresent(o ->
                o.getComponents().stream()
                    .filter(c -> c.getStationType() == StationType.GRILL)
                    .forEach(grillComponents::add));
        }
        assertThat(grillComponents).hasSize(orderCount);

        // At each component's startedAt instant, count how many others overlapped
        int maxConcurrent = 0;
        for (OrderComponent probe : grillComponents) {
            Instant t = probe.getStartedAt();
            if (t == null) continue;
            long concurrent = grillComponents.stream()
                .filter(c -> c.getStartedAt() != null && c.getCompletedAt() != null)
                .filter(c -> !c.getStartedAt().isAfter(t) && !c.getCompletedAt().isBefore(t))
                .count();
            maxConcurrent = Math.max(maxConcurrent, (int) concurrent);
        }

        log.info("TEST 2: peak concurrent GRILL components = {} (capacity = {})",
            maxConcurrent, grillCapacity);
        assertThat(maxConcurrent)
            .withFailMessage("Semaphore violated: %d concurrent GRILL items exceeded capacity %d",
                maxConcurrent, grillCapacity)
            .isLessThanOrEqualTo(grillCapacity);

        // 4th component (by start time) must have started after AT LEAST ONE of the first 3 finished.
        // (The earliest-starting component isn't necessarily the earliest to finish due to ±20% cook
        //  time variation, so we check that some first-batch completion predates the 4th start.)
        List<OrderComponent> sorted = grillComponents.stream()
            .filter(c -> c.getStartedAt() != null && c.getCompletedAt() != null)
            .sorted((a, b) -> a.getStartedAt().compareTo(b.getStartedAt()))
            .collect(Collectors.toList());

        Instant fourthStartedAt = sorted.get(grillCapacity).getStartedAt();
        List<OrderComponent> firstBatch = sorted.subList(0, grillCapacity);

        boolean someFirstBatchFinishedBeforeFourthStarted = firstBatch.stream()
            .anyMatch(c -> c.getCompletedAt() != null
                        && !c.getCompletedAt().isAfter(fourthStartedAt));

        log.info("TEST 2: 4th started at {}, first-batch completions = {}",
            fourthStartedAt,
            firstBatch.stream().map(OrderComponent::getCompletedAt).toList());
        assertThat(someFirstBatchFinishedBeforeFourthStarted)
            .withFailMessage(
                "4th GRILL component (startedAt=%s) started before any of the first 3 finished — semaphore not enforced",
                fourthStartedAt)
            .isTrue();
    }

    // ── TEST 3 — Mutex prevents data corruption ───────────────────────────────

    /**
     * Concept 2 — MUTEX (ReentrantLock):
     * 1 order with 10 SALAD components (capacity = 4, so 4 run concurrently).
     * After completion every component must be in a self-consistent state:
     * no PENDING+startedAt, no IN_PROGRESS+completedAt, and allComponentsDone()=true.
     */
    @Test
    void testConcurrentStatusUpdatesCauseNoCorruption() throws Exception {
        int componentCount = 10;
        List<OrderItemRequest> items = new ArrayList<>();
        for (int i = 0; i < componentCount; i++) {
            items.add(OrderItemRequest.builder()
                .menuItemId(UUID.randomUUID().toString())
                .name("Salad-" + i)
                .stationType(StationType.SALAD)
                .cookTimeMs(500L)
                .build());
        }

        Order order = orderService.createOrder(
            OrderRequest.builder().tableNumber(1).items(items).build());

        Order finalOrder = waitForReady(order.getId(), 30_000);

        assertThat(finalOrder.getOrderStatus()).isEqualTo(OrderStatus.READY);
        assertThat(finalOrder.allComponentsDone())
            .withFailMessage("allComponentsDone() returned false — some components incomplete")
            .isTrue();

        for (OrderComponent c : finalOrder.getComponents()) {
            assertThat(c.getStatus())
                .withFailMessage("Component %s stuck in non-terminal status %s", c.getName(), c.getStatus())
                .isIn(ComponentStatus.DONE, ComponentStatus.FAILED);

            assertThat(c.getStatus() == ComponentStatus.PENDING && c.getStartedAt() != null)
                .withFailMessage("Component %s is PENDING but has startedAt set — mutex leak", c.getName())
                .isFalse();

            assertThat(c.getStatus() == ComponentStatus.IN_PROGRESS && c.getCompletedAt() != null)
                .withFailMessage("Component %s is IN_PROGRESS but has completedAt set — mutex leak", c.getName())
                .isFalse();
        }

        log.info("TEST 3: {} SALAD components all consistent — no mutex corruption detected",
            componentCount);
    }

    // ── TEST 4 — CyclicBarrier waits for ALL stations ─────────────────────────

    /**
     * Concept 3 — CYCLIC BARRIER:
     * 1 order: GRILL (8s) + DRINKS (500ms). DRINKS finishes ~7.5s before GRILL.
     * The order must NOT become READY until the barrier fires, which only happens
     * when both station coordinators have arrived — i.e., after GRILL completes.
     */
    @Test
    void testBarrierFiresOnlyWhenAllStationsDone() throws Exception {
        Order order = orderService.createOrder(OrderRequest.builder()
            .tableNumber(1)
            .items(List.of(
                OrderItemRequest.builder()
                    .menuItemId(UUID.randomUUID().toString())
                    .name("Burger")
                    .stationType(StationType.GRILL)
                    .cookTimeMs(8000L)
                    .build(),
                OrderItemRequest.builder()
                    .menuItemId(UUID.randomUUID().toString())
                    .name("Coke")
                    .stationType(StationType.DRINKS)
                    .cookTimeMs(500L)
                    .build()
            ))
            .build());

        String orderId = order.getId();

        // t=1.5s: DRINKS is done but GRILL still cooking → barrier not yet fired
        Thread.sleep(1500);
        assertThat(orderService.getOrder(orderId).orElseThrow().getOrderStatus())
            .withFailMessage("Order should be IN_PREPARATION at t=1.5s (GRILL not done)")
            .isEqualTo(OrderStatus.IN_PREPARATION);

        // t=3s: still only DRINKS station coordinator arrived at barrier
        Thread.sleep(1500);
        assertThat(orderService.getOrder(orderId).orElseThrow().getOrderStatus())
            .withFailMessage("Order should still be IN_PREPARATION at t=3s")
            .isEqualTo(OrderStatus.IN_PREPARATION);

        // Wait up to 13s for READY (GRILL max = 8000 * 1.2 = 9600ms + overhead)
        Order finalOrder = waitForReady(orderId, 13_000);
        assertThat(finalOrder.getOrderStatus()).isEqualTo(OrderStatus.READY);

        OrderComponent grillComp = finalOrder.getComponents().stream()
            .filter(c -> c.getStationType() == StationType.GRILL)
            .findFirst().orElseThrow();
        OrderComponent drinksComp = finalOrder.getComponents().stream()
            .filter(c -> c.getStationType() == StationType.DRINKS)
            .findFirst().orElseThrow();

        // readyAt must follow GRILL completion — barrier waited for the slow station
        assertThat(finalOrder.getReadyAt())
            .withFailMessage("readyAt (%s) is before GRILL completedAt (%s) — barrier did not wait",
                finalOrder.getReadyAt(), grillComp.getCompletedAt())
            .isAfterOrEqualTo(grillComp.getCompletedAt());

        // The gap between DRINKS completion and order READY proves barrier held back the signal
        long drinksDoneToReadyMs = finalOrder.getReadyAt().toEpochMilli()
            - drinksComp.getCompletedAt().toEpochMilli();

        log.info("TEST 4: DRINKS→READY gap = {}ms (GRILL was still cooking during this time)",
            drinksDoneToReadyMs);

        // DRINKS done at ~500ms, GRILL done at ~8000ms → gap must be at least 2s
        assertThat(drinksDoneToReadyMs)
            .withFailMessage("Gap of %dms too small — order became READY before GRILL finished", drinksDoneToReadyMs)
            .isGreaterThan(2000);
    }

    // ── TEST 5 — Condition blocks calling thread ──────────────────────────────

    /**
     * Concept 4 — CONDITION VARIABLE:
     * collectOrder() blocks the calling thread via Condition.await() until the
     * barrier action calls signalReady(). This test observes the thread state
     * directly and measures the blocking duration.
     */
    @Test
    void testCollectBlocksUntilReady() throws Exception {
        long cookTimeMs = 3000;
        Order order = orderService.createOrder(
            singleStationOrder(1, StationType.GRILL, cookTimeMs));
        String orderId = order.getId();

        AtomicReference<Order> collectedOrder = new AtomicReference<>();
        AtomicReference<Exception> collectException = new AtomicReference<>();

        long blockStart = System.currentTimeMillis();
        Thread collectorThread = new Thread(() -> {
            try {
                collectedOrder.set(orderService.collectOrder(orderId, 15_000));
            } catch (Exception e) {
                collectException.set(e);
            }
        }, "test-collector-thread");
        collectorThread.start();

        // Give the thread 500ms to descend into Condition.await()
        Thread.sleep(500);

        Thread.State state = collectorThread.getState();
        log.info("TEST 5: collector thread state at t=500ms = {}", state);
        assertThat(state)
            .withFailMessage(
                "Expected TIMED_WAITING (blocked on Condition.await) but got %s — " +
                "thread is not waiting", state)
            .isEqualTo(Thread.State.TIMED_WAITING);

        collectorThread.join(15_000);

        assertThat(collectException.get())
            .withFailMessage("collectOrder threw: %s", collectException.get())
            .isNull();
        assertThat(collectedOrder.get()).isNotNull();
        assertThat(collectedOrder.get().getOrderStatus()).isEqualTo(OrderStatus.COLLECTED);

        long totalBlockMs = System.currentTimeMillis() - blockStart;
        log.info("TEST 5: collector unblocked after {}ms (cook time was {}ms ±20%)", totalBlockMs, cookTimeMs);

        // Blocking time ≈ cookTimeMs with ±20% variation plus a small scheduling margin
        long minExpected = (long)(cookTimeMs * 0.8) - 200;
        long maxExpected = (long)(cookTimeMs * 1.2) + 1500;
        assertThat(totalBlockMs)
            .withFailMessage("Blocking duration %dms outside expected range [%d, %d]",
                totalBlockMs, minExpected, maxExpected)
            .isBetween(minExpected, maxExpected);
    }

    // ── TEST 6 — System handles 20 concurrent orders without deadlock ─────────

    /**
     * All 5 concepts under load:
     * 20 orders submitted simultaneously with 2-4 random items each.
     * Every order must reach READY within 60s (no deadlock), and every semaphore
     * must return to its initial available-slot count (no permit leak).
     */
    @Test
    void testSystemHandles20ConcurrentOrders() throws Exception {
        int orderCount = 20;
        StationType[] stations = StationType.values();
        Random random = new Random(42);
        List<String> orderIds = new CopyOnWriteArrayList<>();
        CountDownLatch startGun = new CountDownLatch(1);
        CountDownLatch submitted = new CountDownLatch(orderCount);
        ExecutorService executor = Executors.newFixedThreadPool(orderCount);

        for (int i = 0; i < orderCount; i++) {
            final int tableNum = i + 1;
            final int itemCount = 2 + random.nextInt(3); // 2–4 items
            executor.submit(() -> {
                try {
                    startGun.await();
                    List<OrderItemRequest> items = new ArrayList<>();
                    Set<StationType> usedTypes = new HashSet<>();
                    for (int j = 0; j < itemCount; j++) {
                        StationType type = stations[random.nextInt(stations.length)];
                        usedTypes.add(type);
                        items.add(OrderItemRequest.builder()
                            .menuItemId(UUID.randomUUID().toString())
                            .name("Item-" + j)
                            .stationType(type)
                            .cookTimeMs(500L + random.nextInt(1500))
                            .build());
                    }
                    Order created = orderService.createOrder(
                        OrderRequest.builder().tableNumber(tableNum).items(items).build());
                    orderIds.add(created.getId());
                } catch (Exception e) {
                    log.error("Failed to create order for table {}", tableNum, e);
                } finally {
                    submitted.countDown();
                }
            });
        }

        startGun.countDown();
        submitted.await(15, TimeUnit.SECONDS);
        executor.shutdown();

        List<Long> completionTimes = new ArrayList<>();
        long deadline = System.currentTimeMillis() + 60_000;

        for (String id : orderIds) {
            long remaining = deadline - System.currentTimeMillis();
            Order ready = waitForReady(id, Math.max(1000, remaining));
            assertThat(ready.getOrderStatus())
                .withFailMessage("Order %s timed out — possible deadlock detected!", id)
                .isEqualTo(OrderStatus.READY);
            if (ready.totalElapsedMs() >= 0) {
                completionTimes.add(ready.totalElapsedMs());
            }
        }

        double avgMs = completionTimes.stream().mapToLong(Long::longValue).average().orElse(0);
        log.info("TEST 6: All {} orders completed. Avg completion time = {}ms",
            orderCount, Math.round(avgMs));

        // Verify every semaphore returned to its initial capacity (no permit leak)
        assertSemaphoreFullyReleased(StationType.GRILL, 3);
        assertSemaphoreFullyReleased(StationType.FRYER, 2);
        assertSemaphoreFullyReleased(StationType.SALAD, 4);
        assertSemaphoreFullyReleased(StationType.DRINKS, 5);
        assertSemaphoreFullyReleased(StationType.DESSERT, 2);
    }

    private void assertSemaphoreFullyReleased(StationType type, int expectedCapacity) {
        int available = semaphoreRegistry.getAvailableSlots(type);
        assertThat(available)
            .withFailMessage("Semaphore for %s: available=%d, expected=%d — permit was not released!",
                type, available, expectedCapacity)
            .isEqualTo(expectedCapacity);
    }
}
