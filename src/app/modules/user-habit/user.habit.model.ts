import { Schema, model } from 'mongoose';

import { CONNECTED_PRAYERS, HABIT_CATEGORIES } from '../../../interfaces';
import { WEEK_DAYS } from '../../../shared/constants/habit.shared.types';
import { FREQUENCIES } from '../dashboard/habit-template/system.habit.constant';
import { FREQUENCY_TYPES, HABIT_LOCATIONS, TARGET_TYPES } from './user.habit.constant';
import { IFrequency, IReminder, IUserHabit } from './user.habit.interface';

const frequencySchema = new Schema<IFrequency>({
  type: {
    type: String,
    enum: Object.values(FREQUENCY_TYPES),
    required: true,
  },
  selectedDays: {
    type: [String],
    enum: Object.values(WEEK_DAYS),
    default: undefined,
  },
  everyNDays: {
    type: Number,
    default: undefined,
  },
});

const reminderSchema = new Schema<IReminder>({
  enabled: {
    type: Boolean,
    default: false,
  },
  time: {
    type: String,
    default: "12:00 AM",
  },
});


// user habit
const userHabitSchema = new Schema<IUserHabit>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    template: {
      type: Schema.Types.ObjectId,
      ref: 'HabitTemplate',
      default: null,
    },
    name: {
      type: String,
      required: false,
      trim: true,
      default: null
    },
    category: {
      type: String,
      enum: Object.values(HABIT_CATEGORIES),
      required: true,
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'UserHabit',
      default: null,
    },

    connectedPrayer: {
      type: String,
      enum: Object.values(CONNECTED_PRAYERS),
      default: null,
    },
    location: {
      type: String,
      enum: Object.values(HABIT_LOCATIONS),
      default: null,
    },
    frequency: {
      type: frequencySchema,
      required: true,
      _id: false
    },
    allowedFrequencies: {
      type: [String],
      enum: Object.values(FREQUENCIES),
      required: false,
      _id: false
    },
    reminder: {
      type: reminderSchema,
      required: true,
      _id: false
    },
    startDate: {
      type: Date,
      required: true,
    },
    showOnTodayScreen: {
      type: Boolean,
      default: true,
    },

    targetType: {
      type: String,
      enum: Object.values(TARGET_TYPES),
      default: null
    },
    targetDescription: {
      type: String,
      default: null,
    },

    customDetails: {
      type: String,
      default: null
    },
    connectedHabits: {
      type: [{
        userHabit: { type: Schema.Types.ObjectId, ref: 'UserHabit', required: false },
        order: { type: Number, required: true },
      }],
      default: [],
      _id: false
    },

    isPreBuilt: {
      type: Boolean,
      default: true
    },

    isActive: {
      type: Boolean,
      default: false,
    },
    progressRestartedAt: {
      type: Date,
      default: null,
    },

    prayerCustomizedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false
  }
);


userHabitSchema.index({ user: 1 });
userHabitSchema.index({ parent: 1 });
userHabitSchema.index({ template: 1 });
userHabitSchema.index({ connectedPrayer: 1 });
userHabitSchema.index({ user: 1,category: 1 });

export const UserHabit = model<IUserHabit>('UserHabit', userHabitSchema);


/*

const userHabitSchema = new Schema<IUserHabit>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    template: {
      type: Schema.Types.ObjectId,
      ref: 'HabitTemplate',
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: Object.values(HABIT_CATEGORIES),
      required: true,
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'UserHabit',
      default: null,
    },

    level: {
      type: String,
      enum: Object.values(HABIT_LEVELS),
    },

    group: { type: Schema.Types.ObjectId, ref: 'HabitTemplate', default: null },

    connectedPrayer: {
      type: String,
      enum: Object.values(CONNECTED_PRAYERS),
      default: null,
    },

    allowConnectedPrayers: {
      type: [String],
      enum: Object.values(CONNECTED_PRAYERS),
      default: []
    },

    isPrayerLocked: {
      type: Boolean,
    },
    location: {
      type: String,
      enum: Object.values(HABIT_LOCATIONS),
      default: null,
    },
    frequency: {
      type: frequencySchema,
      required: true,
    },
    allowedFrequencies: {
      type: [String],
      enum: Object.values(FREQUENCIES),
      required: false
    },
    reminder: {
      type: reminderSchema,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    showOnTodayScreen: {
      type: Boolean,
      default: true,
    },
    habitType: {
      type: String,
      enum: Object.values(HABIT_TYPES),
      default: null
    },

    targetType: {
      type: String,
      enum: Object.values(TARGET_TYPES),
      default: null
    },
    targetDescription: {
      type: String,
      default: null,
    },

    adhkarSet: {
      type: Schema.Types.ObjectId,
      ref: 'AdhkarSet',
      default: null
    },
    customDetails: {
      type: String,
      default: null
    },
    connectedHabits: {
      type: [{
        userHabit: { type: Schema.Types.ObjectId, ref: 'UserHabit', required: false },
        order: { type: Number, required: true },
      }],
      default: [],
    },

    quranContent: {
      type: Schema.Types.ObjectId,
      ref: 'QuranContent',
      default: null
    },

    isPreBuilt: {
      type: Boolean,
      default: true
    },

    infoContent: {
      type: String,
      default: null
    },
    isLocked: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    progressRestartedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false
  }
);


*/