import { Schema, model } from 'mongoose';
import { ALLOW_CONNECTED_PRAYERS, CONNECTED_PRAYERS, HABIT_CATEGORIES, HABIT_LEVELS } from '../../../../interfaces';
import { FREQUENCY_TYPES, HABIT_LOCATIONS, WEEK_DAYS } from '../../user-habit/user.habit.constant';
import { FREQUENCIES, HABIT_TYPES } from './system.habit.constant';
import { IDefaultFrequency, IHabitTemplate } from './system.habit.interface';

const frequencySchema = new Schema<IDefaultFrequency>({
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


// Main Schema
const habitTemplateSchema = new Schema<IHabitTemplate>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    category: {
      type: String,
      enum: Object.values(HABIT_CATEGORIES),
      required: true
    },

    connectedPrayer: {
      type: String,
      enum: Object.values(CONNECTED_PRAYERS),
      default: null
    },

    allowConnectedPrayers: {
      type: [String],
      enum: Object.values(ALLOW_CONNECTED_PRAYERS),
      default: []
    },

    isPrayerLocked: {
      type: Boolean,
      default: true
    },

    habitType: {
      type: String,
      enum: Object.values(HABIT_TYPES),
      required: true
    },

    supportsLocation: {
      type: String,
      enum: Object.values(HABIT_LOCATIONS),
      default: null,
    },

    parent: {
      type: Schema.Types.ObjectId,
      ref: 'HabitTemplate',
      default: null
    },
    group: {
      type: Schema.Types.ObjectId,
      ref: 'HabitTemplate',
      default: null
    },

    defaultFrequency: {
      type: frequencySchema,
      required: true,
    },

    allowedFrequencies: {
      type: [String],
      enum: Object.values(FREQUENCIES),
      required: true
    },

    level: {
      type: String,
      enum: Object.values(HABIT_LEVELS),
      required: true
    },
    isPreBuilt: {
      type: Boolean,
      default: true
    },
    isLocked: {
      type: Boolean,
      default: false
    },
    
    isConnectedObligatory: {
      type: Boolean,
      default: false
    },

    isParent: {
      type: Boolean,
      default: false
    },
    
    isGroup: {
      type: Boolean,
      default: false
    },

    isGuestLocked: {
      type: Boolean,
      default: true
    },

    adhkarSet: {
      type: Schema.Types.ObjectId,
      ref: 'AdhkarSet',
      default: null
    },

    quranContent: {
      type: Schema.Types.ObjectId,
      ref: 'QuranContent',
      default: null
    },

    infoContent: {
      type: String,
      default: null
    },

     pdfContent: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },

  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Indexing (Optional, but recommended for performance)
habitTemplateSchema.index({ category: 1, habitType: 1 });
habitTemplateSchema.index({ level: 1, levelOrder: 1 });

export const HabitTemplate = model<IHabitTemplate>('HabitTemplate', habitTemplateSchema);