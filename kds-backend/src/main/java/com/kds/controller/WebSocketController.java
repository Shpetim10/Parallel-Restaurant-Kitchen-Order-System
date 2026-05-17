package com.kds.controller;

import com.kds.dto.OrderRequest;
import com.kds.model.Order;
import com.kds.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
@Slf4j
public class WebSocketController {

    private final OrderService          orderService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Client sends to: /app/orders/submit
     * Creates the order and broadcasts the result back on /topic/orders.
     */
    @MessageMapping("/orders/submit")
    public void submitOrder(@Payload @Valid OrderRequest request) {
        log.info("WS /orders/submit — table={} items={}",
            request.getTableNumber(), request.getItems().size());
        try {
            Order order = orderService.createOrder(request);
            messagingTemplate.convertAndSend("/topic/orders", order);
        } catch (Exception e) {
            log.error("Failed to create order via WebSocket: {}", e.getMessage());
        }
    }

    /**
     * Client sends to: /app/orders/{id}/cancel
     */
    @MessageMapping("/orders/{id}/cancel")
    public void cancelOrder(@DestinationVariable String id) {
        log.info("WS /orders/{}/cancel", id);
        try {
            orderService.cancelOrder(id);
        } catch (Exception e) {
            log.error("Failed to cancel order {} via WebSocket: {}", id, e.getMessage());
        }
    }
}
