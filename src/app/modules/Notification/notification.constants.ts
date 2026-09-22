export const notificationSearchableFields = ['title', 'message'] as const;

export const notificationType = {
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  HABIT_REMINDER: 'HABIT_REMINDER',
  PRAYER_REMINDER: 'PRAYER_REMINDER',
  STREAK_MILESTONE: 'STREAK_MILESTONE',
  BADGE_UNLOCKED: 'BADGE_UNLOCKED',
  BUG_UPDATE: 'BUG_UPDATE',
  SYSTEM_ALERT: 'SYSTEM_ALERT',
  GENERAL: 'GENERAL',
} as const;

export const notificationTypeValues = Object.values(notificationType);

export const notificationSortableFields = ['createdAt', 'updatedAt'] as const;

// Types (optional but recommended)
export type TNotificationSearchableField = (typeof notificationSearchableFields)[number];

export type TNotificationSortableField = (typeof notificationSortableFields)[number];

export type TNotificationType = (typeof notificationType)[keyof typeof notificationType];
