package com.kds.config;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Concept 5 — THREAD POOL:
 * One fixed pool per station, sized to match that station's semaphore capacity.
 * Named threads make stack traces and logs immediately identifiable.
 */
@Configuration
@Slf4j
public class ThreadPoolConfig {

    private final List<ExecutorService> allPools = new ArrayList<>();

    // ── Per-station fixed pools ───────────────────────────────────────────────

    @Bean("grillPool")
    public ExecutorService grillPool() {
        return tracked(Executors.newFixedThreadPool(3, namedFactory("grill")));
    }

    @Bean("fryerPool")
    public ExecutorService fryerPool() {
        return tracked(Executors.newFixedThreadPool(2, namedFactory("fryer")));
    }

    @Bean("saladPool")
    public ExecutorService saladPool() {
        return tracked(Executors.newFixedThreadPool(4, namedFactory("salad")));
    }

    @Bean("drinksPool")
    public ExecutorService drinksPool() {
        return tracked(Executors.newFixedThreadPool(5, namedFactory("drinks")));
    }

    @Bean("dessertPool")
    public ExecutorService dessertPool() {
        return tracked(Executors.newFixedThreadPool(2, namedFactory("dessert")));
    }

    // ── Barrier action pool (unbounded — barrier callbacks are short-lived) ───

    @Bean("barrierActionPool")
    public ExecutorService barrierActionPool() {
        return tracked(Executors.newCachedThreadPool(namedFactory("barrier")));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private ExecutorService tracked(ExecutorService pool) {
        allPools.add(pool);
        return pool;
    }

    private ThreadFactory namedFactory(String station) {
        AtomicInteger counter = new AtomicInteger(0);
        return runnable -> {
            Thread t = new Thread(runnable,
                station + "-worker-" + counter.incrementAndGet());
            t.setDaemon(true);
            return t;
        };
    }

    // ── Graceful shutdown ─────────────────────────────────────────────────────

    @PreDestroy
    public void shutdown() {
        log.info("Shutting down {} thread pools...", allPools.size());
        allPools.forEach(ExecutorService::shutdown);
        allPools.forEach(pool -> {
            try {
                if (!pool.awaitTermination(5, TimeUnit.SECONDS)) {
                    log.warn("Pool did not terminate cleanly — forcing shutdown");
                    pool.shutdownNow();
                }
            } catch (InterruptedException e) {
                pool.shutdownNow();
                Thread.currentThread().interrupt();
            }
        });
        log.info("All thread pools shut down.");
    }
}
