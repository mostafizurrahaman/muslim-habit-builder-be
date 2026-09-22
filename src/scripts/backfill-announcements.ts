import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { Announcement } from '../app/modules/dashboard/announcement/announcement.model';
import User from '../app/modules/user/user.model';
import { USER_STATUS } from '../app/modules/user/user.constant';
import { Notification } from '../app/modules/Notification/notification.model';
import { notificationServices } from '../app/modules/Notification/notification.services';

async function backfill() {
  const mongoUri = process.env.MONGODB_URL;
  if (!mongoUri) {
    throw new Error('MONGODB_URL not defined');
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const now = new Date();
  // Find currently active announcements
  const activeAnnouncements = await Announcement.find({
    status: { $ne: 'Expired' },
    startedAt: { $lte: now },
    endedAt: { $gte: now },
  });

  console.log(`Found ${activeAnnouncements.length} active announcements.`);

  const activeUsers = await User.find({ status: USER_STATUS.ACTIVE }).select('_id fullName');
  console.log(`Found ${activeUsers.length} active users.`);

  let totalCreated = 0;

  for (const announcement of activeAnnouncements) {
    for (const user of activeUsers) {
      // Check if notification already exists for this announcement and user
      const existing = await Notification.findOne({
        receiver: user._id,
        'meta.announcementId': announcement._id.toString(),
      });

      if (!existing) {
        await notificationServices.createNotification({
          receiver: user._id,
          title: `New Announcement: ${announcement.title}`,
          message: announcement.description || 'Check out the latest announcement in the app!',
          notificationType: 'ANNOUNCEMENT',
          meta: { announcementId: announcement._id.toString() },
        });
        totalCreated++;
      }
    }
  }

  console.log(`Successfully backfilled ${totalCreated} announcement notifications.`);
  await mongoose.disconnect();
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error backfilling:', err);
    process.exit(1);
  });
