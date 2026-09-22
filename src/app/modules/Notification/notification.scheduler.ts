import moment from 'moment-timezone';
import { UserHabit } from '../user-habit/user.habit.model';
import { HabitLog } from '../habit-logger/habit.logger.model';
import { LOG_STATUS } from '../habit-logger/habit.logger.constant';
import { Notification } from './notification.model';
import { notificationServices } from './notification.services';
import { IUser } from '../user/user.interface';
import { FREQUENCY_TYPES } from '../user-habit/user.habit.constant';

/**
 * Normalizes time strings like "6:30 AM" or "06:30 am" to standard "hh:mm A" (e.g. "06:30 AM")
 */
const normalizeTimeStr = (timeStr?: string): string => {
  if (!timeStr) return '';
  const parsed = moment(timeStr.trim(), ['hh:mm A', 'h:mm A', 'hh:mma', 'h:mma', 'HH:mm']);
  return parsed.isValid() ? parsed.format('hh:mm A') : timeStr.trim();
};

/**
 * Checks if a habit is scheduled for today based on its frequency
 */
const isHabitScheduledForToday = (
  frequency: { type: string; selectedDays?: string[]; everyNDays?: number },
  startDate: Date,
  todayDayName: string,
  todayDateStr: string,
): boolean => {
  if (!frequency || !frequency.type) return true;

  switch (frequency.type) {
    case FREQUENCY_TYPES.DAILY:
      return true;

    case FREQUENCY_TYPES.WEEKLY: {
      if (!frequency.selectedDays?.length) return false;
      return frequency.selectedDays
        .map((d) => d.toLowerCase())
        .includes(todayDayName.toLowerCase());
    }

    case FREQUENCY_TYPES.EVERY_N_DAYS: {
      if (!frequency.everyNDays) return false;
      const start = moment(startDate).startOf('day');
      const today = moment(todayDateStr, 'YYYY-MM-DD').startOf('day');
      const diffDays = today.diff(start, 'days');
      return diffDays >= 0 && diffDays % frequency.everyNDays === 0;
    }

    default:
      return true;
  }
};

/**
 * Core engine that checks active habits and sends reminder notifications
 */
export const processHabitReminders = async (): Promise<{ sentCount: number }> => {
  let sentCount = 0;

  try {
    // 1. Fetch all active habits that have reminder enabled
    const activeHabitsWithReminder = await UserHabit.find({
      isActive: true,
      'reminder.enabled': true,
      'reminder.time': { $exists: true, $ne: null },
    })
      .populate<{ user: IUser }>('user')
      .lean();

    if (!activeHabitsWithReminder.length) {
      return { sentCount: 0 };
    }

    for (const habit of activeHabitsWithReminder) {
      const user = habit.user;
      if (!user || !user._id) continue;

      // Skip if user turned off notifications
      if (user.hasNotification === false) continue;

      // User's timezone
      const userTimezone = user.timezone || 'UTC';
      const userCurrentMoment = moment().tz(userTimezone);
      const userCurrentTimeStr = userCurrentMoment.format('hh:mm A');
      const userDateStr = userCurrentMoment.format('YYYY-MM-DD');
      const userDayName = userCurrentMoment.format('ddd').toLowerCase();

      // Check if current user time matches reminder time
      const habitReminderTime = normalizeTimeStr(habit.reminder?.time);
      if (habitReminderTime !== userCurrentTimeStr) {
        continue;
      }

      // Check if habit is scheduled for today
      const isScheduledToday = isHabitScheduledForToday(
        habit.frequency as any,
        habit.startDate,
        userDayName,
        userDateStr,
      );
      if (!isScheduledToday) {
        continue;
      }

      // Check if habit is ALREADY completed today
      const isCompleted = await HabitLog.exists({
        user: user._id,
        userHabit: habit._id,
        date: userDateStr,
        status: LOG_STATUS.COMPLETED,
      });
      if (isCompleted) {
        continue;
      }

      // Check if reminder was ALREADY sent today for this habit (deduplication)
      const alreadyReminded = await Notification.exists({
        receiver: user._id,
        notificationType: 'HABIT_REMINDER',
        'meta.habitId': habit._id.toString(),
        'meta.reminderDate': userDateStr,
      });
      if (alreadyReminded) {
        continue;
      }

      // Send the reminder notification (saves to DB + dispatches FCM push)
      try {
        await notificationServices.createNotification({
          receiver: user._id,
          title: `Reminder: ${habit.name} ⏰`,
          message: `It's time for "${habit.name}". Take a few moments to fulfill your habit!`,
          notificationType: 'HABIT_REMINDER',
          meta: {
            habitId: habit._id.toString(),
            reminderDate: userDateStr,
            reminderTime: habit.reminder?.time,
          },
        });
        sentCount++;
      } catch (err) {
        console.error(`[ReminderScheduler] Failed to send reminder for habit ${habit._id}:`, err);
      }
    }
  } catch (error) {
    console.error('[ReminderScheduler] Error processing habit reminders:', error);
  }

  return { sentCount };
};

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Starts the habit reminder background scheduler (runs every 60 seconds)
 */
export const startHabitReminderScheduler = () => {
  if (schedulerInterval) return;

  console.log('\x1b[36m[ReminderScheduler] Habit reminder scheduler initialized (checking every 60 seconds)\x1b[0m');

  // Initial run 5 seconds after boot
  setTimeout(() => {
    processHabitReminders().catch((err) =>
      console.error('[ReminderScheduler] Initial run failed:', err),
    );
  }, 5000);

  // Recurring check every 60 seconds
  schedulerInterval = setInterval(async () => {
    try {
      await processHabitReminders();
    } catch (err) {
      console.error('[ReminderScheduler] Periodic check failed:', err);
    }
  }, 60 * 1000);
};

/**
 * Stops the scheduler gracefully
 */
export const stopHabitReminderScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[ReminderScheduler] Habit reminder scheduler stopped.');
  }
};
