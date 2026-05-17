package com.kds.dto;

import com.kds.enums.StationType;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderItemRequest {

    @NotNull
    private String menuItemId;

    @NotNull
    private String name;

    @NotNull
    private StationType stationType;

    @NotNull
    private Long cookTimeMs;
}
