
export const CONNECTED_PRAYERS = {
    FAJR: "Fajr",
    DHUHR: "Dhuhr",
    ASR: "Asr",
    MAGHRIB: "Maghrib",
    ISHA: "Isha",
    ISHA_AND_WITR: "Isha And Witr",
    FIVE_PRAYERS: "Five Prayers",
    NAFL: "Nafl",
    DUHA: "Duha",
    NIGHT_PRAYER: "Night Prayer",
    NULL: null,
} as const;
export type ConnectedPrayer = (typeof CONNECTED_PRAYERS)[keyof typeof CONNECTED_PRAYERS];


export const ALLOW_CONNECTED_PRAYERS = {
    FAJR: "Fajr",
    DHUHR: "Dhuhr",
    ASR: "Asr",
    MAGHRIB: "Maghrib",
    ISHA: "Isha",
    ISHA_AND_WITR: "Isha And Witr",
    NULL: null,
} as const;
export type AllowedConnectedPrayer = (typeof ALLOW_CONNECTED_PRAYERS)[keyof typeof ALLOW_CONNECTED_PRAYERS];


export const HABIT_CATEGORIES = {
    PRAYER: "Prayer",
    QURAN: "Quran",
    DHIKR: "Dhikr",
    DEEDS: "Deeds",
} as const;
export type HabitCategory = (typeof HABIT_CATEGORIES)[keyof typeof HABIT_CATEGORIES];


export const HABIT_LEVELS = {
    BEGINNER: "Beginner",
    INTERMEDIATE: "Intermediate",
    ADVANCED: "Advanced",
    CUSTOM: "Custom",
} as const;

export type HabitLevel = (typeof HABIT_LEVELS)[keyof typeof HABIT_LEVELS];