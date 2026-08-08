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

    isPrayerLocked: z.coerce.boolean().optional().default(false),

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

    isParent: z.coerce.boolean().optional().default(false),

    group: z
      .string({ error: 'Group ID must be a string' })
      .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid Id format' })
      .nullable()
      .optional(),

    isGroup: z.coerce.boolean().optional().default(false),

    isNew: z.coerce.boolean().optional().default(false),
    
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

    isConnectedObligatory: z.coerce.boolean().optional().default(false),

    isLocked: z.coerce.boolean().optional().default(false),

    isGuestLocked: z.coerce.boolean().optional().default(false),

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


  // update habit template zod

const updateHabitTemplateZod = z
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
      .max(100, 'Name cannot exceed 100 characters').optional(),

    category: z.enum(Object.values(HABIT_CATEGORIES) as [string, ...string[]], {
      error: (issue) => {
        if (issue.input === undefined) return 'Category is required'
        return `Invalid category. Must be one of: ${Object.values(HABIT_CATEGORIES).join(', ')}`
      },
    }).optional(),

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
      .optional(),

    isPrayerLocked: z.coerce.boolean().optional().default(false),

    supportsLocation: z
      .enum(Object.values(HABIT_LOCATIONS) as [string, ...string[]], {
        error: (issue) => {
          if (issue.input === undefined) return 'Support location is required'
          return `Invalid location. Must be one of: ${Object.values(HABIT_LOCATIONS).join(', ')}`
        },
      }).optional(),

    habitType: z.enum(Object.values(HABIT_TYPES) as [string, ...string[]], {
      error: (issue) => {
        if (issue.input === undefined) return 'Habit type is required'
        return `Invalid habit type. Must be one of: ${Object.values(HABIT_TYPES).join(', ')}`
      },
    }).optional(),

    parent: z
      .string({ error: 'Parent ID must be a string' })
      .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid Id format' })
      .optional(),
  

    isParent: z.coerce.boolean().optional(),

    group: z
      .string({ error: 'Group ID must be a string' })
      .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid Id format' })
      .optional(),

    isGroup: z.coerce.boolean().optional(),

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
      .min(1, 'At least one allowed frequency must be selected').optional(),

    level: z.enum(Object.values(HABIT_LEVELS) as [string, ...string[]], {
      error: (issue) => {
        if (issue.input === undefined) return 'Level is required'
        return `Invalid level. Must be one of: ${Object.values(HABIT_LEVELS).join(', ')}`
      },
    }).optional(),

    isConnectedObligatory: z.coerce.boolean().optional(),

    isLocked: z.coerce.boolean().optional(),

    isNew: z.coerce.boolean().optional(),

    isGuestLocked: z.coerce.boolean().optional(),

    infoContent: z
      .string()
      .min(20, 'Info content must be at least 20 characters long')
      .optional(),

    adhkarSet: z
      .string({ error: 'Adhkar Set ID must be a string' })
      .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid Id format' })
      .optional(),

    quranContent: z
      .string({ error: 'Quran Content ID must be a string' })
      .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid Id format' })
      .optional(),
  })
  .superRefine((data, ctx) => {
       if(Object.keys(data).length === 0){
        ctx.addIssue({
          code: 'custom',
          message: 'At least one field must be provided for update',
        })
       }
  })


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
export type TUpdateHabitTemplate = z.infer<typeof updateHabitTemplateZod>

const systemHabitValidationZodSchema = {
  createHabitTemplateZod,
  getSystemHabitsZod,
  updateHabitTemplateZod
};


export default systemHabitValidationZodSchema;



/*
const GetAllHabitsWithStatus = async (user: IUser, category?: string) => {
    const userId = user._id as Types.ObjectId;

    const templateFilter: any = { isActive: true };
    if (category && category.toLowerCase() !== 'all') {
        templateFilter.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }


    const templatesWithConnections = await HabitTemplate.find(
        { isActive: true, 'connectedHabits.0': { $exists: true } },
        { connectedHabits: 1 },
    ).lean();

    console.log({ templatesWithConnections })
    const connectedTemplateIds = new Set(
        templatesWithConnections
            .flatMap((t: any) =>
                (t.connectedHabits ?? []).map((ch: any) =>
                    ch.templateHabit?.toString()  // 
                )
            )
            .filter(Boolean),
    );
    console.log({ connectedTemplateIds })
    const topLevelTemplates = await HabitTemplate.find({
        ...templateFilter,
        $or: [{ group: null }, { group: { $exists: false } }],
        // Exclude templates that are referenced as connected habits
        ...(connectedTemplateIds.size > 0 && {
            _id: { $nin: Array.from(connectedTemplateIds) },
        }),
    }).lean();

    console.log({ topLevelTemplates })
    const topLevelIds = topLevelTemplates.map(t => t._id);

    const allChildren = await HabitTemplate.find({
        group: { $in: topLevelIds },
        isActive: true,
    }).select('_id group').lean();

    const groupChildrenMap = new Map<string, Types.ObjectId[]>();
    for (const child of allChildren) {
        const groupId = child.group!.toString();
        if (!groupChildrenMap.has(groupId)) groupChildrenMap.set(groupId, []);
        groupChildrenMap.get(groupId)!.push(child._id);
    }

    const userHabits = await UserHabit.find({ user: userId })
        .select('template isActive _id name category habitType')
        .lean();

    const userHabitMap = new Map(
        userHabits.map(h => [h.template?.toString(), h]),
    );

    const buckets: Record<string, any[]> = {
        beginner: [],
        intermediate: [],
        advanced: [],
        custom: [],
    };

    let activeCount = 0;
    let totalCount = 0;

    for (const t of topLevelTemplates) {
        const templateId = t._id.toString();
        const children = groupChildrenMap.get(templateId) ?? [];
        const isGroup = children.length > 0;

        let isUserActive = false;

        if (isGroup) {
            isUserActive = children.some(childId => {
                const userHabit = userHabitMap.get(childId.toString());
                return userHabit?.isActive ?? false;
            });
        } else {
            const userHabit = userHabitMap.get(templateId);
            isUserActive = userHabit?.isActive ?? false;
        }

        if (isUserActive) activeCount++;
        totalCount++;

        const level = (t.level ?? 'beginner').toLowerCase();
        buckets[level in buckets ? level : 'custom'].push({
            _id: t._id,
            name: t.name,
            isUserActive,
            category: t.category,
            infoContent: t.infoContent,
            isGuestLocked: user.role === USER_ROLE.GUEST ? t.isGuestLocked : undefined
        });
    }

    // ── Custom habits — template: null ────────────────────────

    const customHabitFilter: any = { user: userId, template: null };
    if (category && category.toLowerCase() !== 'all') {
        customHabitFilter.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    const customHabits = await UserHabit.find(customHabitFilter)
        .select('_id name category isActive customDetails infoContent')
        .lean();

    for (const h of customHabits) {
        activeCount++;
        totalCount++;

        buckets.custom.push({
            _id: h._id,
            name: h.name,
            isUserActive: h.isActive,
            category: h.category,
            customDetails: h.customDetails ?? null,
            infoContent: h.infoContent ?? null,
        });
    }

    return {
        activeCount,
        totalCount,
        beginner: buckets.beginner,
        intermediate: buckets.intermediate,
        advanced: buckets.advanced,
        custom: buckets.custom,
    };
};

*/