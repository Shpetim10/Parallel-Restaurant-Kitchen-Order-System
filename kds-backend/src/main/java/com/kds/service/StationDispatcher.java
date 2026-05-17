package com.kds.service;

import com.kds.concurrency.BarrierCoordinator;
import com.kds.concurrency.OrderLockManager;
import com.kds.concurrency.StationSemaphoreRegistry;
import com.kds.concurrency.StationWorker;
import com.kds.enums.StationType;
import com.kds.model.Order;
import com.kds.model.OrderComponent;
import com.kds.state.OrderStore;
import com.kds.websocket.KitchenEventPublisher;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadPoolExecutor;

@Service
@Slf4j
public class StationDispatcher {

    // ── Named pool injection ───────────────────────────────────────────────────

    @Autowired @Qualifier("grillPool")   private ExecutorService grillPool;
    @Autowired @Qualifier("fryerPool")   private ExecutorService fryerPool;
    @Autowired @Qualifier("saladPool")   private ExecutorService saladPool;
    @Autowired @Qualifier("drinksPool")  private ExecutorService drinksPool;
    @Autowired @Qualifier("dessertPool") private ExecutorService dessertPool;

    // ── Worker dependency injection ────────────────────────────────────────────

    @Autowired private StationSemaphoreRegistry semaphoreRegistry;
    @Autowired private BarrierCoordinator       barrierCoordinator;
    @Autowired private OrderLockManager         lockManager;
    @Autowired private KitchenEventPublisher    eventPublisher;
    @Autowired private OrderStore               orderStore;

    private Map<StationType, ExecutorService> poolMap;

    @PostConstruct
    public void init() {
        poolMap = new EnumMap<>(StationType.class);
        poolMap.put(StationType.GRILL,   grillPool);
        poolMap.put(StationType.FRYER,   fryerPool);
        poolMap.put(StationType.SALAD,   saladPool);
        poolMap.put(StationType.DRINKS,  drinksPool);
        poolMap.put(StationType.DESSERT, dessertPool);
        log.info("StationDispatcher initialised with {} station pools", poolMap.size());
    }

    // ── Dispatch ───────────────────────────────────────────────────────────────

    /**
     * Submits a {@link StationWorker} to the appropriate station pool.
     *
     * @param stationLatch per-station CountDownLatch; worker counts down when done,
     *                     coordinator awaits then hits the CyclicBarrier once.
     *                     Pass null for single-component stations (worker hits barrier directly).
     */
    public Future<?> dispatch(Order order, OrderComponent component, CountDownLatch stationLatch) {
        StationType stationType = component.getStationType();
        ExecutorService pool = poolMap.get(stationType);

        StationWorker worker = new StationWorker(
            order, component, stationType,
            semaphoreRegistry, barrierCoordinator, lockManager,
            eventPublisher, orderStore,
            stationLatch
        );

        Future<?> future = pool.submit(worker);

        log.info("Dispatched [{}] to {} pool (latch={})",
            component.getName(), stationType.getDisplayName(),
            stationLatch != null ? stationLatch.getCount() : "none");

        return future;
    }

    // ── Observability ──────────────────────────────────────────────────────────

    /** Returns the number of actively executing threads per station pool. */
    public Map<StationType, Integer> getActiveTaskCounts() {
        Map<StationType, Integer> counts = new EnumMap<>(StationType.class);
        poolMap.forEach((type, pool) -> {
            if (pool instanceof ThreadPoolExecutor tpe) {
                counts.put(type, tpe.getActiveCount());
            } else {
                counts.put(type, 0);
            }
        });
        return counts;
    }
}
