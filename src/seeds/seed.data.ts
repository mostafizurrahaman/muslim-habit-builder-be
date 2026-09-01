import { CONTENT } from '../app/modules/content/content.constant';
import { ANNOUNCEMENT_STATUS } from '../app/modules/dashboard/announcement/announcement.constant';
import { BILLING_PLAN, DISCOUNT_STATUS } from '../app/modules/dashboard/discount/discount.constant';
import { FREQUENCIES, HABIT_STATUS, HABIT_TYPES } from '../app/modules/dashboard/habit-template/system.habit.constant';
import { BUG_FEATURES, BUG_STATUS } from '../app/modules/bug/bug.constant';
import { LOG_STATUS } from '../app/modules/habit-logger/habit.logger.constant';
import { SUBSCRIPTION_MODE, SUBSCRIPTION_PLAN, SUBSCRIPTION_STATUS } from '../app/modules/subscription/subscription.constant';
import { NOTIFICATION_TYPE, SUBSCRIPTION_PLAN as USER_SUBSCRIPTION_PLAN, USER_ROLE, USER_STATUS } from '../app/modules/user/user.constant';
import { FREQUENCY_TYPES, HABIT_LOCATIONS } from '../app/modules/user-habit/user.habit.constant';
import { ALLOW_CONNECTED_PRAYERS, CONNECTED_PRAYERS, HABIT_CATEGORIES, HABIT_LEVELS } from '../interfaces';

export const seedUsersData = [
  {
    key: 'admin',
    fullName: 'Super Admin',
    email: '', // filled from config at runtime
    password: '', // filled from config at runtime
    role: USER_ROLE.SUPER_ADMIN,
    status: USER_STATUS.ACTIVE,
    subscriptionPlan: USER_SUBSCRIPTION_PLAN.ALL_ACCESS,
    notificationType: NOTIFICATION_TYPE.VIBRATE,
    verification: { emailVerifiedAt: new Date() },
  },
  {
    key: 'regular',
    fullName: 'Ahmed Hassan',
    email: 'ahmed.hassan@example.com',
    password: 'User@123456',
    role: USER_ROLE.USER,
    status: USER_STATUS.ACTIVE,
    subscriptionPlan: USER_SUBSCRIPTION_PLAN.FREE,
    notificationType: NOTIFICATION_TYPE.SOUND,
    timezone: 'Asia/Dhaka',
    verification: { emailVerifiedAt: new Date() },
  },
  {
    key: 'premium',
    fullName: 'Fatima Khan',
    email: 'fatima.khan@example.com',
    password: 'User@123456',
    role: USER_ROLE.USER,
    status: USER_STATUS.ACTIVE,
    subscriptionPlan: USER_SUBSCRIPTION_PLAN.PREMIUM,
    notificationType: NOTIFICATION_TYPE.VIBRATE,
    timezone: 'Asia/Dhaka',
    verification: { emailVerifiedAt: new Date() },
  },
] as const;

export const seedAdhkarSetsData = [
  {
    name: 'Morning Adhkar',
    nameArabic: 'أذكار الصباح',
    totalCount: 3,
    items: [
      {
        title: 'Ayat al-Kursi',
        arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ',
        transliteration: 'Allahu la ilaha illa huwal hayyul qayyum',
        translation: 'Allah - there is no deity except Him, the Ever-Living, the Sustainer of existence.',
        virtue: 'Protection until evening',
        reference: 'Surah Al-Baqarah 2:255',
        count: 1,
        order: 1,
      },
      {
        title: 'Surah Al-Ikhlas',
        arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ',
        transliteration: 'Qul huwallahu ahad',
        translation: 'Say, He is Allah, the One.',
        virtue: 'Equivalent to one-third of the Quran',
        reference: 'Surah Al-Ikhlas 112:1',
        count: 3,
        order: 2,
      },
    ],
  },
];

export const seedQuranContentData = [
  {
    name: 'Surah Al-Fatiha',
    nameArabic: 'سورة الفاتحة',
    totalVerses: 7,
    pages: 1,
    images: [
      {
        order: 1,
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      },
    ],
  },
];

