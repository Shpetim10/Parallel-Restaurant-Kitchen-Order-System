package com.kds.service;

import com.kds.concurrency.BarrierCoordinator;
import com.kds.concurrency.OrderLockManager;
import com.kds.dto.OrderRequest;
import com.kds.enums.ComponentStatus;
import com.kds.enums.OrderStatus;
import com.kds.enums.StationType;
import com.kds.model.Order;
import com.kds.model.OrderComponent;
import com.kds.state.OrderStore;
import com.kds.websocket.KitchenEventPublisher;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.stream.Collectors;

@Service
@Slf4j
public class OrderService {

    @Autowired private OrderStore         orderStore;
    @Autowired private StationDispatcher  stationDispatcher;
    @Autowired private BarrierCoordinator barrierCoordinator;
    @Autowired private OrderLockManager   lockManager;
    @Autowired private KitchenEventPublisher eventPublisher;

    @Autowired
    @Qualifier("barrierActionPool")
    private ExecutorService barrierActionPool;

    // ── Create ────────────────────────────────────────────────────────────────

    public Order createOrder(OrderRequest request) {
        String orderId = UUID.randomUUID().toString();

        // 1. Build components with ±20% cook-time variation
        List<OrderComponent> components = new ArrayList<>();
        for (var item : request.getItems()) {
            long cookTimeMs = (long)(item.getCookTimeMs() * (0.8 + Math.random() * 0.4));

            OrderComponent component = OrderComponent.builder()
                .id(UUID.randomUUID().toString())
                .name(item.getName())
                .stationType(item.getStationType())
                .status(ComponentStatus.PENDING)
                .cookTimeMs(cookTimeMs)
                .build();

            components.add(component);
        }

        // 2. Build order
        Order order = Order.builder()
            .id(orderId)
            .tableNumber(request.getTableNumber())
            .orderStatus(OrderStatus.PENDING)
            .components(components)
            .createdAt(Instant.now())
            .build();

        // 3. Persist
        orderStore.save(order);

        // 4. Distinct stations involved
        Set<StationType> involvedStations = components.stream()
            .map(OrderComponent::getStationType)
            .collect(Collectors.toSet());

        // 5. Create CyclicBarrier sized to distinct station count
        //    Barrier fires when every station coordinator calls await()
        barrierCoordinator.createBarrier(orderId, involvedStations.size());

        // 6. For each station: submit a coordinator that dispatches all its
        //    components, waits for them via CountDownLatch, then hits the barrier
        Map<StationType, List<OrderComponent>> byStation = components.stream()
            .collect(Collectors.groupingBy(OrderComponent::getStationType));

        byStation.forEach((stationType, stationComponents) -> {
            CountDownLatch stationLatch = new CountDownLatch(stationComponents.size());

            barrierActionPool.submit(() -> {
                // a. Dispatch all components for this station
                for (OrderComponent component : stationComponents) {
                    stationDispatcher.dispatch(order, component, stationLatch);
                }

                log.debug("Station coordinator [{}] waiting for {} component(s) — order {}",
                    stationType.getDisplayName(), stationComponents.size(), orderId);

                // b. Wait for all components at this station to finish
                try {
                    boolean completed = stationLatch.await(120, TimeUnit.SECONDS);
                    if (!completed) {
                        log.warn("Station [{}] latch timed out for order {}",
                            stationType.getDisplayName(), orderId);
                    }

                    // All components for this station are done — arrive at barrier
                    log.debug("Station coordinator [{}] hitting barrier for order {}",
                        stationType.getDisplayName(), orderId);
                    barrierCoordinator.await(orderId);

                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    log.error("Station coordinator [{}] interrupted for order {}",
                        stationType.getDisplayName(), orderId);
                } catch (BrokenBarrierException | TimeoutException e) {
                    log.error("Station coordinator [{}] barrier error for order {}: {}",
                        stationType.getDisplayName(), orderId, e.getMessage());
                }
            });
        });

        // 7. Mark IN_PREPARATION and publish creation event
        order.setOrderStatus(OrderStatus.IN_PREPARATION);
        orderStore.save(order);
        eventPublisher.publishOrderCreated(order);

        // 8. Log summary
        log.info("Order {} created for table {} — {} components across {} station(s)",
            orderId, request.getTableNumber(), components.size(), involvedStations.size());

        return order;
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    public Optional<Order> getOrder(String id) {
        return orderStore.findById(id);
    }

    public List<Order> getAllOrders() {
        return orderStore.findAll();
    }

    public List<Order> getOrdersByStatus(OrderStatus status) {
        return orderStore.findByStatus(status);
    }

    // ── Collect (blocks on Condition until order is READY) ────────────────────

    /**
     * Concept 4 — CONDITION VARIABLE:
     * The calling thread (waiter's HTTP thread) blocks on the order's Condition
     * until the barrier action signals READY or the timeout elapses.
     */
    public Order collectOrder(String orderId, long timeoutMs) throws InterruptedException {
        Order order = orderStore.findById(orderId)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Order not found: " + orderId));

        // Fast path — already ready
        if (order.getOrderStatus() == OrderStatus.READY) {
            order.setOrderStatus(OrderStatus.COLLECTED);
            order.setCollectedAt(Instant.now());
            orderStore.save(order);
            log.info("Order {} collected immediately (was already READY)", orderId);
            return order;
        }

        // Slow path — wait on Condition
        order.lockOrder();
        try {
            order.awaitReady(timeoutMs);
        } finally {
            order.unlockOrder();
        }

        order.setOrderStatus(OrderStatus.COLLECTED);
        order.setCollectedAt(Instant.now());
        orderStore.save(order);
        log.info("Order {} collected after await (elapsed {}ms)",
            orderId, order.totalElapsedMs());
        return order;
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    public void cancelOrder(String orderId) {
        Order order = orderStore.findById(orderId)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Order not found: " + orderId));

        lockManager.withLock(orderId, () -> order.setOrderStatus(OrderStatus.CANCELLED));
        barrierCoordinator.removeBarrier(orderId);
        eventPublisher.publishOrderCancelled(order);
        log.info("Order {} cancelled", orderId);
    }
}
