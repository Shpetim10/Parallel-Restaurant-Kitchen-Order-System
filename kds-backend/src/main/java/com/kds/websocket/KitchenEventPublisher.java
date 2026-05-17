package com.kds.websocket;

import com.kds.dto.OrderEvent;
import com.kds.dto.StationEvent;
import com.kds.enums.StationType;
import com.kds.model.Order;
import com.kds.model.OrderComponent;
import com.kds.model.StationState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@RequiredArgsConstructor
@Slf4j
public class KitchenEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    // ── Component lifecycle update ─────────────────────────────────────────────

    public void publishComponentUpdate(Order order, OrderComponent component,
                                       StationState stationState) {
        OrderEvent event = OrderEvent.builder()
            .eventType("COMPONENT_UPDATE")
            .orderId(order.getId())
            .tableNumber(order.getTableNumber())
            .componentId(component.getId())
            .componentName(component.getName())
            .stationType(component.getStationType())
            .newStatus(component.getStatus())
            .orderStatus(order.getOrderStatus())
            .activeThreadsAtStation(stationState.getActiveThreads().get())
            .availableSlotsAtStation(stationState.getAvailableSlots().get())
            .processingThreadName(component.getThreadName())
            .timestamp(Instant.now())
            .build();

        messagingTemplate.convertAndSend("/topic/orders/" + order.getId(), event);
        messagingTemplate.convertAndSend("/topic/orders", event);

        log.debug("COMPONENT_UPDATE published — order={} component={} status={} thread={}",
            order.getId(), component.getName(), component.getStatus(),
            component.getThreadName());
    }

    // ── Order ready (barrier fired) ───────────────────────────────────────────

    public void publishOrderReady(Order order) {
        OrderEvent event = OrderEvent.builder()
            .eventType("ORDER_READY")
            .orderId(order.getId())
            .tableNumber(order.getTableNumber())
            .orderStatus(order.getOrderStatus())
            .timestamp(Instant.now())
            .build();

        messagingTemplate.convertAndSend("/topic/orders/" + order.getId(), event);
        messagingTemplate.convertAndSend("/topic/orders", event);
        messagingTemplate.convertAndSend("/topic/ready", event);

        log.info("ORDER_READY published — order={} table={} elapsed={}ms",
            order.getId(), order.getTableNumber(), order.totalElapsedMs());
    }

    // ── Station state snapshot ─────────────────────────────────────────────────

    public void publishStationUpdate(StationType stationType, StationState state) {
        StationEvent event = StationEvent.builder()
            .stationType(stationType)
            .displayName(state.getDisplayName())
            .emoji(state.getEmoji())
            .totalCapacity(state.getTotalCapacity())
            .availableSlots(state.getAvailableSlots().get())
            .activeThreads(state.getActiveThreads().get())
            .totalProcessed(state.getTotalProcessed().get())
            .averageCookTimeMs(state.getAverageCookTimeMs().get())
            .utilizationPercent(state.getUtilizationPercent())
            .timestamp(Instant.now())
            .build();

        messagingTemplate.convertAndSend("/topic/stations", event);
        messagingTemplate.convertAndSend("/topic/stations/" + stationType.name().toLowerCase(), event);

        log.debug("STATION_UPDATE published — station={} utilization={:.1f}% slots={}",
            stationType.getDisplayName(), state.getUtilizationPercent(),
            state.getAvailableSlots().get());
    }

    // ── Order cancelled ───────────────────────────────────────────────────────

    public void publishOrderCancelled(Order order) {
        OrderEvent event = OrderEvent.builder()
            .eventType("ORDER_CANCELLED")
            .orderId(order.getId())
            .tableNumber(order.getTableNumber())
            .orderStatus(order.getOrderStatus())
            .timestamp(Instant.now())
            .build();

        messagingTemplate.convertAndSend("/topic/orders/" + order.getId(), event);
        messagingTemplate.convertAndSend("/topic/orders", event);

        log.info("ORDER_CANCELLED published — order={} table={}",
            order.getId(), order.getTableNumber());
    }
}
