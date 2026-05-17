package com.kds.dto;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.InstantDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.InstantSerializer;
import com.kds.enums.ComponentStatus;
import com.kds.enums.OrderStatus;
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
public class OrderEvent {

    /** COMPONENT_UPDATE | ORDER_READY | ORDER_CANCELLED */
    private String eventType;

    private String orderId;
    private int tableNumber;

    private String componentId;
    private String componentName;
    private StationType stationType;
    private ComponentStatus newStatus;
    private OrderStatus orderStatus;

    private int activeThreadsAtStation;
    private int availableSlotsAtStation;

    @JsonSerialize(using = InstantSerializer.class)
    @JsonDeserialize(using = InstantDeserializer.class)
    private Instant timestamp;

    private String processingThreadName;
}
