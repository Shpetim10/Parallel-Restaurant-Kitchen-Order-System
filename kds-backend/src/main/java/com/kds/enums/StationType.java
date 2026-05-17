package com.kds.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum StationType {
    GRILL("Grill Station", "🔥", 8000),
    FRYER("Fryer Station", "🍟", 6000),
    SALAD("Salad Station", "🥗", 4000),
    DRINKS("Drinks Station", "🥤", 1000),
    DESSERT("Dessert Station", "🍰", 3000);

    private final String displayName;
    private final String emoji;
    private final long defaultCookTimeMs;
}
