import z from "zod"
import { CONNECTED_PRAYERS, HABIT_CATEGORIES } from "../../../interfaces"
import { HABIT_CATEGORY, HABIT_LEVEL } from "../../../shared/constants/habit.shared.types"
import { frequencyZodSchema } from "../dashboard/habit-template/system.habit.zod"
import { FREQUENCY_TYPES, HABIT_LOCATIONS, TARGET_TYPES, WEEK_DAYS } from "./user.habit.constant"




const createUserHabitZod = z.object({
  name: z.string({
    error: (issue) => {
      if (issue.input === undefined) return 'Name is required'
      if (typeof issue.input !== 'string') return 'Name must be a string'
      return 'Invalid name'
    },
  })
    .min(1, 'Name cannot be empty')
    .max(100, 'Name cannot exceed 100 characters'),

  category: z.enum(Object.values(HABIT_CATEGORY) as [string, ...string[]], {
    error: (issue) => {
      if (issue.input === undefined) return 'Category is required'
      return `Invalid category. Must be one of: ${Object.values(HABIT_CATEGORY).join(', ')}`
    },
  }),

  frequency: frequencyZodSchema,

  parentId: z.string({
    error: () => 'Parent ID must be a string',
  }).nullable().optional(),

  level: z.enum(Object.values(HABIT_LEVEL) as [string, ...string[]], {
    error: (issue) => {
      if (issue.input === undefined) return 'Level is required'
      return `Invalid level. Must be one of: ${Object.values(HABIT_LEVEL).join(', ')}`
    },
  }),

  isReminder: z.preprocess(
    (val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    },
    z.boolean({
      error: "isReminder must be a boolean",
    }).optional().default(false)
  ),

  order: z.number({
    error: (issue) => {
      if (typeof issue.input !== 'number') return 'Order must be a number'
      return 'Invalid order'
    },
  })
    .int('Order must be a whole number')
    .min(0, 'Order cannot be negative')
    .optional()
    .default(0),

})

/* --------------*/

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
const objectId = () =>
  z.string({
    error: () => 'Must be a valid ID',
  }).refine(val => /^[a-f\d]{24}$/i.test(val), 'Invalid ID format');

const nullableObjectId = () => objectId().nullable().optional();



// ─────────────────────────────────────────────────────────────
//  FREQUENCY
// ─────────────────────────────────────────────────────────────
const frequencySchema = z
  .object({
    type: z.enum(Object.values(FREQUENCY_TYPES) as [string, ...string[]], {
      error: (issue) => {
        if (issue.input === undefined) return 'Frequency type is required';
        return `Invalid frequency type. Must be one of: ${Object.values(FREQUENCY_TYPES).join(', ')}`;
      },
    }),
    selectedDays: z
      .array(
        z.enum(Object.values(WEEK_DAYS) as [string, ...string[]], {
          error: () => `Invalid day. Must be one of: ${Object.values(WEEK_DAYS).join(', ')}`,
        }),
      )
      .optional()
      .default([]),
    everyNDays: z
      .number({
        error: () => 'everyNDays must be a number',
      })
      .int('everyNDays must be a whole number')
      .min(2, 'everyNDays must be at least 2')
      .max(365, 'everyNDays cannot exceed 365')
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === FREQUENCY_TYPES.WEEKLY) {
      if (!val.selectedDays?.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['selectedDays'],
          message: 'Please select at least one day for weekly frequency',
        });
      }
    }
    if (val.type === FREQUENCY_TYPES.EVERY_N_DAYS) {
      if (!val.everyNDays) {
        ctx.addIssue({
          code: 'custom',
          path: ['everyNDays'],
          message: 'Please provide everyNDays value',
        });
      }
    }
  });

// ─────────────────────────────────────────────────────────────
//  REMINDER
// ─────────────────────────────────────────────────────────────
const reminderSchema = z
  .object({
    enabled: z.preprocess(
      (val) => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        return val;
      },
      z.boolean({
        error: () => 'Reminder enabled must be a boolean',
      }).default(false),
    ),
    time: z
      .string({
        error: () => 'Reminder time must be a string',
      })
      .regex(/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, 'Invalid time format. Use hh:mm AM/PM')
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.enabled && !val.time) {
      ctx.addIssue({
        code: 'custom',
        path: ['time'],
        message: 'Reminder time is required when reminder is enabled',
      });
    }
  });

// ─────────────────────────────────────────────────────────────
//  CONNECTED HABIT
// ─────────────────────────────────────────────────────────────
const connectedHabitSchema = z.object({
  userHabit: objectId(),
  order: z
    .number({
      error: () => 'Order must be a number',
    })
    .int('Order must be a whole number')
    .min(1, 'Order must be at least 1'),
});

