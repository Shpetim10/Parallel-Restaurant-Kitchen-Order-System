package com.kds.concurrency;

import com.kds.enums.StationType;
import com.kds.model.StationState;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;

/**
 * Concept 1 — SEMAPHORE:
 * Each station has a fair Semaphore capping concurrent order slots.
 * Workers acquire before cooking and release in a finally block.
 */
@Component
@Slf4j
public class StationSemaphoreRegistry {

    @Value("${station.capacity.grill}")
    private int grillCapacity;

    @Value("${station.capacity.fryer}")
    private int fryerCapacity;

    @Value("${station.capacity.salad}")
    private int saladCapacity;

    @Value("${station.capacity.drinks}")
    private int drinksCapacity;

    @Value("${station.capacity.dessert}")
    private int dessertCapacity;

    private final Map<StationType, Semaphore> semaphores = new ConcurrentHashMap<>();
    private final Map<StationType, StationState> stationStates = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        Map<StationType, Integer> capacities = Map.of(
            StationType.GRILL,   grillCapacity,
            StationType.FRYER,   fryerCapacity,
            StationType.SALAD,   saladCapacity,
            StationType.DRINKS,  drinksCapacity,
            StationType.DESSERT, dessertCapacity
        );

        capacities.forEach((type, capacity) -> {
            semaphores.put(type, new Semaphore(capacity, true));   // fair=true: FIFO ordering
            stationStates.put(type, new StationState(type, capacity));
            log.info("Station {} initialized with capacity {}", type.getDisplayName(), capacity);
        });
    }

    // ── Acquire / Release ─────────────────────────────────────────────────────

    public void acquire(StationType stationType) throws InterruptedException {
        log.debug("Thread [{}] acquiring semaphore for station {}",
            Thread.currentThread().getName(), stationType.getDisplayName());

        semaphores.get(stationType).acquire();

        StationState state = stationStates.get(stationType);
        state.getAvailableSlots().decrementAndGet();
        state.getActiveThreads().incrementAndGet();

        log.debug("Thread [{}] ACQUIRED semaphore for station {} — {} slots remaining",
            Thread.currentThread().getName(), stationType.getDisplayName(),
            state.getAvailableSlots().get());
    }

    public void release(StationType stationType) {
        semaphores.get(stationType).release();

        StationState state = stationStates.get(stationType);
        state.getAvailableSlots().incrementAndGet();
        state.getActiveThreads().decrementAndGet();

        log.debug("Thread [{}] RELEASED semaphore for station {} — {} slots now free",
            Thread.currentThread().getName(), stationType.getDisplayName(),
            state.getAvailableSlots().get());
    }

    // ── Dynamic capacity adjustment ───────────────────────────────────────────

    /**
     * Replaces the station's semaphore with a new one at the requested capacity.
     * Drains remaining permits from the old semaphore so in-flight threads are
     * not affected; they will complete normally using the old reference.
     */
    public void updateCapacity(StationType stationType, int newCapacity) {
        Semaphore old = semaphores.get(stationType);
        old.drainPermits();
        semaphores.put(stationType, new Semaphore(newCapacity, true));

        StationState state = stationStates.get(stationType);
        state.setTotalCapacity(newCapacity);
        state.getAvailableSlots().set(newCapacity);

        log.info("Station {} capacity updated to {}", stationType.getDisplayName(), newCapacity);
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    public StationState getState(StationType stationType) {
        return stationStates.get(stationType);
    }

    public Map<StationType, StationState> getAllStates() {
        return Collections.unmodifiableMap(stationStates);
    }

    public int getAvailableSlots(StationType stationType) {
        return stationStates.get(stationType).getAvailableSlots().get();
    }
}
