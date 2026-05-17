package com.kds.service;

import com.kds.dto.OrderItemRequest;
import com.kds.dto.OrderRequest;
import com.kds.enums.OrderStatus;
import com.kds.enums.StationType;
import com.kds.model.MenuItem;
import com.kds.model.Order;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

@Service
@Slf4j
@RequiredArgsConstructor
public class SimulationService {

    private final OrderService orderService;
    private final Random random = new Random();

    private volatile boolean simulationActive = false;

    @Scheduled(fixedDelay = 8000)
    public void simulateOrder() {
        if (!simulationActive) return;

        int tableNumber = random.nextInt(20) + 1;

        // Pick 2-3 distinct station types
        List<StationType> allStations = List.of(StationType.values());
        List<StationType> shuffled = new ArrayList<>(allStations);
        Collections.shuffle(shuffled, random);
        int stationCount = 2 + random.nextInt(2); // 2 or 3
        List<StationType> chosenStations = shuffled.subList(0, stationCount);

        // Pick 2-4 items spread across chosen stations
        List<OrderItemRequest> items = new ArrayList<>();
        int totalItems = 2 + random.nextInt(3); // 2, 3, or 4
        for (int i = 0; i < totalItems; i++) {
            StationType station = chosenStations.get(i % chosenStations.size());
            MenuItem item = randomItemFromStation(station);
            items.add(OrderItemRequest.builder()
                .name(item.getName())
                .stationType(item.getStationType())
                .cookTimeMs(item.variedCookTimeMs())
                .build());
        }

        OrderRequest request = OrderRequest.builder()
            .tableNumber(tableNumber)
            .items(items)
            .build();

        orderService.createOrder(request);
        log.info("SIMULATION: Auto-submitted order for table {}", tableNumber);
    }

    @Scheduled(fixedDelay = 15000)
    public void simulateCollect() {
        if (!simulationActive) return;

        orderService.getOrdersByStatus(OrderStatus.READY).stream()
            .findFirst()
            .ifPresent(order -> {
                try {
                    orderService.collectOrder(order.getId(), 1000);
                    log.info("SIMULATION: Auto-collected order {} (table {})",
                        order.getId(), order.getTableNumber());
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } catch (Exception e) {
                    log.warn("SIMULATION: Failed to collect order {}: {}", order.getId(), e.getMessage());
                }
            });
    }

    public void start() {
        simulationActive = true;
        log.info("SIMULATION: Started");
    }

    public void stop() {
        simulationActive = false;
        log.info("SIMULATION: Stopped");
    }

    public boolean isActive() {
        return simulationActive;
    }

    private MenuItem randomItemFromStation(StationType station) {
        List<MenuItem> candidates = MenuItem.MenuRegistry.ITEMS.stream()
            .filter(m -> m.getStationType() == station)
            .toList();
        return candidates.get(random.nextInt(candidates.size()));
    }
}