// ─────────────────────────────────────────────────────────────
//  ADD CUSTOM HABIT
// ─────────────────────────────────────────────────────────────
export const addCustomHabitSchema = z.object({
  name: z
    .string({
      error: (issue) => {
        if (issue.input === undefined) return 'Name is required';
        if (typeof issue.input !== 'string') return 'Name must be a string';
        return 'Invalid name';
      },
    })
    .min(1, 'Name cannot be empty')
    .max(100, 'Name cannot exceed 100 characters')
    .transform(val => val.trim()),

  category: z.enum(Object.values(HABIT_CATEGORIES) as [string, ...string[]], {
    error: (issue) => {
      if (issue.input === undefined) return 'Category is required';
      return `Invalid category. Must be one of: ${Object.values(HABIT_CATEGORIES).join(', ')}`;
    },
  }),

  connectedPrayer: z
    .enum(
      Object.values(CONNECTED_PRAYERS).filter(Boolean) as [string, ...string[]],
      {
        error: () =>
          `Invalid connected prayer. Must be one of: ${Object.values(CONNECTED_PRAYERS).filter(Boolean).join(', ')}`,
      },
    )
    .nullable()
    .optional(),

  location: z
    .enum(
      Object.values(HABIT_LOCATIONS).filter(Boolean) as [string, ...string[]],
      {
        error: () => `Invalid location. Must be one of: Home, Masjid`,
      },
    )
    .nullable()
    .optional()
    .default('Home'),

  frequency: frequencySchema,

  reminder: reminderSchema.optional().default({ enabled: false, time: '12:00 AM' }),

  targetType: z.enum(Object.values(TARGET_TYPES) as [string, ...string[]], {
    error: () => 'Invalid target type. Must be one of: Page,Juzz, Time',
  }).optional(),

  targetDescription: z
    .string({
      error: () => 'Target description must be a string',
    })
    .max(50, 'Target description cannot exceed 50 characters')
    .optional()
    .nullable(),

  startDate: z
    .string({
      error: () => 'Start date must be a string',
    })
    .optional()
    .transform(val => (val ? new Date(val) : new Date())),

  showOnTodayScreen: z
    .preprocess(
      (val) => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        return val;
      },
      z.boolean({
        error: () => 'showOnTodayScreen must be a boolean',
      }).optional()
        .default(false),
    ),
  customDetails: z
    .string({
      error: () => 'Custom details must be a string',
    })
    .min(5, 'Custom details must be at least 5 characters')
    .max(50, 'Custom details cannot exceed 50 characters')
    .optional()

});

// ─────────────────────────────────────────────────────────────
//  EDIT HABIT
// ─────────────────────────────────────────────────────────────
export const editHabitSchema = z
  .object({
    name: z.string({
      error: (issue) => {
        if (issue.input === undefined) return 'Name is required';
        if (typeof issue.input !== 'string') return 'Name must be a string';
        return 'Invalid name';
      },
    }).min(1, 'Name cannot be empty').max(50, 'Name cannot exceed 50 characters').optional(),

    connectedPrayer: z
      .enum(
        Object.values(CONNECTED_PRAYERS).filter(Boolean) as [string, ...string[]],
        {
          error: () =>
            `Invalid connected prayer. Must be one of: ${Object.values(CONNECTED_PRAYERS).filter(Boolean).join(', ')}`,
        },
      )
      .optional(),

    frequency: frequencySchema.optional(),

    reminder: reminderSchema.optional(),

    startDate: z
      .string({
        error: () => 'Start date must be a string',
      })
      .optional()
      .transform(val => (val ? new Date(val) : undefined)),

    location: z
      .enum(
        Object.values(HABIT_LOCATIONS).filter(Boolean) as [string, ...string[]],
        {
          error: () => 'Invalid location. Must be one of: Home, Masjid',
        },
      )
      .nullable()
      .optional(),

    targetType: z.enum(Object.values(TARGET_TYPES) as [string, ...string[]], {
      error: () => 'Invalid target type. Must be one of: Page,Juzz, Time',
    }).optional(),

    targetDescription: z
      .string({
        error: () => 'Target description must be a string',
      })
      .max(200, 'Target description cannot exceed 200 characters')
      .optional()
      .nullable(),

    customDetails: z
      .string({
        error: () => 'Custom details must be a string',
      })
      .min(5, 'Custom details must be at least 5 characters')
      .max(50, 'Custom details cannot exceed 50 characters')
      .optional()
      .nullable(),


    connectedHabits: z
      .array(z.string(), {
        error: () => 'connectedHabits must be an array of string IDs',
      })
      .optional()
      .superRefine((val, ctx) => {
        if (!val?.length) return;

        // Ensure the input does not contain duplicate IDs
        if (new Set(val).size !== val.length) {
          ctx.addIssue({
            code: 'custom',
            message: 'Input habits must not have duplicate IDs',
          });
        }
      }),
  })
  .superRefine((val, ctx) => {
    // At least one field must be provided
    const hasAnyField = Object.values(val).some(v => v !== undefined);
    if (!hasAnyField) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one field is required to update',
      });
    }
  });

export type AddCustomHabitPayload = z.infer<typeof addCustomHabitSchema>;
export type EditHabitPayload = z.infer<typeof editHabitSchema>;




const habitParamsZod = z.object({
  habitId: z.string({
    error: (issue) => {
      if (issue.input === undefined) return 'Habit ID is required'
      if (typeof issue.input !== 'string') return 'Habit ID must be a string'
      return 'Invalid habit ID'
    },
  }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid habit ID format'),
})

export type TCreateUserHabit = z.infer<typeof createUserHabitZod>
export type THabitParams = z.infer<typeof habitParamsZod>



const userHabitValidationZodSchema = {
  createUserHabitZod,
  habitParamsZod,
  editHabitSchema,
  addCustomHabitSchema

};


export default userHabitValidationZodSchema;