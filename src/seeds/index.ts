import mongoose from 'mongoose';
import { Faq } from '../app/modules/Faq/faq.model';
import { Bug } from '../app/modules/bug/bug.model';
import { Content } from '../app/modules/content/content.model';
import { AdhkarSet } from '../app/modules/dashboard/adhkar-set/adhkar.set.model';
import { Announcement } from '../app/modules/dashboard/announcement/announcement.model';
import { Discount } from '../app/modules/dashboard/discount/discount.model';
import { HabitTemplate } from '../app/modules/dashboard/habit-template/system.habit.model';
import { QuranContent } from '../app/modules/dashboard/quran-content/quran.content.model';
import { HabitLog } from '../app/modules/habit-logger/habit.logger.model';
import OtpToken from '../app/modules/otp-token/otp.token.model';
import { SessionModel } from '../app/modules/session/session.model';
import Subscription from '../app/modules/subscription/subscription.model';
import User from '../app/modules/user/user.model';
import { UserHabit } from '../app/modules/user-habit/user.habit.model';
import config from '../config';
import {
  seedAdhkarSets,
  seedAnnouncements,
  seedBugs,
  seedContent,
  seedDiscounts,
  seedFaqs,
  seedHabitLogs,
  seedHabitTemplates,
  seedOtpTokens,
  seedQuranContent,
  seedSessions,
  seedSubscriptions,
  seedUserHabits,
  seedUsers,
} from './seeders';
import { SeedContext, SeedResult } from './types';

const seededCollections: { name: string; clear: () => Promise<number> }[] = [
  { name: 'OtpToken', clear: async () => (await OtpToken.deleteMany({})).deletedCount },
  { name: 'Session', clear: async () => (await SessionModel.deleteMany({})).deletedCount },
  { name: 'Bug', clear: async () => (await Bug.deleteMany({})).deletedCount },
  { name: 'HabitLog', clear: async () => (await HabitLog.deleteMany({})).deletedCount },
  { name: 'UserHabit', clear: async () => (await UserHabit.deleteMany({})).deletedCount },
  { name: 'Subscription', clear: async () => (await Subscription.deleteMany({})).deletedCount },
  { name: 'Discount', clear: async () => (await Discount.deleteMany({})).deletedCount },
  { name: 'Announcement', clear: async () => (await Announcement.deleteMany({})).deletedCount },
  { name: 'Faq', clear: async () => (await Faq.deleteMany({})).deletedCount },
  { name: 'Content', clear: async () => (await Content.deleteMany({})).deletedCount },
  { name: 'HabitTemplate', clear: async () => (await HabitTemplate.deleteMany({})).deletedCount },
  { name: 'QuranContent', clear: async () => (await QuranContent.deleteMany({})).deletedCount },
  { name: 'AdhkarSet', clear: async () => (await AdhkarSet.deleteMany({})).deletedCount },
  { name: 'User', clear: async () => (await User.deleteMany({})).deletedCount },
];

export const clearSeedCollections = async (): Promise<void> => {
  console.log('\nClearing seeded collections...\n');

  for (const { name, clear } of seededCollections) {
    const deletedCount = await clear();
    console.log(`  ✓ ${name}: ${deletedCount} deleted`);
  }

  console.log('');
};

export const runAllSeeds = async (): Promise<SeedResult[]> => {
  const context: SeedContext = {};
  const results: SeedResult[] = [];

  console.log('\nStarting database seed...\n');

  results.push(await seedUsers(context));
  results.push(await seedAdhkarSets(context));
  results.push(await seedQuranContent(context));
  results.push(await seedHabitTemplates(context));
  results.push(await seedContent());
  results.push(await seedFaqs());
  results.push(await seedAnnouncements());
  results.push(await seedDiscounts());
  results.push(await seedSubscriptions(context));
  results.push(await seedUserHabits(context));
  results.push(await seedHabitLogs(context));
  results.push(await seedBugs(context));
  results.push(await seedSessions(context));
  results.push(await seedOtpTokens(context));

  const totalCreated = results.reduce((sum, item) => sum + item.created, 0);
  const totalSkipped = results.reduce((sum, item) => sum + item.skipped, 0);

  console.log('\nSeed completed.');
  console.log(`Total: ${totalCreated} created, ${totalSkipped} skipped across ${results.length} collections.\n`);

  return results;
};

export const connectAndSeed = async (options: { fresh?: boolean } = {}): Promise<void> => {
  await mongoose.connect(config.mongodb_url);
  console.log('Database connected.');

  try {
    if (options.fresh) {
      await clearSeedCollections();
    }

    await runAllSeeds();
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
};
