package com.kds.state;

import com.kds.enums.OrderStatus;
import com.kds.model.Order;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
@Slf4j
public class OrderStore {

    private final ConcurrentHashMap<String, Order> orders = new ConcurrentHashMap<>();
    // Preserves insertion order without locking on reads
    private final CopyOnWriteArrayList<String> orderIds = new CopyOnWriteArrayList<>();

    // ── Write operations ──────────────────────────────────────────────────────

    public void save(Order order) {
        orders.put(order.getId(), order);
        orderIds.addIfAbsent(order.getId());
        log.debug("Saved order {} (table {})", order.getId(), order.getTableNumber());
    }

    public void remove(String orderId) {
        orders.remove(orderId);
        orderIds.remove(orderId);
        log.debug("Removed order {}", orderId);
    }

    // ── Read operations ───────────────────────────────────────────────────────

    public Optional<Order> findById(String orderId) {
        return Optional.ofNullable(orders.get(orderId));
    }

    /** Returns all orders in insertion order. */
    public List<Order> findAll() {
        return orderIds.stream()
            .map(orders::get)
            .filter(o -> o != null)
            .toList();
    }

    public List<Order> findByStatus(OrderStatus status) {
        return orders.values().stream()
            .filter(o -> o.getOrderStatus() == status)
            .toList();
    }

    public int count() {
        return orders.size();
    }

    public boolean exists(String orderId) {
        return orders.containsKey(orderId);
    }

    // ── Aggregate stats ───────────────────────────────────────────────────────

    public Map<String, Object> getStats() {
        List<Order> all = findAll();

        long pending       = all.stream().filter(o -> o.getOrderStatus() == OrderStatus.PENDING).count();
        long inPrep        = all.stream().filter(o -> o.getOrderStatus() == OrderStatus.IN_PREPARATION).count();
        long ready         = all.stream().filter(o -> o.getOrderStatus() == OrderStatus.READY).count();

        OptionalDouble avgMs = all.stream()
            .filter(o -> o.getOrderStatus() == OrderStatus.READY
                      || o.getOrderStatus() == OrderStatus.COLLECTED)
            .mapToLong(Order::totalElapsedMs)
            .filter(ms -> ms >= 0)
            .average();

        return Map.of(
            "totalOrders",             all.size(),
            "pendingOrders",           pending,
            "inPreparationOrders",     inPrep,
            "readyOrders",             ready,
            "averageCompletionTimeMs", avgMs.isPresent() ? (long) avgMs.getAsDouble() : 0L
        );
    }
}
