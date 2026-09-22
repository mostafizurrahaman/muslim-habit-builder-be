import cron, { ScheduledTask } from 'node-cron';
import { Announcement } from './announcement.model';
import User from '../../user/user.model';
import { USER_STATUS } from '../../user/user.constant';
import { notificationServices } from '../../Notification/notification.services';
import { Notification } from '../../Notification/notification.model';

/**
 * Checks and updates announcement statuses based on current date:
 * - Transitions 'Scheduled' -> 'Active' when startedAt <= now <= endedAt
 *   and broadcasts notifications to active users who haven't received it yet.
 * - Transitions 'Active'/'Scheduled' -> 'Expired' when endedAt < now.
 */
export const processAnnouncementLifecycle = async (): Promise<{ activatedCount: number; expiredCount: number }> => {
  const now = new Date();
  let activatedCount = 0;
  let expiredCount = 0;

  try {
    // 1. Transition Scheduled -> Active
    const scheduledToActivate = await Announcement.find({
      status: 'Scheduled',
      startedAt: { $lte: now },
      endedAt: { $gte: now },
    });

    if (scheduledToActivate.length > 0) {
      for (const announcement of scheduledToActivate) {
        announcement.status = 'Active';
        await announcement.save();
        activatedCount++;

        // Broadcast notification to active users who haven't received it yet
        try {
          const activeUsers = await User.find({ status: USER_STATUS.ACTIVE }).select('_id');
          if (activeUsers.length > 0) {
            for (const user of activeUsers) {
              const alreadyNotified = await Notification.findOne({
                receiver: user._id,
                'meta.announcementId': announcement._id.toString(),
              });
              if (!alreadyNotified) {
                await notificationServices.createNotification({
                  receiver: user._id,
                  title: `New Announcement: ${announcement.title}`,
                  message: announcement.description || 'Check out the latest announcement in the app!',
                  notificationType: 'ANNOUNCEMENT',
                  meta: { announcementId: announcement._id.toString() },
                });
              }
            }
          }
        } catch (notifErr) {
          console.error(`[AnnouncementScheduler] Failed to send notification for announcement ${announcement._id}:`, notifErr);
        }
      }
    }

    // 2. Transition Active/Scheduled -> Expired
    const expiredResult = await Announcement.updateMany(
      {
        status: { $ne: 'Expired' },
        endedAt: { $lt: now },
      },
      { $set: { status: 'Expired' } }
    );
    expiredCount = expiredResult.modifiedCount;

  } catch (error) {
    console.error('[AnnouncementScheduler] Error processing announcement lifecycle:', error);
  }

  return { activatedCount, expiredCount };
};

let announcementCronTask: ScheduledTask | null = null;

/**
 * Starts the announcement cron job using node-cron (runs every minute: '* * * * *')
 */
export const startAnnouncementScheduler = () => {
  if (announcementCronTask) return;

  console.log('\x1b[36m[AnnouncementScheduler] Announcement node-cron job initialized (schedule: * * * * *)\x1b[0m');

  // Initial execution on startup
  processAnnouncementLifecycle().catch((err) =>
    console.error('[AnnouncementScheduler] Initial run failed:', err),
  );

  // Schedule recurring cron job every minute
  announcementCronTask = cron.schedule('* * * * *', async () => {
    try {
      await processAnnouncementLifecycle();
    } catch (err) {
      console.error('[AnnouncementScheduler] Periodic cron check failed:', err);
    }
  });
};

/**
 * Gracefully stops the announcement node-cron job
 */
export const stopAnnouncementScheduler = () => {
  if (announcementCronTask) {
    announcementCronTask.stop();
    announcementCronTask = null;
    console.log('[AnnouncementScheduler] Announcement node-cron job stopped.');
  }
};
