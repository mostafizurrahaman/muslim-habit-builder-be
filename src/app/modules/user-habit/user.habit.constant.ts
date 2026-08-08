export const USER_HABIT_MESSAGES = {

  CREATED: 'Custom habit created successfully',
  ACTIVATED: 'User habit activated successfully',
  COMPLETED: 'User habit completed successfully',
  SKIPPED: 'User habit skipped successfully',
  DEACTIVATED: 'User habit deactivated successfully',
  CONTENT_FETCHED: 'Dynamic content fetched successfully',
  UPDATED: 'User habit updated successfully',
  DELETED: 'User habit deleted successfully',
  FETCHED: 'User habits fetched successfully',
  NOT_FOUND: 'User habit not found',
  PARENT_NOT_FOUND: 'Parent habit not found',
  HABIT_NOT_FOUND: 'Habit template not found',
  PARENT_CATEGORY_MISMATCH: 'Parent habit category does not match the new habit category',

}


export const HABIT_LOCATIONS = {
  HOME: "Home",
  MASJID: "Masjid",
  NULL: null,
} as const;
export type HabitLocation = (typeof HABIT_LOCATIONS)[keyof typeof HABIT_LOCATIONS];

export const TARGET_TYPES = {
  PAGE: "Page",
  JUZZ: "Juzz",
  MIN: "Min",
} as const;
export type TargetType = (typeof TARGET_TYPES)[keyof typeof TARGET_TYPES];

export const FREQUENCY_TYPES = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  EVERY_N_DAYS: "Every_N_Days",
} as const;
export type FrequencyType = (typeof FREQUENCY_TYPES)[keyof typeof FREQUENCY_TYPES];

export const WEEK_DAYS = {
  MON: "mon",
  TUE: "tue",
  WED: "wed",
  THU: "thu",
  FRI: "fri",
  SAT: "sat",
  SUN: "sun",
} as const;
export type WeekDay = (typeof WEEK_DAYS)[keyof typeof WEEK_DAYS];