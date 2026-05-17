package com.kds.model;

import com.kds.enums.StationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MenuItem {

    private String id;
    private String name;
    private StationType stationType;
    private long baseCookTimeMs;
    private String emoji;
    private double price;

    /** Returns baseCookTimeMs with ±20% random variation. */
    public long variedCookTimeMs() {
        double factor = 0.8 + Math.random() * 0.4;
        return Math.round(baseCookTimeMs * factor);
    }

    public static class MenuRegistry {

        public static final List<MenuItem> ITEMS = List.of(
            // GRILL
            item("BURGER",       "Burger",       StationType.GRILL,   9_000,  "🍔", 12.50),
            item("STEAK",        "Steak",        StationType.GRILL,  14_000,  "🥩", 24.00),
            item("CHICKEN",      "Chicken",      StationType.GRILL,  11_000,  "🍗", 14.00),
            item("VEGGIE_PATTY", "Veggie Patty", StationType.GRILL,   8_000,  "🥦", 11.00),
            item("RIBS",         "Ribs",         StationType.GRILL,  13_000,  "🍖", 22.00),

            // FRYER
            item("FRIES",        "Fries",        StationType.FRYER,   6_000,  "🍟",  4.50),
            item("ONION_RINGS",  "Onion Rings",  StationType.FRYER,   7_000,  "🧅",  5.00),
            item("CALAMARI",     "Calamari",     StationType.FRYER,   8_000,  "🦑",  9.00),

            // SALAD
            item("CAESAR",       "Caesar",       StationType.SALAD,   4_000,  "🥗",  8.00),
            item("GARDEN",       "Garden",       StationType.SALAD,   3_000,  "🌿",  7.00),
            item("GREEK",        "Greek",        StationType.SALAD,   4_000,  "🫒",  8.50),

            // DRINKS
            item("COKE",         "Coke",         StationType.DRINKS,  1_000,  "🥤",  3.00),
            item("JUICE",        "Juice",        StationType.DRINKS,  1_000,  "🍊",  3.50),
            item("BEER",         "Beer",         StationType.DRINKS,  2_000,  "🍺",  5.50),
            item("WINE",         "Wine",         StationType.DRINKS,  3_000,  "🍷",  7.00),
            item("WATER",        "Water",        StationType.DRINKS,  1_000,  "💧",  1.50),
            item("MILKSHAKE",    "Milkshake",    StationType.DRINKS,  2_000,  "🥛",  5.00),

            // DESSERT
            item("ICE_CREAM",    "Ice Cream",    StationType.DESSERT, 3_000,  "🍦",  6.00),
            item("CAKE",         "Cake",         StationType.DESSERT, 5_000,  "🎂",  7.50),
            item("BROWNIE",      "Brownie",      StationType.DESSERT, 4_000,  "🍫",  6.50)
        );

        public static MenuItem findById(String id) {
            return ITEMS.stream()
                .filter(m -> m.getId().equals(id))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown menu item: " + id));
        }

        private static MenuItem item(String id, String name, StationType type,
                                     long cookMs, String emoji, double price) {
            return MenuItem.builder()
                .id(id).name(name).stationType(type)
                .baseCookTimeMs(cookMs).emoji(emoji).price(price)
                .build();
        }

        private MenuRegistry() {}
    }
}
