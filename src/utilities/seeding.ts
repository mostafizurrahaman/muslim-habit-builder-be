
import { FREQUENCIES, HABIT_STATUS, HABIT_TYPES } from '../app/modules/dashboard/habit-template/system.habit.constant';
import { HabitTemplate } from '../app/modules/dashboard/habit-template/system.habit.model';
import { FREQUENCY_TYPES, HABIT_LOCATIONS } from '../app/modules/user-habit/user.habit.constant';
import { USER_ROLE, USER_STATUS } from '../app/modules/user/user.constant';
import User from '../app/modules/user/user.model';
import config from '../config';
import { HABIT_CATEGORIES, HABIT_LEVELS } from '../interfaces';
import { randomUserImage } from './randomUserImage';

const adminData = {
  fullName: 'ADMIN',
  role: USER_ROLE.SUPER_ADMIN,
  email: config.admin_email,
  password: config.admin_password,
  avatar: randomUserImage(),
  verification: {
    emailVerifiedAt: new Date(),
  },
  status: USER_STATUS.ACTIVE
};

export const ensureDefaultSunnahTemplate = async () => {
  try {
    const existing = await HabitTemplate.findOne({
      $or: [
        { name: { $regex: /^12 sunnah/i } },
        { habitType: HABIT_TYPES.SUNNAH_PRAYER },
      ],
    });

    if (!existing) {
      await HabitTemplate.create({
        name: '12 Sunnah Prayers',
        category: HABIT_CATEGORIES.PRAYER,
        connectedPrayer: null,
        allowConnectedPrayers: [],
        isPrayerLocked: true,
        habitType: HABIT_TYPES.SUNNAH_PRAYER,
        supportsLocation: HABIT_LOCATIONS.HOME,
        defaultFrequency: { type: FREQUENCY_TYPES.DAILY },
        allowedFrequencies: [FREQUENCIES.DAILY],
        level: HABIT_LEVELS.BEGINNER,
        isPreBuilt: true,
        isLocked: false,
        isGuestLocked: false,
        status: HABIT_STATUS.PUBLISHED,
        isActive: true,
        infoContent: 'Perform the 12 regular Sunnah (Rawatib) prayers daily.',
      });
      console.log('12 Sunnah Prayers template seeded successfully!');
    }
  } catch (error) {
    console.log('Error ensuring 12 Sunnah Prayers template', error);
  }
};

const seedingAdmin = async () => {
  try {
    const admin = await User.findOne({
      email: adminData.email,
    });
    if (!admin) {
      await User.create(adminData);

      console.log('admin seeded successfully!');
    } else {
      console.log('admin already exists!');
    }

    await ensureDefaultSunnahTemplate();
  } catch (error) {
    console.log('Error seeding super admin', error);
  }
};

export default seedingAdmin;

