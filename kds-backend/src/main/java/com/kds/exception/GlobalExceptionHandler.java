package com.kds.exception;

import com.kds.dto.ErrorResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(OrderNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleOrderNotFound(OrderNotFoundException ex) {
        ErrorResponse body = ErrorResponse.builder()
            .error("ORDER_NOT_FOUND")
            .message(ex.getMessage())
            .orderId(ex.getOrderId())
            .timestamp(Instant.now())
            .build();
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleIllegalState(IllegalStateException ex) {
        ErrorResponse body = ErrorResponse.builder()
            .error("CONFLICT")
            .message(ex.getMessage())
            .timestamp(Instant.now())
            .build();
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(InterruptedException.class)
    public ResponseEntity<ErrorResponse> handleInterrupted(InterruptedException ex) {
        Thread.currentThread().interrupt();
        ErrorResponse body = ErrorResponse.builder()
            .error("SERVICE_UNAVAILABLE")
            .message("Request was interrupted; please retry")
            .timestamp(Instant.now())
            .build();
        HttpHeaders headers = new HttpHeaders();
        headers.set("Retry-After", "5");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).headers(headers).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        List<Map<String, String>> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> Map.of(
                "field", fe.getField(),
                "message", fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "invalid"
            ))
            .toList();

        ErrorResponse body = ErrorResponse.builder()
            .error("VALIDATION_FAILED")
            .message("Request validation failed")
            .timestamp(Instant.now())
            .fieldErrors(fieldErrors)
            .build();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
