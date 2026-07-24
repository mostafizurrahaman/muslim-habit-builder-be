import { z } from 'zod';
import { CONNECTED_PRAYERS, HABIT_CATEGORIES, HABIT_LEVELS } from '../../../../interfaces';
import {
  FREQUENCY_TYPE,
  WEEK_DAYS,
} from '../../../../shared/constants/habit.shared.types';
import { FREQUENCY_TYPES, HABIT_LOCATIONS } from '../../user-habit/user.habit.constant';
import { HABIT_TYPES } from './system.habit.constant';

export const frequencyZodSchema = z.object({
  type: z.enum(Object.values(FREQUENCY_TYPES) as [string, ...string[]], {
    error: (issue) => {
      if (issue.input === undefined) return 'Default frequency type is required'
      return `Invalid default frequency type. Must be one of: ${Object.values(FREQUENCY_TYPES).join(', ')}`
    },
  }),
  selectedDays: z.array(z.enum(Object.values(WEEK_DAYS) as [string, ...string[]])).default([]),
  everyNDays: z.number().optional(),
}).default({
  type: FREQUENCY_TYPES.DAILY,
  selectedDays: [],
  everyNDays: undefined,
})
  .superRefine((data, ctx) => {

    if (data.type === FREQUENCY_TYPE.DAILY) {
      if (data.selectedDays && data.selectedDays.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: "Selected days must be empty when frequency is daily",
          path: ["selectedDays"],
        });
      }
    }


    if (data.type === FREQUENCY_TYPE.WEEKLY) {
      if (!data.selectedDays || data.selectedDays.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Please select at least one day for weekly frequency",
          path: ["selectedDays"],
        });
      }
    }


    if (data.type === FREQUENCY_TYPE.INTERVAL) {
      if (!data.everyNDays || data.everyNDays <= 0) {
        ctx.addIssue({
          code: "custom",
          message: "Please specify the interval (every N days)",
          path: ["everyNDays"],
        });
      }

      if (data.selectedDays && data.selectedDays.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: "Selected days should be empty for 'every n days' type",
          path: ["selectedDays"],
        });
      }
    }
  });

// create habit template zod
const createHabitTemplateZod = z
  .object({
    name: z
      .string({
        error: (issue) => {
          if (issue.input === undefined) return 'Name is required'
          if (typeof issue.input !== 'string') return 'Name must be a string'
          return 'Invalid name format'
        },
      })
      .min(1, 'Name cannot be empty')
      .max(100, 'Name cannot exceed 100 characters'),

    category: z.enum(Object.values(HABIT_CATEGORIES) as [string, ...string[]], {
      error: (issue) => {
        if (issue.input === undefined) return 'Category is required'
        return `Invalid category. Must be one of: ${Object.values(HABIT_CATEGORIES).join(', ')}`
      },
    }),

    connectedPrayer: z
      .enum(Object.values(CONNECTED_PRAYERS) as [string, ...string[]], {
        error: (issue) => {
          if (issue.input === undefined) return 'Connected prayer is required'
          return `Invalid connected prayer. Must be one of: Fajr, Dhuhr, Asr, Maghrib, Isha`
        },
      })
      .optional(),

    allowConnectedPrayers: z
      .array(z.enum(Object.values(CONNECTED_PRAYERS) as [string, ...string[]]))
      .optional()
      .default([]),

    isPrayerLocked: z.boolean().optional().default(false),

    supportsLocation: z
      .enum(Object.values(HABIT_LOCATIONS) as [string, ...string[]], {
        error: (issue) => {
          if (issue.input === undefined) return 'Support location is required'
          return `Invalid location. Must be one of: ${Object.values(HABIT_LOCATIONS).join(', ')}`
        },
      })
      .nullable(),

    habitType: z.enum(Object.values(HABIT_TYPES) as [string, ...string[]], {
      error: (issue) => {
        if (issue.input === undefined) return 'Habit type is required'
        return `Invalid habit type. Must be one of: ${Object.values(HABIT_TYPES).join(', ')}`
      },
    }),

    parent: z
      .string({ error: 'Parent ID must be a string' })
      .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid Id format' })
      .nullable()
      .optional()
      .default(null),

    isParent: z.boolean().optional().default(false),

    group: z
      .string({ error: 'Group ID must be a string' })
      .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid Id format' })
      .nullable()
      .optional(),

    isGroup: z.boolean().optional().default(false),

    defaultFrequency: frequencyZodSchema,

    allowedFrequencies: z
      .array(
        z.enum(Object.values(FREQUENCY_TYPES) as [string, ...string[]], {
          error: (issue) => {
            if (!Array.isArray(issue.input)) return 'Allowed frequencies must be an array'
            return `Invalid frequency in allowed frequencies. Must be one of: ${Object.values(FREQUENCY_TYPES).join(', ')}`
          },
        })
      )
      .min(1, 'At least one allowed frequency must be selected'),

    level: z.enum(Object.values(HABIT_LEVELS) as [string, ...string[]], {
      error: (issue) => {
        if (issue.input === undefined) return 'Level is required'
        return `Invalid level. Must be one of: ${Object.values(HABIT_LEVELS).join(', ')}`
      },
    }),

    isConnectedObligatory: z.boolean().optional().default(false),

    isLocked: z.boolean().optional().default(false),

    isGuestLocked: z.boolean().optional().default(false),

    infoContent: z
      .string()
      .min(20, 'Info content must be at least 20 characters long')
      .nullable()
      .optional(),

    adhkarSet: z
      .string({ error: 'Adhkar Set ID must be a string' })
      .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid Id format' })
      .nullable()
      .optional(),

    quranContent: z
      .string({ error: 'Quran Content ID must be a string' })
      .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid Id format' })
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.category === HABIT_CATEGORIES.PRAYER && !data.isGroup && !data.connectedPrayer) {
      ctx.addIssue({
        code: 'custom',
        path: ['connectedPrayer'],
        message: 'Connected prayer is required when category is prayer',
      })
    }
  })

/*

export interface IInfoContent {
    title?:     string  
    text:       string  
    reference?: string   
}
*/


export const getSystemHabitsZod = z.object({
  query: z.object({
    level: z.enum(Object.values(HABIT_LEVELS) as [string, ...string[]], {
      error: () => `Invalid level. Must be one of: ${Object.values(HABIT_LEVELS).join(', ')}`,
    }).optional(),
    category: z.enum(Object.values(HABIT_CATEGORIES) as [string, ...string[]], {
      error: () => `Invalid category. Must be one of: ${Object.values(HABIT_CATEGORIES).join(', ')}`,
    }).optional(),
  })
})

export type TCreateHabitTemplate = z.infer<typeof createHabitTemplateZod>
export type TGetSystemHabitsQuery = z.infer<typeof getSystemHabitsZod>['query']


const systemHabitValidationZodSchema = {
  createHabitTemplateZod,
  getSystemHabitsZod
};


export default systemHabitValidationZodSchema;