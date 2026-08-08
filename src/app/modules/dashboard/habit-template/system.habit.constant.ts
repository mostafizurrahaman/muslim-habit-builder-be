// habitTemplate.constant.ts

export const SYSTEM_HABIT_MESSAGES = {
  CREATED: 'System habit created successfully',
  UPDATED: 'System habit updated successfully',
  DELETED: 'System habit deleted successfully',
  FETCHED: 'System habits fetched successfully',
  NOT_FOUND: 'System habit not found',
  PARENT_NOT_FOUND: 'Parent habit not found',
  PARENT_CATEGORY_MISMATCH: 'Parent habit category does not match the new habit category',
  CREATION_FAILED: 'Failed to create system habit',
}

export const HABIT_STATUS ={
  DRAFT: 'draft',
  PUBLISHED: 'published'
}
export type HabitStatus = (typeof HABIT_STATUS)[keyof typeof HABIT_STATUS];

export const OBLIGATORY_PRAYER = {
  FAJR: 'Fajr',
  DHUHR: 'Dhuhr',
  ASR: 'Asr',
  MAGHRIB: 'Maghrib',
  ISHA: 'Isha And Witr',
}

export const HABIT_TYPES = {
  OBLIGATORY_PRAYER: "obligatory_prayer",
  SUNNAH_PRAYER: "sunnah_prayer",
  WITR: "witr",
  DUHA: "duha",
  NIGHT_PRAYER: "night_prayer",
  NAFL: "nafl",
  QURAN: "quran",
  ADHKAR: "adhkar",
  DHIKR: "dhikr",
  DEED: "deed",
} as const;


export const PRAYER_HABIT_TYPES = [
    HABIT_TYPES.OBLIGATORY_PRAYER,
    HABIT_TYPES.SUNNAH_PRAYER,
    HABIT_TYPES.WITR,
    HABIT_TYPES.DUHA,
    HABIT_TYPES.NIGHT_PRAYER,
    HABIT_TYPES.NAFL,
] as const;

export type HabitType = (typeof HABIT_TYPES)[keyof typeof HABIT_TYPES];

export const FREQUENCIES = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  EVERY_N_DAYS: "Every_N_Days",
} as const;

export type Frequency = (typeof FREQUENCIES)[keyof typeof FREQUENCIES];

