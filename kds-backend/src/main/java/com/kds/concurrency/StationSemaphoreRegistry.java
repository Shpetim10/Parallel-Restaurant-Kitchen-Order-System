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

        StationState state = stationStates.get(stationType);
        state.getWaitingThreads().incrementAndGet();
        try {
            semaphores.get(stationType).acquire();
        } finally {
            state.getWaitingThreads().decrementAndGet();
        }

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
     * Adjusts the existing semaphore's permit count to match the new capacity.
     * Mutating the live semaphore avoids the permit-leak that would occur if we
     * replaced it: in-flight workers acquired from the old reference and would
     * release into a brand-new one, injecting phantom permits.
     */
    public void updateCapacity(StationType stationType, int newCapacity) {
        Semaphore sem = semaphores.get(stationType);
        StationState state = stationStates.get(stationType);

        int oldCapacity = state.getTotalCapacity();
        int diff = newCapacity - oldCapacity;

        if (diff > 0) {
            sem.release(diff);
        } else if (diff < 0) {
            // Drain all free permits then add back only how many the new capacity allows.
            sem.drainPermits();
            int currentActive = state.getActiveThreads().get();
            int freeSlots = Math.max(0, newCapacity - currentActive);
            if (freeSlots > 0) sem.release(freeSlots);
        }

        int currentActive = state.getActiveThreads().get();
        int freeSlots = Math.max(0, newCapacity - currentActive);
        state.setTotalCapacity(newCapacity);
        state.getAvailableSlots().set(freeSlots);

        log.info("Station {} capacity updated {} → {} (active={}, free={})",
            stationType.getDisplayName(), oldCapacity, newCapacity, currentActive, freeSlots);
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
