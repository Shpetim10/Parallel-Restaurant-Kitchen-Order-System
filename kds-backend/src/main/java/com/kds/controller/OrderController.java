package com.kds.controller;

import com.kds.concurrency.BarrierCoordinator;
import com.kds.dto.OrderRequest;
import com.kds.enums.OrderStatus;
import com.kds.model.MenuItem;
import com.kds.model.Order;
import com.kds.service.OrderService;
import com.kds.state.OrderStore;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@Slf4j
public class OrderController {

    private final OrderService     orderService;
    private final OrderStore       orderStore;
    private final BarrierCoordinator barrierCoordinator;

    // ── POST /api/orders ──────────────────────────────────────────────────────

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Order createOrder(@Valid @RequestBody OrderRequest request) {
        log.info("POST /api/orders — table={} items={}", request.getTableNumber(),
            request.getItems().size());
        return orderService.createOrder(request);
    }

    // ── GET /api/orders ───────────────────────────────────────────────────────

    @GetMapping
    public List<Order> getAllOrders() {
        return orderService.getAllOrders();
    }

    // ── GET /api/orders/barriers ──────────────────────────────────────────────

    @GetMapping("/barriers")
    public List<Map<String, Object>> getBarrierState() {
        return barrierCoordinator.getBarrierProgress().entrySet().stream()
            .map(e -> {
                String orderId = e.getKey();
                int[] prog = e.getValue();
                Map<String, Object> entry = new java.util.LinkedHashMap<>();
                entry.put("orderId", orderId);
                entry.put("arrived", prog[0]);
                entry.put("total", prog[1]);
                orderStore.findById(orderId).ifPresent(o -> entry.put("tableNumber", o.getTableNumber()));
                return entry;
            })
            .toList();
    }

    // ── GET /api/orders/stats (before /{id} to avoid shadowing) ──────────────

    @GetMapping("/stats")
    public Map<String, Object> getStats() {
        return orderStore.getStats();
    }

    // ── GET /api/orders/menu ──────────────────────────────────────────────────

    @GetMapping("/menu")
    public List<MenuItem> getMenu() {
        return MenuItem.MenuRegistry.ITEMS;
    }

    // ── GET /api/orders/status/{status} ───────────────────────────────────────

    @GetMapping("/status/{status}")
    public List<Order> getByStatus(@PathVariable OrderStatus status) {
        return orderService.getOrdersByStatus(status);
    }

    // ── GET /api/orders/{id} ──────────────────────────────────────────────────

    @GetMapping("/{id}")
    public Order getOrder(@PathVariable String id) {
        return orderService.getOrder(id)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Order not found: " + id));
    }

    // ── POST /api/orders/{id}/collect ─────────────────────────────────────────

    @PostMapping("/{id}/collect")
    public ResponseEntity<Order> collectOrder(
        @PathVariable String id,
        @RequestParam(defaultValue = "30000") long timeoutMs) {

        try {
            Order order = orderService.collectOrder(id, timeoutMs);
            return ResponseEntity.ok(order);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Collection interrupted — try again");
        }
    }

    // ── DELETE /api/orders/{id} ───────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelOrder(@PathVariable String id) {
        orderService.cancelOrder(id);
    }
}
