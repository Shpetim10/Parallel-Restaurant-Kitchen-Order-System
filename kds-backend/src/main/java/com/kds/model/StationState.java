package com.kds.model;

import com.kds.enums.StationType;
import lombok.Getter;
import lombok.Setter;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

@Getter
@Setter
public class StationState {

    private StationType stationType;
    private String displayName;
    private String emoji;
    private int totalCapacity;
    private AtomicInteger availableSlots;
    private AtomicInteger activeThreads;
    private AtomicInteger waitingThreads;
    private AtomicLong totalProcessed;
    private AtomicLong averageCookTimeMs;

    public StationState(StationType stationType, int capacity) {
        this.stationType = stationType;
        this.displayName = stationType.getDisplayName();
        this.emoji = stationType.getEmoji();
        this.totalCapacity = capacity;
        this.availableSlots = new AtomicInteger(capacity);
        this.activeThreads = new AtomicInteger(0);
        this.waitingThreads = new AtomicInteger(0);
        this.totalProcessed = new AtomicLong(0);
        this.averageCookTimeMs = new AtomicLong(0);
    }

    public double getUtilizationPercent() {
        int used = totalCapacity - availableSlots.get();
        return totalCapacity == 0 ? 0.0 : (used * 100.0) / totalCapacity;
    }
}
