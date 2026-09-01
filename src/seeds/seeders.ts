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
import { randomUserImage } from '../utilities/randomUserImage';
import {
  seedAdhkarSetsData,
  seedAnnouncementsData,
  seedBugsData,
  seedContentData,
  seedDiscountsData,
  seedFaqsData,
  seedHabitLogsData,
  seedHabitTemplatesData,
  seedOtpTokensData,
  seedQuranContentData,
  seedSessionsData,
  seedSubscriptionsData,
  seedUserHabitsData,
  seedUsersData,
} from './seed.data';
import { SeedContext, SeedResult } from './types';

const logResult = (result: SeedResult) => {
  console.log(`  ✓ ${result.collection}: ${result.created} created, ${result.skipped} skipped`);
};

export const seedUsers = async (context: SeedContext): Promise<SeedResult> => {
  let created = 0;
  let skipped = 0;

  for (const userData of seedUsersData) {
    const email = userData.key === 'admin' ? config.admin_email : userData.email;
    const password = userData.key === 'admin' ? config.admin_password : userData.password;

    const existing = await User.findOne({ email });
    if (existing) {
      if (userData.key === 'admin') context.adminUserId = existing._id;
      if (userData.key === 'regular') context.regularUserId = existing._id;
      skipped += 1;
      continue;
    }

    const { key, email: _email, password: _password, ...rest } = userData;

    const user = await User.create({
      ...rest,
      email,
      password,
      avatar: randomUserImage(),
    });

    if (key === 'admin') context.adminUserId = user._id;
    if (key === 'regular') context.regularUserId = user._id;
    created += 1;
  }

  const result = { collection: 'User', created, skipped };
  logResult(result);
  return result;
};

export const seedAdhkarSets = async (context: SeedContext): Promise<SeedResult> => {
  let created = 0;
  let skipped = 0;

  for (const adhkarData of seedAdhkarSetsData) {
    const existing = await AdhkarSet.findOne({ name: adhkarData.name });
    if (existing) {
      context.adhkarSetId = existing._id;
      skipped += 1;
      continue;
    }

    const adhkarSet = await AdhkarSet.create(adhkarData);
    context.adhkarSetId = adhkarSet._id;
    created += 1;
  }

  const result = { collection: 'AdhkarSet', created, skipped };
  logResult(result);
  return result;
};

export const seedQuranContent = async (context: SeedContext): Promise<SeedResult> => {
  let created = 0;
  let skipped = 0;

  for (const quranData of seedQuranContentData) {
    const existing = await QuranContent.findOne({ name: quranData.name });
    if (existing) {
      context.quranContentId = existing._id;
      skipped += 1;
      continue;
    }

    const quranContent = await QuranContent.create(quranData);
    context.quranContentId = quranContent._id;
    created += 1;
  }

  const result = { collection: 'QuranContent', created, skipped };
  logResult(result);
  return result;
};

export const seedHabitTemplates = async (context: SeedContext): Promise<SeedResult> => {
  let created = 0;
  let skipped = 0;

  for (const templateData of seedHabitTemplatesData) {
    const existing = await HabitTemplate.findOne({ name: templateData.name });
    if (existing) {
      if (templateData.name === 'Fajr Prayer') context.habitTemplateId = existing._id;
      skipped += 1;
      continue;
    }

    const { linkAdhkarSet, linkQuranContent, ...habitData } = templateData;

    const habitTemplate = await HabitTemplate.create({
      ...habitData,
      adhkarSet: linkAdhkarSet ? context.adhkarSetId ?? null : null,
      quranContent: linkQuranContent ? context.quranContentId ?? null : null,
    });

    if (templateData.name === 'Fajr Prayer') context.habitTemplateId = habitTemplate._id;
    created += 1;
  }

  const result = { collection: 'HabitTemplate', created, skipped };
  logResult(result);
  return result;
};

export const seedContent = async (): Promise<SeedResult> => {
  let created = 0;
  let skipped = 0;

  for (const contentData of seedContentData) {
    const existing = await Content.findOne({ type: contentData.type });
    if (existing) {
      skipped += 1;
      continue;
    }

    await Content.create(contentData);
    created += 1;
  }

  const result = { collection: 'Content', created, skipped };
  logResult(result);
  return result;
};

export const seedFaqs = async (): Promise<SeedResult> => {
  let created = 0;
  let skipped = 0;

  for (const faqData of seedFaqsData) {
    const existing = await Faq.findOne({ question: faqData.question });
    if (existing) {
      skipped += 1;
      continue;
    }

    await Faq.create(faqData);
    created += 1;
  }

  const result = { collection: 'Faq', created, skipped };
  logResult(result);
  return result;
};

export const seedAnnouncements = async (): Promise<SeedResult> => {
  let created = 0;
  let skipped = 0;

  for (const announcementData of seedAnnouncementsData) {
    const existing = await Announcement.findOne({ title: announcementData.title });
    if (existing) {
      skipped += 1;
      continue;
    }

    await Announcement.create(announcementData);
    created += 1;
  }

  const result = { collection: 'Announcement', created, skipped };
  logResult(result);
  return result;
};

