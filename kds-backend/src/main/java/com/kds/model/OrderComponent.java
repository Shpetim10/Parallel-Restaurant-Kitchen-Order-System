package com.kds.model;

import com.kds.enums.ComponentStatus;
import com.kds.enums.StationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderComponent {

    private String id;
    private String name;
    private StationType stationType;
    private volatile ComponentStatus status;
    private Instant startedAt;
    private Instant completedAt;
    private long cookTimeMs;
    private String threadName;

    public boolean isDone() {
        return status == ComponentStatus.DONE || status == ComponentStatus.FAILED;
    }
}
