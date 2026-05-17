package com.kds.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ComponentStatus {
    PENDING("#5a5a7a"),
    IN_PROGRESS("#60a5fa"),
    DONE("#34d399"),
    FAILED("#ef4444");

    private final String color;
}