export const seedDiscounts = async (): Promise<SeedResult> => {
  let created = 0;
  let skipped = 0;

  for (const discountData of seedDiscountsData) {
    const existing = await Discount.findOne({ code: discountData.code });
    if (existing) {
      skipped += 1;
      continue;
    }

    await Discount.create(discountData);
    created += 1;
  }

  const result = { collection: 'Discount', created, skipped };
  logResult(result);
  return result;
};

export const seedSubscriptions = async (context: SeedContext): Promise<SeedResult> => {
  let created = 0;
  let skipped = 0;

  for (const subscriptionData of seedSubscriptionsData) {
    const userId = subscriptionData.userKey === 'premium'
      ? await User.findOne({ email: 'fatima.khan@example.com' }).select('_id')
      : null;

    if (!userId) {
      skipped += 1;
      continue;
    }

    const existing = await Subscription.findOne({ user: userId._id, plan: subscriptionData.plan });
    if (existing) {
      skipped += 1;
      continue;
    }

    const { userKey, ...data } = subscriptionData;
    await Subscription.create({ ...data, user: userId._id });
    created += 1;
  }

  const result = { collection: 'Subscription', created, skipped };
  logResult(result);
  return result;
};

export const seedUserHabits = async (context: SeedContext): Promise<SeedResult> => {
  let created = 0;
  let skipped = 0;

  for (const userHabitData of seedUserHabitsData) {
    const userId = context.regularUserId;
    const template = await HabitTemplate.findOne({ name: userHabitData.templateName });

    if (!userId || !template) {
      skipped += 1;
      continue;
    }

    const existing = await UserHabit.findOne({ user: userId, template: template._id });
    if (existing) {
      context.userHabitId = existing._id;
      skipped += 1;
      continue;
    }

    const { userKey, templateName, ...habitData } = userHabitData;
    const userHabit = await UserHabit.create({
      ...habitData,
      user: userId,
      template: template._id,
    });

    context.userHabitId = userHabit._id;
    created += 1;
  }

  const result = { collection: 'UserHabit', created, skipped };
  logResult(result);
  return result;
};

export const seedHabitLogs = async (context: SeedContext): Promise<SeedResult> => {
  let created = 0;
  let skipped = 0;

  for (const logData of seedHabitLogsData) {
    const userId = context.regularUserId;
    const userHabitId = context.userHabitId;

    if (!userId || !userHabitId) {
      skipped += 1;
      continue;
    }

    const existing = await HabitLog.findOne({ userHabit: userHabitId, date: logData.date });
    if (existing) {
      skipped += 1;
      continue;
    }

    const { userKey, templateName, ...data } = logData;
    await HabitLog.create({
      ...data,
      user: userId,
      userHabit: userHabitId,
    });
    created += 1;
  }

  const result = { collection: 'HabitLog', created, skipped };
  logResult(result);
  return result;
};

export const seedBugs = async (context: SeedContext): Promise<SeedResult> => {
  let created = 0;
  let skipped = 0;

  for (const bugData of seedBugsData) {
    const reporterId = context.regularUserId;
    if (!reporterId) {
      skipped += 1;
      continue;
    }

    const existing = await Bug.findOne({ title: bugData.title });
    if (existing) {
      skipped += 1;
      continue;
    }

    const { reporterKey, ...data } = bugData;
    await Bug.create({
      ...data,
      originalReporter: reporterId,
      upvotedBy: [reporterId],
    });
    created += 1;
  }

  const result = { collection: 'Bug', created, skipped };
  logResult(result);
  return result;
};

export const seedSessions = async (context: SeedContext): Promise<SeedResult> => {
  let created = 0;
  let skipped = 0;

  for (const sessionData of seedSessionsData) {
    const userId = context.regularUserId;
    if (!userId) {
      skipped += 1;
      continue;
    }

    const existing = await SessionModel.findOne({ sessionId: sessionData.sessionId });
    if (existing) {
      skipped += 1;
      continue;
    }

    const { userKey, ...data } = sessionData;
    await SessionModel.create({ ...data, user: userId });
    created += 1;
  }

  const result = { collection: 'Session', created, skipped };
  logResult(result);
  return result;
};

export const seedOtpTokens = async (context: SeedContext): Promise<SeedResult> => {
  let created = 0;
  let skipped = 0;

  for (const otpData of seedOtpTokensData) {
    const userId = context.regularUserId;
    if (!userId) {
      skipped += 1;
      continue;
    }

    const existing = await OtpToken.findOne({ userId, type: otpData.type });
    if (existing) {
      skipped += 1;
      continue;
    }

    const { userKey, ...data } = otpData;
    await OtpToken.create({ ...data, userId });
    created += 1;
  }

  const result = { collection: 'OtpToken', created, skipped };
  logResult(result);
  return result;
};