export const seedHabitTemplatesData = [
  {
    name: 'Fajr Prayer',
    category: HABIT_CATEGORIES.PRAYER,
    connectedPrayer: CONNECTED_PRAYERS.FAJR,
    allowConnectedPrayers: [ALLOW_CONNECTED_PRAYERS.FAJR],
    isPrayerLocked: true,
    habitType: HABIT_TYPES.OBLIGATORY_PRAYER,
    supportsLocation: HABIT_LOCATIONS.HOME,
    defaultFrequency: { type: FREQUENCY_TYPES.DAILY },
    allowedFrequencies: [FREQUENCIES.DAILY],
    level: HABIT_LEVELS.BEGINNER,
    isPreBuilt: true,
    isLocked: false,
    isGuestLocked: false,
    status: HABIT_STATUS.PUBLISHED,
    isActive: true,
    infoContent: 'Perform the obligatory Fajr prayer on time.',
  },
  {
    name: 'Read Quran Daily',
    category: HABIT_CATEGORIES.QURAN,
    connectedPrayer: null,
    allowConnectedPrayers: [],
    habitType: HABIT_TYPES.QURAN,
    defaultFrequency: { type: FREQUENCY_TYPES.DAILY },
    allowedFrequencies: [FREQUENCIES.DAILY, FREQUENCIES.WEEKLY],
    level: HABIT_LEVELS.BEGINNER,
    isPreBuilt: true,
    isLocked: false,
    isGuestLocked: true,
    status: HABIT_STATUS.PUBLISHED,
    isActive: true,
    infoContent: 'Read a portion of the Quran every day.',
    linkQuranContent: true,
  },
  {
    name: 'Morning Adhkar',
    category: HABIT_CATEGORIES.DHIKR,
    connectedPrayer: CONNECTED_PRAYERS.FAJR,
    allowConnectedPrayers: [ALLOW_CONNECTED_PRAYERS.FAJR],
    habitType: HABIT_TYPES.ADHKAR,
    defaultFrequency: { type: FREQUENCY_TYPES.DAILY },
    allowedFrequencies: [FREQUENCIES.DAILY],
    level: HABIT_LEVELS.BEGINNER,
    isPreBuilt: true,
    isLocked: false,
    isGuestLocked: false,
    status: HABIT_STATUS.PUBLISHED,
    isActive: true,
    linkAdhkarSet: true,
  },
];

export const seedContentData = [
  {
    type: CONTENT.ABOUT_US,
    title: 'About Us',
    content: 'Muslim Habit Builder helps Muslims build consistent daily worship habits.',
  },
  {
    type: CONTENT.PRIVACY_POLICY,
    title: 'Privacy Policy',
    content: 'We respect your privacy and protect your personal data.',
  },
  {
    type: CONTENT.TERMS_AND_CONDITION,
    title: 'Terms and Conditions',
    content: 'By using this app you agree to our terms of service.',
  },
  {
    type: CONTENT.REFUND_POLICY,
    title: 'Refund Policy',
    content: 'Refunds are processed within 7 business days where applicable.',
  },
];

export const seedFaqsData = [
  {
    question: 'How do I track my daily prayers?',
    answer: 'Activate pre-built prayer habits from the habit library and mark them complete each day.',
    isPublished: true,
  },
  {
    question: 'Can I create custom habits?',
    answer: 'Yes. Premium users can create and customize their own habits.',
    isPublished: true,
  },
];

export const seedAnnouncementsData = [
  {
    title: 'Welcome to Muslim Habit Builder',
    description: 'Start building consistent worship habits today. Explore pre-built templates in the habit library.',
    status: ANNOUNCEMENT_STATUS.ACTIVE,
    startedAt: new Date(),
    endedAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
];

export const seedDiscountsData = [
  {
    code: 'WELCOME10',
    discount: 10,
    discountString: '10% off',
    appliesTo: BILLING_PLAN.MONTHLY_PLAN,
    usageLimit: 100,
    status: DISCOUNT_STATUS.ACTIVE,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  },
];

export const seedSubscriptionsData = [
  {
    userKey: 'premium',
    plan: SUBSCRIPTION_PLAN.FULL_ACCESS,
    billingCycle: SUBSCRIPTION_MODE.THREE_MONTHS,
    price: 29.99,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    activatedAt: new Date(),
    expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  },
];

export const seedUserHabitsData = [
  {
    userKey: 'regular',
    templateName: 'Fajr Prayer',
    category: HABIT_CATEGORIES.PRAYER,
    connectedPrayer: CONNECTED_PRAYERS.FAJR,
    location: HABIT_LOCATIONS.HOME,
    frequency: { type: FREQUENCY_TYPES.DAILY },
    allowedFrequencies: [FREQUENCIES.DAILY],
    reminder: { enabled: true, time: '05:30 AM' },
    startDate: new Date(),
    showOnTodayScreen: true,
    isPreBuilt: true,
    isActive: true,
  },
];

export const seedHabitLogsData = [
  {
    userKey: 'regular',
    templateName: 'Fajr Prayer',
    date: new Date().toISOString().split('T')[0],
    status: LOG_STATUS.COMPLETED,
    completedAt: new Date(),
    locationLogged: HABIT_LOCATIONS.HOME,
  },
  {
    userKey: 'regular',
    templateName: 'Fajr Prayer',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: LOG_STATUS.SKIPPED,
    skippedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
];

export const seedBugsData = [
  {
    reporterKey: 'regular',
    featureKey: BUG_FEATURES.HABIT_COMPLETED,
    title: 'Habit completion not syncing',
    description: 'Completed habits sometimes do not appear on the progress tab until app restart.',
    status: BUG_STATUS.PENDING,
    upvoteCount: 1,
    bugImages: [],
  },
];

export const seedSessionsData = [
  {
    userKey: 'regular',
    refreshToken: 'seed-refresh-token-regular-user',
    sessionId: 'seed-session-regular-user',
    tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    lastLoginAt: new Date(),
  },
];

export const seedOtpTokensData = [
  {
    userKey: 'regular',
    type: 'email_verification' as const,
    otpHash: '123456',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  },
];
