package com.kds.controller;

import com.kds.concurrency.StationSemaphoreRegistry;
import com.kds.enums.StationType;
import com.kds.model.StationState;
import com.kds.service.SimulationService;
import com.kds.service.StationDispatcher;
import com.kds.websocket.KitchenEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collection;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Slf4j
public class StationController {

    private final StationSemaphoreRegistry semaphoreRegistry;
    private final StationDispatcher        stationDispatcher;
    private final SimulationService        simulationService;
    private final KitchenEventPublisher    eventPublisher;

    // ── Station endpoints ──────────────────────────────────────────────────────

    @GetMapping("/api/stations")
    public Collection<StationState> getAllStations() {
        return semaphoreRegistry.getAllStates().values();
    }

    @GetMapping("/api/stations/threads")
    public Map<StationType, Integer> getActiveTaskCounts() {
        return stationDispatcher.getActiveTaskCounts();
    }

    @GetMapping("/api/stations/{type}")
    public StationState getStation(@PathVariable StationType type) {
        StationState state = semaphoreRegistry.getState(type);
        if (state == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Station not found: " + type);
        }
        return state;
    }

    @PutMapping("/api/stations/{type}/capacity")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateCapacity(
        @PathVariable StationType type,
        @RequestBody Map<String, Integer> body) {

        Integer newCapacity = body.get("capacity");
        if (newCapacity == null || newCapacity < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "'capacity' must be a positive integer");
        }

        semaphoreRegistry.updateCapacity(type, newCapacity);
        log.info("Station {} capacity updated to {} via API",
            type.getDisplayName(), newCapacity);

        eventPublisher.publishStationUpdate(type, semaphoreRegistry.getState(type));
    }

    // ── Simulation endpoints ───────────────────────────────────────────────────

    @PostMapping("/api/simulation/start")
    public Map<String, Boolean> startSimulation() {
        simulationService.start();
        return Map.of("active", true);
    }

    @PostMapping("/api/simulation/stop")
    public Map<String, Boolean> stopSimulation() {
        simulationService.stop();
        return Map.of("active", false);
    }

    @GetMapping("/api/simulation/status")
    public Map<String, Boolean> simulationStatus() {
        return Map.of("active", simulationService.isActive());
    }
}
