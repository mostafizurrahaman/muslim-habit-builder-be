import moment from 'moment-timezone';
import mongoose, { Types } from 'mongoose';
import { AllowedConnectedPrayer, ConnectedPrayer, HabitCategory } from '../../../interfaces';
import { BadRequestError, NotFoundError } from '../../errors/request/apiError';
import { AdhkarSet } from '../dashboard/adhkar-set/adhkar.set.model';
import { HABIT_TYPES, OBLIGATORY_PRAYER } from '../dashboard/habit-template/system.habit.constant';
import { IHabitTemplate } from '../dashboard/habit-template/system.habit.interface';
import { HabitTemplate } from '../dashboard/habit-template/system.habit.model';
import { QuranContent } from '../dashboard/quran-content/quran.content.model';
import { LOG_STATUS } from '../habit-logger/habit.logger.constant';
import { HabitLog } from '../habit-logger/habit.logger.model';
import { IUser } from '../user/user.interface';
import { FREQUENCY_TYPES, TargetType, WeekDay } from './user.habit.constant';
import { activateConnectedObligatoryHabit, activateCustomHabit, activateGroupHabit, activateSingleHabit, deactivateConnectedObligatoryHabit, deactivateGroupHabit, deactivateSingleHabit, disconnectFromParents } from './user.habit.helper';
import { IFrequency, IUserHabit } from './user.habit.interface';
import { UserHabit } from './user.habit.model';
import { buildDateBasedOnTimeZone } from './user.habit.utils';
import { AddCustomHabitPayload, EditHabitPayload } from './user.habit.zod';


// ─────────────────────────────────────────────────────────────
//  HELPER
// ─────────────────────────────────────────────────────────────

const toggleHabit = async (user: IUser, habitId: string, isActive: boolean) => {
    const userId = user._id as Types.ObjectId;
    const date = buildDateBasedOnTimeZone(user.timezone as string);

    // ── DEACTIVATE ──
    if (!isActive) {
        const childTemplates = await HabitTemplate.find({ group: habitId, isActive: true }).lean();

        if (childTemplates.length > 0) {
            await deactivateGroupHabit(userId, childTemplates.map(c => c._id), date);
            return null;
        }

        const template = await HabitTemplate.findById(habitId).lean();

        if (template?.isConnectedObligatory) {
            await deactivateConnectedObligatoryHabit(userId, habitId, date);
            return null;
        }

        const userHabitExists = await UserHabit.exists({ template: habitId, user: userId, isActive: true });

        if (userHabitExists) {
            await deactivateSingleHabit(userId, habitId, date);
            return null;
        }

        // Neither a template-linked habit nor found above — try custom habit
        const customHabitExists = await UserHabit.exists({ _id: habitId, user: userId, template: null });
        if (customHabitExists) {
            await deactivateSingleHabit(userId, habitId, date);
        } else {
            throw new BadRequestError('custom habit not found');
        }
        return null;
    }

    // ── ACTIVATE ──
    const template = await HabitTemplate.findById(habitId).lean();

    if (!template) {
        return activateCustomHabit(userId, habitId, date);
    }

    if (!template.isActive) {
        throw new BadRequestError('This habit is no longer available');
    }

    const childTemplates = await HabitTemplate.find({ group: habitId, isActive: true }).lean();

    if (childTemplates.length > 0) {
        return activateGroupHabit(userId, childTemplates, date);
    }

    if (template.isConnectedObligatory) {
        return activateConnectedObligatoryHabit(userId, template, habitId, date);
    }

    return activateSingleHabit(userId, template, habitId, date);
};



const STATUS_ORDER: Record<string, number> = {
    Pending: 0,
    Completed: 1,
    Skipped: 2,
};

const toIdString = (value: unknown): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Types.ObjectId) return value.toString();
    if (typeof value === 'object' && value !== null && '_id' in value) {
        return toIdString((value as { _id: unknown })._id);
    }
    if (typeof (value as { toString?: () => string }).toString === 'function') {
        const asString = (value as { toString: () => string }).toString();
        return asString === '[object Object]' ? null : asString;
    }
    return null;
};

/** Nested children (e.g. Adhkar after prayer) must appear once per parent. */
const dedupeConnectedChildren = <T extends { userHabit?: unknown }>(children: T[]): T[] => {
    const seenIds = new Set<string>();
    const seenTemplates = new Set<string>();
    const unique: T[] = [];

    for (const child of children) {
        const nested = child.userHabit as { _id?: unknown; template?: unknown } | string | null | undefined;
        const childId = toIdString(nested);
        if (!childId || seenIds.has(childId)) continue;

        const templateId = nested && typeof nested === 'object'
            ? toIdString(nested.template)
            : null;
        if (templateId && seenTemplates.has(templateId)) continue;

        seenIds.add(childId);
        if (templateId) seenTemplates.add(templateId);
        unique.push(child);
    }

    return unique;
};

// get today habits
// const getTodayHabits = async (user: IUser, category?: string) => {
//     const userId = user._id as Types.ObjectId;
//     const dateStr = buildDateBasedOnTimeZone(user.timezone as string);

//     const todayDayName = moment(dateStr)
//         .format('ddd')
//         .toLowerCase() as WeekDay;

//     // ── Collect connected habit IDs — they should not show at the top level ──
//     const allActiveHabits = await UserHabit.find({
//         user: userId,
//         isActive: true,
//     }).select('_id connectedHabits').lean();

//     const connectedHabitIds = new Set(
//         allActiveHabits
//             .flatMap(h => (h.connectedHabits ?? []).map((c: any) => c.userHabit?.toString()))
//             .filter((id): id is string => Boolean(id)),
//     );

//     const filter: any = {
//         user: userId,
//         isActive: true,
//         _id: { $nin: [...connectedHabitIds] },
//     };

//     if (category && category.toLowerCase() !== 'all') {
//         filter.category = { $regex: new RegExp(`^${category}$`, 'i') };
//     }

//     const habits = await UserHabit.find(filter)
//         .select('_id name category connectedHabits habitType infoContent adhkarSet quranContent customDetails frequency')
//         .populate({
//             path: 'connectedHabits.userHabit',
//             select: '_id name category adhkarSet quranContent infoContent pdfContent',
//         })
//         .sort({ displayOrder: 1 })
//         .lean();

//     // ── Frequency check ───────────────────────────────────────

//     const shouldShowToday = (frequency: IFrequency, startDate: Date): boolean => {
//         switch (frequency.type) {
//             case FREQUENCY_TYPES.DAILY:
//                 return true;

//             case FREQUENCY_TYPES.WEEKLY: {
//                 if (!frequency.selectedDays?.length) return false;
//                 return frequency.selectedDays.includes(todayDayName);
//             }

//             case FREQUENCY_TYPES.EVERY_N_DAYS: {
//                 if (!frequency.everyNDays) return false;
//                 const start = moment(startDate).startOf('day');
//                 const today = moment(dateStr).startOf('day');
//                 const diffDays = today.diff(start, 'days');
//                 return diffDays >= 0 && diffDays % frequency.everyNDays === 0;
//             }

//             default:
//                 return true;
//         }
//     };

//     const todayHabits = habits.filter(h => shouldShowToday(h.frequency, h.startDate));

//     // ── Log IDs collect ───────────────────────────────────────

//     const allUserHabitIds = todayHabits.map(h => h._id);

//     const connectedIds = todayHabits.flatMap(h =>
//         (h.connectedHabits ?? [])
//             .filter((c: any) => {
//                 const child = c.userHabit;
//                 return child?.frequency ? shouldShowToday(child.frequency, child.startDate) : true;
//             })
//             .map((c: any) => c.userHabit?._id ?? c.userHabit),
//     );

//     const allIds = [...allUserHabitIds, ...connectedIds].filter(id => Boolean(id));

//     // ── Logs fetch ────────────────────────────────────────────

//     const existingLogs = await HabitLog.find({
//         userHabit: { $in: allIds },
//         date: dateStr,
//     }).select('userHabit status').lean();

//     const logMap = new Map<string, string>(
//         existingLogs.map((l: any) => [l.userHabit?.toString(), l.status]),
//     );

//     // Missing logs seed
//     const missingLogIds = allIds.filter(id => !logMap.has(id.toString()));
//     if (missingLogIds.length) {
//         await HabitLog.insertMany(
//             missingLogIds.map(id => ({
//                 user: userId,
//                 userHabit: id,
//                 date: dateStr,
//                 status: 'Pending',
//             })),
//         );
//         missingLogIds.forEach(id => logMap.set(id.toString(), 'Pending'));
//     }

//     // ── Response build ────────────────────────────────────────

//     const result = todayHabits.map(h => {
//         const connectedHabits = (h.connectedHabits ?? [])
//             .filter((c: any) => {
//                 const child = c.userHabit;
//                 return child?.frequency ? shouldShowToday(child.frequency, child.startDate) : true;
//             })
//             .filter((c: any) => Boolean(c.userHabit))
//             .sort((a: any, b: any) => a.order - b.order)
//             .map((c: any) => {
//                 const child = c.userHabit;
//                 const childId = child?._id?.toString() ?? c.userHabit?.toString();

//                 return {
//                     _id: child?._id ?? c.userHabit,
//                     name: child?.name ?? null,
//                     category: child?.category ?? null,
//                     habitType: child?.habitType ?? null,
//                     infoContent: child?.infoContent ?? null,
//                     customDetails: child?.customDetails ?? null,
//                     adhkarSet: child?.adhkarSet ?? null,
//                     quranContent: child?.quranContent ?? null,
//                     frequency: child?.frequency ?? null,
//                     startDate: child?.startDate ?? null,
//                     order: c.order,
//                     status: logMap.get(childId) ?? 'Pending',
//                 };
//             });

//         const databaseParentStatus = logMap.get(h._id.toString()) ?? 'Pending';

//         // ── Display status determine ───────────────────────────
//         let finalDisplayStatus: string;

//         if (connectedHabits.length > 0) {
//             if (databaseParentStatus === 'Skipped') {
//                 // If the parent is skipped, mark it as Skipped so it sorts lower
//                 finalDisplayStatus = 'Skipped';
//             } else if (
//                 databaseParentStatus === 'Completed' &&
//                 connectedHabits.every(ch => ch.status === 'Completed')
//             ) {
//                 // Parent and all children completed -> Completed
//                 finalDisplayStatus = 'Completed';
//             } else {
//                 // Any pending or incomplete item -> Pending
//                 finalDisplayStatus = 'Pending';
//             }
//         } else {
//             finalDisplayStatus = databaseParentStatus;
//         }

//         return {
//             _id: h._id,
//             name: h.name,
//             category: h.category,
//             habitType: h.habitType,
//             infoContent: h.infoContent,
//             pdfContent: h.pdfContent,
//             customDetails: h.customDetails,
//             adhkarSet: h.adhkarSet,
//             quranContent: h.quranContent,
//             status: finalDisplayStatus,
//             connectedHabits,
//         };
//     });

//     // ── Sort: Pending → Completed → Skipped ──────────────────
//     // This applies to all habits, whether they have connectedHabits or not
//     const sortedResult = result.sort(
//         (a, b) => (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0),
//     );

//     // ── Summary ───────────────────────────────────────────────

//     const total = sortedResult.length;
//     const completed = sortedResult.filter(h => h.status === 'Completed').length;
//     const pending = sortedResult.filter(h => h.status === 'Pending').length;
//     const skipped = sortedResult.filter(h => h.status === 'Skipped').length;

//     const completedHabits = sortedResult
//         .filter(h => h.status === 'Completed')
//         .map(h => ({ _id: h._id, name: h.name }));

//     return {
//         summary: {
//             total,
//             completed,
//             pending,
//             skipped,
//             label: `${completed} of ${total} completed`,
//         },
//         completedToday: completedHabits,
//         habits: sortedResult,
//     };
// };


const resolveHabitDisplay = (h: any) => {
    const template = h.template as any | null | undefined;

    return {
        name: template?.name ?? h.name ?? null,
        category: template?.category ?? h.category ?? null,
        infoContent: template?.infoContent ?? null,
        pdfContent: template?.pdfContent ?? null,
        habitType: template?.habitType ?? h.habitType ?? null,
        hasAdhkarSet: !!template?.adhkarSet,
        hasQuranContent: !!template?.quranContent,
    };
};

const getTodayHabits = async (user: IUser, category?: string) => {
    const userId = user._id as Types.ObjectId;
    const dateStr = buildDateBasedOnTimeZone(user.timezone as string);

    const todayDayName = moment(dateStr)
        .format('ddd')
        .toLowerCase() as WeekDay;

    // Nested habits (connectedHabits or parent set) must not also appear as top-level rows.
    const allActiveHabits = await UserHabit.find({
        user: userId,
        isActive: true,
    }).select('_id parent connectedHabits').lean();

    const nestedHabitIds = new Set<string>();
    for (const h of allActiveHabits) {
        if (h.parent) nestedHabitIds.add(h._id.toString());
        for (const c of h.connectedHabits ?? []) {
            const id = toIdString(c.userHabit);
            if (id) nestedHabitIds.add(id);
        }
    }

    const filter: any = {
        user: userId,
        isActive: true,
        _id: { $nin: [...nestedHabitIds] },
    };

    if (category && category.toLowerCase() !== 'all') {
        filter.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    const habits = await UserHabit.find(filter)
        .select('_id name category connectedHabits customDetails frequency startDate template isPrebuilt')
        .populate({ path: 'template', select: 'name category infoContent habitType pdfContent adhkarSet quranContent' })
        .populate({
            path: 'connectedHabits.userHabit',
            select: '_id name category customDetails template connectedPrayer frequency startDate',
            populate: { path: 'template', select: '_id name category habitType infoContent pdfContent adhkarSet quranContent' },
        })
        .sort({ displayOrder: 1 })
        .lean();

    // ── Frequency check ───────────────────────────────────────

    const shouldShowToday = (frequency: IFrequency, startDate: Date): boolean => {
        switch (frequency.type) {
            case FREQUENCY_TYPES.DAILY:
                return true;

            case FREQUENCY_TYPES.WEEKLY: {
                if (!frequency.selectedDays?.length) return false;
                return frequency.selectedDays.includes(todayDayName);
            }

            case FREQUENCY_TYPES.EVERY_N_DAYS: {
                if (!frequency.everyNDays) return false;
                const start = moment(startDate).startOf('day');
                const today = moment(dateStr).startOf('day');
                const diffDays = today.diff(start, 'days');
                return diffDays >= 0 && diffDays % frequency.everyNDays === 0;
            }

            default:
                return true;
        }
    };

    const todayHabits = habits.filter(h => shouldShowToday(h.frequency, h.startDate));

    // Pre-built templates only appear once at top level (duplicate Adhkar clones).
    const seenTopLevelTemplates = new Set<string>();
    const uniqueTodayHabits = todayHabits.filter(h => {
        const templateId = toIdString((h as { template?: unknown }).template);
        if (!templateId) return true;
        if (seenTopLevelTemplates.has(templateId)) return false;
        seenTopLevelTemplates.add(templateId);
        return true;
    });

    // ── Log IDs collect ───────────────────────────────────────

    const allUserHabitIds = uniqueTodayHabits.map(h => h._id);

    const connectedIds = uniqueTodayHabits.flatMap(h =>
        dedupeConnectedChildren(
            (h.connectedHabits ?? []).filter((c: any) => {
                const child = c.userHabit;
                return child?.frequency ? shouldShowToday(child.frequency, child.startDate) : true;
            }),
        ).map((c: any) => c.userHabit?._id ?? c.userHabit),
    );

    const allIds = [...allUserHabitIds, ...connectedIds].filter(id => Boolean(id));

    // ── Logs fetch ────────────────────────────────────────────

    const existingLogs = await HabitLog.find({
        userHabit: { $in: allIds },
        date: dateStr,
    }).select('userHabit status').lean();

    const logMap = new Map<string, string>(
        existingLogs.map((l: any) => [l.userHabit?.toString(), l.status]),
    );

    // Missing logs seed
    const missingLogIds = allIds.filter(id => !logMap.has(id.toString()));
    if (missingLogIds.length) {
        await HabitLog.insertMany(
            missingLogIds.map(id => ({
                user: userId,
                userHabit: id,
                date: dateStr,
                status: 'Pending',
            })),
        );
        missingLogIds.forEach(id => logMap.set(id.toString(), 'Pending'));
    }

    // ── Response build ────────────────────────────────────────

    const seenNestedChildIds = new Set<string>();

    const result = uniqueTodayHabits.map(h => {
        const connectedHabits = dedupeConnectedChildren(
            (h.connectedHabits ?? [])
                .filter((c: any) => {
                    const child = c.userHabit;
                    return child?.frequency ? shouldShowToday(child.frequency, child.startDate) : true;
                })
                .filter((c: any) => Boolean(c.userHabit))
                .sort((a: any, b: any) => a.order - b.order),
        )
            .filter((c: any) => {
                const childId = toIdString(c.userHabit);
                if (!childId || seenNestedChildIds.has(childId)) return false;
                seenNestedChildIds.add(childId);
                return true;
            })
            .map((c: any) => {
                const child = c.userHabit;
                const childId = child?._id?.toString() ?? c.userHabit?.toString();
                const childDisplay = resolveHabitDisplay(child ?? {});

                return {
                    _id: child?._id ?? c.userHabit,
                    name: childDisplay.name,
                    category: childDisplay.category,
                    infoContent: childDisplay.infoContent,
                    pdfContent: childDisplay.pdfContent,
                    adhkarSet: childDisplay.hasAdhkarSet,
                    quranContent: childDisplay.hasQuranContent,
                    customDetails: child?.customDetails ?? null,
                    order: c.order,
                    status: logMap.get(childId) ?? 'Pending',
                };
            });

        const databaseParentStatus = logMap.get(h._id.toString()) ?? 'Pending';

        // ── Display status determine ───────────────────────────
        let finalDisplayStatus: string;

        if (connectedHabits.length > 0) {
            if (databaseParentStatus === 'Skipped') {
                // If the parent is skipped, mark it as Skipped so it sorts lower
                finalDisplayStatus = 'Skipped';
            } else if (
                databaseParentStatus === 'Completed' &&
                connectedHabits.every(ch => ch.status === 'Completed')
            ) {
                // Parent and all children completed -> Completed
                finalDisplayStatus = 'Completed';
            } else {
                // Any pending or incomplete item -> Pending
                finalDisplayStatus = 'Pending';
            }
        } else {
            finalDisplayStatus = databaseParentStatus;
        }

        const parentDisplay = resolveHabitDisplay(h);

        return {
            _id: h._id,
            name: parentDisplay.name,
            category: parentDisplay.category,
            infoContent: parentDisplay.infoContent,
            habitType: parentDisplay.habitType,
            pdfContent: parentDisplay.pdfContent,
            hasAdhkarSet: parentDisplay.hasAdhkarSet,
            hasQuranContent: parentDisplay.hasQuranContent,
            customDetails: h.customDetails,
            status: finalDisplayStatus,
            connectedHabits,
        };
    });

    // ── Sort: Pending → Completed → Skipped ──────────────────
    // This applies to all habits, whether they have connectedHabits or not
    const sortedResult = result.sort(
        (a, b) => (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0),
    );

    // ── Summary ───────────────────────────────────────────────

    const total = sortedResult.length;
    const completed = sortedResult.filter(h => h.status === 'Completed').length;
    const pending = sortedResult.filter(h => h.status === 'Pending').length;
    const skipped = sortedResult.filter(h => h.status === 'Skipped').length;

    const completedHabits = sortedResult
        .filter(h => h.status === 'Completed')
        .map(h => ({ _id: h._id, name: h.name }));

    return {
        summary: {
            total,
            completed,
            pending,
            skipped,
            label: `${completed} of ${total} completed`,
        },
        completedToday: completedHabits,
        habits: sortedResult,
    };
};



// ─────────────────────────────────────────────────────────────
//  connectToParent — order now starts from the existing max
// ─────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────
//  EditHabit — connectedHabits comes as string[], and order is set from the index
// ─────────────────────────────────────────────────────────────
const updateUserHabit = async (user: IUser, userHabitId: string, payload: EditHabitPayload) => {

    const userId = user._id as Types.ObjectId;

    const habit = await UserHabit.findOne({
        _id: userHabitId,
        user: userId,
        isActive: true,
    }).populate<{ template: IHabitTemplate | null }>({
        path: 'template',
        select: 'allowConnectedPrayers isPrayerLocked connectedPrayer',
    });

    if (!habit) throw new NotFoundError('Habit not found or deactivated');

    // ── Fields only a custom (non-prebuilt) habit's owner can edit ──
    if (!habit.isPreBuilt) {
        habit.name = payload.name ?? habit.name;
        habit.connectedPrayer = (payload.connectedPrayer as ConnectedPrayer) ?? habit.connectedPrayer;
        habit.customDetails = payload.customDetails ?? habit.customDetails;
    }

    // Frequency
    if (payload.frequency) {
        if (!habit.allowedFrequencies.includes(payload.frequency.type as any)) {
            throw new BadRequestError(
                `Frequency '${payload.frequency.type}' is not allowed for this habit`,
            );
        }
        habit.frequency = payload.frequency as any;
    }

    // Reminder
    if (payload.reminder !== undefined) habit.reminder = payload.reminder as any;

    // StartDate
    if (payload.startDate !== undefined) {
        habit.startDate = payload.startDate;
    }

    // Location
    if (payload.location !== undefined) {
        habit.location = payload.location as any;
    }

    // showOnTodayScreen
    if (payload.customDetails !== undefined) {
        habit.showOnTodayScreen = true;
    }

    if (payload.customDetails !== undefined || habit.customDetails !== "") {
        habit.customDetails = payload.customDetails;
    }

    // ── connectedPrayer change → reconnect this habit under its new parent prayer ──
    // Custom habits (template: null) are always effectively unlocked — the
    // user owns the habit, so they always control its connectedPrayer.
    // Template-based habits use the template's own isPrayerLocked setting.
    const effectiveIsPrayerLocked = habit.isPreBuilt ? (habit.template?.isPrayerLocked ?? true) : false;

    if (!effectiveIsPrayerLocked && payload.connectedPrayer !== undefined) {

        // Only template-based habits have a restriction list to validate
        // against — custom habits are unrestricted (any prayer is allowed).
        if (
            habit.template?.allowConnectedPrayers &&
            !habit.template.allowConnectedPrayers.includes(payload.connectedPrayer as AllowedConnectedPrayer)
        ) {
            throw new BadRequestError('This connected prayer is not allowed for this habit');
        }

        const connectHabit = await UserHabit.findOne({
            user: userId,
            connectedPrayer: payload.connectedPrayer as ConnectedPrayer,
        });

        if (!connectHabit) {
            throw new NotFoundError('Connected prayer habit not found');
        }

        // Remove this habit from any previously connected prayer parent first.
        await UserHabit.updateMany(
            {
                user: userId,
                connectedPrayer: { $in: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha And Witr'] },
                'connectedHabits.userHabit': habit._id,
            },
            {
                $pull: {
                    connectedHabits: {
                        userHabit: habit._id,
                    },
                },
            },
        );

        // Reload target parent so ordering is calculated from the latest state.
        const refreshedConnectHabit = await UserHabit.findById(connectHabit._id);

        if (!refreshedConnectHabit) {
            throw new NotFoundError('Connected prayer habit not found');
        }

        const maxOrder = refreshedConnectHabit.connectedHabits?.reduce(
            (max, item) => (item.order > max ? item.order : max),
            0
        ) ?? 0;

        const addedHabit = {
            userHabit: habit._id,
            order: maxOrder + 1,
        }

        // Save the final state back to the habit document
        refreshedConnectHabit.connectedHabits?.push(addedHabit);
        habit.parent = refreshedConnectHabit._id;
        habit.connectedPrayer = payload.connectedPrayer as ConnectedPrayer;
        await refreshedConnectHabit.save();
    }

    // ── connectedHabits list change (this habit acting as a parent) ──
    if (payload.connectedHabits && payload.connectedHabits.length > 0) {

        if (habit.connectedPrayer?.includes('Fajr') || habit.connectedPrayer?.includes('Dhuhr') || habit.connectedPrayer?.includes('Asr') || habit.connectedPrayer?.includes('Maghrib') || habit.connectedPrayer?.includes('Isha')) {
            throw new BadRequestError('Only obligatory prayers can have connected habits');
        }

        const inputIds = payload.connectedHabits; // Full array of IDs the frontend wants to keep/add
        const existingConnectedHabits = habit.connectedHabits ?? [];

        // 1. Separate out what needs to be REMOVED vs what is NEW
        const existingIds = existingConnectedHabits.map(c => c.userHabit.toString());

        // IDs in existing but NOT in inputIds are being removed
        const idsToRemove = existingIds.filter(id => !inputIds.includes(id));
        // IDs in inputIds but NOT in existing are new additions
        const uniqueNewIds = inputIds.filter(id => !existingIds.includes(id));

        // 2. Handle Removals: Clear their parent template in the database
        if (idsToRemove.length) {
            await UserHabit.updateMany(
                { _id: { $in: idsToRemove }, user: userId },
                { $unset: { parent: null } } // or $set: { parent: null } depending on your schema
            );
        }

        // 3. Handle Additions & Validations
        if (uniqueNewIds.length) {
            const validHabits = await UserHabit.find({
                _id: { $in: uniqueNewIds },
                user: userId,
                isActive: true,
            }).select('_id').lean();

            if (validHabits.length !== uniqueNewIds.length) {
                throw new BadRequestError('One or more connected habits are invalid or inactive');
            }

            // Set parent template for new additions.
            // NOTE: `habit.template` may be null for custom habits acting as
            // a parent (unusual, but guarded here so we never write an
            // invalid/undefined value).
            await UserHabit.updateMany(
                { _id: { $in: uniqueNewIds }, user: userId },
                { $set: { parent: habit.template?._id ?? null } },
            );
        }

        // 4. Build the final array maintaining original orders or re-sequencing everything
        // Filter out the deleted habits from the local subdocument array first
        let updatedConnectedHabits = existingConnectedHabits.filter(
            item => !idsToRemove.includes(item.userHabit.toString())
        );

        // Find the max order among remaining items
        const maxOrder = updatedConnectedHabits.reduce(
            (max, item) => (item.order > max ? item.order : max),
            0
        );

        // Map new items sequentially
        const formattedNewHabits = uniqueNewIds.map((id, index) => ({
            userHabit: new Types.ObjectId(id),
            order: maxOrder + index + 1,
        }));

        // 5. Save the final state back to the habit document
        habit.connectedHabits = [...updatedConnectedHabits, ...formattedNewHabits];
    }

    await habit.save();

    return {
        _id: habit._id,
        name: habit.name,
    };
};


// ─────────────────────────────────────────────────────────────
//  get habit detail
// ─────────────────────────────────────────────────────────────

const resolveHabitDetailDisplay = (h: any) => {
    const template = h.template as any | null | undefined;

    return {
        name: template?.name ?? h.name ?? null,
        category: template?.category ?? h.category ?? null,
        habitType: template?.habitType ?? null,
        infoContent: template?.infoContent ?? null,
        pdfContent: template?.pdfContent ?? null,
        hasAdhkarSet: !!template?.adhkarSet,
        hasQuranContent: !!template?.quranContent,
        isPrayerLocked: template?.isPrayerLocked ?? true,
        isLocked: template?.isLocked ?? false,
        allowedConnectedPrayers: template?.allowConnectedPrayers ?? [],
        connectedPrayer: h.prayerCustomizedAt
            ? h.connectedPrayer ?? null
            : template?.connectedPrayer ?? h.connectedPrayer ?? null,
    };
};

const getHabitDetail = async (user: IUser, userHabitId: string) => {
    const userId = user._id as Types.ObjectId;

    const habit = await UserHabit.findOne({
        _id: userHabitId,
        user: userId,
        isActive: true,
    })
        .populate({
            path: 'template',
            select: 'name category habitType connectedPrayer isPrayerLocked isLocked allowConnectedPrayers allowedFrequencies defaultFrequency infoContent pdfContent adhkarSet quranContent',
        })
        .populate({
            path: 'connectedHabits.userHabit',
            select: '_id name category template habitType isLocked allowConnectedPrayers allowedFrequencies frequency',
            populate: {
                path: 'template',
                select: 'name category habitType connectedPrayer isPrayerLocked isLocked allowConnectedPrayers allowedFrequencies defaultFrequency infoContent pdfContent adhkarSet quranContent',
            },
        })
        .lean();

    console.log({ habit })

    if (!habit) throw new NotFoundError('Habit not found or habit is not active');

    const template = habit.template as any | null | undefined;

    const isPrayerLocked = habit.isPreBuilt ? (template?.isPrayerLocked ?? true) : false;

    const allowedPrayers: string[] = template
        ? template?.allowConnectedPrayers ?? []
        : Object.values(OBLIGATORY_PRAYER) as string[];
    const allowedFrequencies: string[] = template?.allowedFrequencies ?? habit.allowedFrequencies ?? [];


    if (template) {
        const storedFrequenciesMatch =
            JSON.stringify([...(habit.allowedFrequencies ?? [])].sort()) ===
            JSON.stringify([...allowedFrequencies].sort());

        if (!storedFrequenciesMatch) {
            await UserHabit.updateOne({ _id: habit._id }, { $set: { allowedFrequencies } });
            (habit as any).allowedFrequencies = allowedFrequencies;
        }
    }

    if (!isPrayerLocked && habit.connectedPrayer && template) {
        const stillAllowed = allowedPrayers.includes(habit.connectedPrayer);

        if (!stillAllowed) {
            await UserHabit.updateOne(
                { _id: habit._id },
                { $set: { connectedPrayer: null, parent: null } },
            );

            await disconnectFromParents(habit._id);

            (habit as IUserHabit).connectedPrayer = null;
        }
    }


    if (habit.frequency?.type && !allowedFrequencies.includes(habit.frequency.type)) {
        const defaultType = template?.defaultFrequency?.type;
        const defaultIsValid = !!defaultType && allowedFrequencies.includes(defaultType);

        const fallbackFrequency = defaultIsValid
            ? {
                type: defaultType,
                selectedDays: template?.defaultFrequency?.selectedDays ?? [],
                everyNDays: template?.defaultFrequency?.everyNDays,
            }
            : {
                // defaultFrequency itself is invalid too — use the first
                // allowed type as a guaranteed-valid safe fallback
                type: allowedFrequencies[0] ?? FREQUENCY_TYPES.DAILY,
                selectedDays: [],
                everyNDays: allowedFrequencies[0] === FREQUENCY_TYPES.EVERY_N_DAYS ? 1 : undefined,
            };

        await UserHabit.updateOne(
            { _id: habit._id },
            { $set: { frequency: fallbackFrequency } },
        );

        (habit as IUserHabit).frequency = fallbackFrequency;
    }

    const display = resolveHabitDetailDisplay(habit);
    const isObligatoryPrayer = display.habitType === HABIT_TYPES.OBLIGATORY_PRAYER;

    return {
        _id: habit._id,
        name: display.name,
        category: display.category,
        connectedPrayer: isPrayerLocked ? template?.connectedPrayer ?? null : habit.connectedPrayer ?? null,
        isPrayerLocked,
        location: habit.location ?? null,
        frequency: habit.frequency,
        isPreBuilt: habit.isPreBuilt,
        allowedFrequencies,
        allowedConnectedPrayers: allowedPrayers,
        reminder: habit.reminder,
        startDate: habit.startDate,
        showOnTodayScreen: habit.showOnTodayScreen,
        targetType: habit.targetType ?? null,
        targetDescription: habit.targetDescription ?? null,
        customDetails: habit.customDetails ?? null,
        infoContent: display.infoContent,
        pdfContent: display.pdfContent,
        hasAdhkarSet: display.hasAdhkarSet,
        hasQuranContent: display.hasQuranContent,
        connectedHabits: isObligatoryPrayer
            ? (habit.connectedHabits ?? [])
                .sort((a, b) => a.order - b.order)
                .map((c: any) => {
                    const child = c.userHabit;
                    const childDisplay = resolveHabitDetailDisplay(child ?? {});

                    return {
                        _id: child?._id ?? c.userHabit,
                        name: childDisplay.name,
                        isLocked: childDisplay.isLocked,
                    };
                })
            : undefined,
    };
};


// ─────────────────────────────────────────────────────────────
//  3. ADD CUSTOM HABIT
// ─────────────────────────────────────────────────────────────
const addCustomHabit = async (user: IUser, payload: AddCustomHabitPayload) => {

    console.log({ payload })

    const userId = user._id as Types.ObjectId;
    const date = buildDateBasedOnTimeZone(user.timezone as string);


    // Duplicate name check for this user
    const duplicate = await UserHabit.exists({
        user: userId,
        name: { $regex: new RegExp(`^${payload.name.trim()}$`, 'i') },
    });

    if (duplicate) throw new BadRequestError('You already have a habit with this name');

    console.log({ customPayload: payload });

    const newHabit = await UserHabit.create({
        user: userId,
        template: null,
        name: payload.name.trim(),
        category: payload.category as HabitCategory,
        isPreBuilt: false,
        connectedPrayer: (payload.connectedPrayer ?? null) as ConnectedPrayer | null,
        frequency: payload.frequency as IFrequency,
        targetType: (payload.targetType ?? null) as TargetType | null,
        targetDescription: payload.targetDescription ?? null,
        allowedFrequencies: [FREQUENCY_TYPES.DAILY, FREQUENCY_TYPES.WEEKLY, FREQUENCY_TYPES.EVERY_N_DAYS],
        reminder: payload.reminder ?? { enabled: false, time: '12:00 AM' },
        startDate: payload.startDate ? new Date(payload.startDate) : new Date(),
        showOnTodayScreen: payload.customDetails ? true : false,
        customDetails: payload.customDetails ?? null,
        isActive: true,

    });


    if (payload.connectedPrayer !== undefined) {
        // check if the connected prayer habit exists for this user

        if (!['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha And Witr'].includes(payload.connectedPrayer as string)) {
            throw new BadRequestError('Only obligatory prayers can have connected habits');
        }

        const connectHabit = await UserHabit.findOne({
            user: userId,
            connectedPrayer: payload.connectedPrayer as ConnectedPrayer,
        });

        console.log({ connectHabit })

        if (!connectHabit) {
            throw new NotFoundError('Connected prayer habit not found');
        }

        // Reload target parent so ordering is calculated from the latest state.
        const refreshedConnectHabit = await UserHabit.findById(connectHabit._id);

        console.log({ refreshedConnectHabit })
        if (!refreshedConnectHabit) {
            throw new NotFoundError('Connected prayer habit not found');
        }

        const maxOrder = refreshedConnectHabit.connectedHabits?.reduce(
            (max, item) => (item.order > max ? item.order : max),
            0
        ) ?? 0;

        const addedHabit = {
            userHabit: newHabit._id,
            order: maxOrder + 1,
        }

        // Save the final state back to the habit document
        refreshedConnectHabit.connectedHabits?.push(addedHabit);
        newHabit.parent = refreshedConnectHabit._id;
        newHabit.connectedPrayer = payload.connectedPrayer as ConnectedPrayer;
        await refreshedConnectHabit.save();
        await newHabit.save();
    }

    await HabitLog.create({
        user: userId,
        userHabit: newHabit._id,
        date: String(date),
        status: 'Pending',
    });

    return {
        _id: newHabit._id,
        name: newHabit.name,
    };
};

// ─────────────────────────────────────────────────────────────
//  4. SEARCH HABITS TO CONNECT
// ─────────────────────────────────────────────────────────────

const searchHabitsToConnect = async (
    user: IUser,
    userHabitId: string,
    searchTerm?: string,
) => {
    const userId = user._id as Types.ObjectId;

    // Validate the parent habit — need its template to resolve habitType (to
    // confirm it's really an obligatory prayer) and the effective connectedPrayer.
    const parentHabit = await UserHabit.findOne({
        _id: userHabitId,
        user: userId,
        isActive: true,
    })
        .select('_id connectedHabits connectedPrayer prayerCustomizedAt template')
        .populate({ path: 'template', select: 'habitType connectedPrayer isPrayerLocked' })
        .lean();

    if (!parentHabit) throw new NotFoundError('Habit not found or not an obligatory prayer');

    const parentTemplate = parentHabit.template as any | null | undefined;

    if (parentTemplate?.habitType !== HABIT_TYPES.OBLIGATORY_PRAYER) {
        throw new NotFoundError('Habit not found or not an obligatory prayer');
    }

    // Locked habits always mirror the template live (user never had a choice).
    // Unlocked habits use the user's own stored selection — getHabitDetail is
    // responsible for keeping that selection valid against the template's
    // current allowConnectedPrayers list.
    const isPrayerLocked = parentTemplate?.isPrayerLocked ?? true;
    const effectiveConnectedPrayer = isPrayerLocked
        ? parentTemplate?.connectedPrayer ?? null
        : parentHabit.connectedPrayer ?? parentTemplate?.connectedPrayer ?? null;

    if (!effectiveConnectedPrayer) return [];

    // Already connected ids (+ the parent itself) should never show up as a candidate
    const alreadyConnectedIds = (parentHabit.connectedHabits ?? []).map(c => c.userHabit.toString());
    const excludedIds = new Set([userHabitId, ...alreadyConnectedIds]);
    console.log({ excludedIds, effectiveConnectedPrayer, searchTerm });
    // Pull every other active habit this user has, with its template populated.
    // (Per-user habit counts are small, so filtering in application code here
    // is simpler to reason about than a $lookup aggregation.)
    const candidates = await UserHabit.find({
        user: userId,
        isActive: true,
        _id: { $nin: [...excludedIds] },
    })
        .select('_id name category allowConnectedPrayers template')
        .populate({ path: 'template', select: 'name category habitType allowConnectedPrayers' })
        .lean();

    console.log({ candidates })
    const search = searchTerm?.trim().toLowerCase();

    const matches = candidates.filter((c: any) => {
        const template = c.template;
        console.log({ template })
        const resolvedHabitType = template?.habitType ?? null;
        const resolvedAllowConnectedPrayers: string[] = template?.allowConnectedPrayers ?? c.allowConnectedPrayers ?? [];
        const resolvedName = template?.name ?? c.name ?? '';

        if (resolvedHabitType === HABIT_TYPES.OBLIGATORY_PRAYER || resolvedHabitType === HABIT_TYPES.SUNNAH_PRAYER) {
            return false;
        }

        if (!resolvedAllowConnectedPrayers.includes(effectiveConnectedPrayer)) {
            return false;
        }

        if (search && !resolvedName.toLowerCase().includes(search)) {
            return false;
        }

        return true;
    });

    return matches.slice(0, 20).map((c: any) => ({
        _id: c._id,
        name: c.template?.name ?? c.name ?? null,
        category: c.template?.category ?? c.category ?? null,
        habitType: c.template?.habitType ?? null,
    }));
};

// delete custom habit
const deleteCustomHabit = async (user: IUser, habitId: string) => {

    const habit = await UserHabit.findById(habitId).select('_id user isPreBuilt');
    if (!habit) {
        throw new NotFoundError('Habit not found');
    }
    if (habit.isPreBuilt) {
        throw new BadRequestError('Pre built habits cannot be deleted');
    }
    if (habit.user.toString() !== user._id.toString()) {
        throw new BadRequestError('You can only delete your own habits');
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        // 1. Delete the habit
        await UserHabit.deleteOne({ _id: habitId }, { session });
        // 2. Delete associated habit logs
        await HabitLog.deleteMany({ userHabit: habitId }, { session });
        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }

};

// completed habit 
const completedHabit = async (user: IUser, habitId: string) => {

    const userId = user._id;
    const dateStr = buildDateBasedOnTimeZone(user.timezone as string);
    // Database entry khujo ba update koro

    const habit = await UserHabit.findById(habitId);
    if (!habit) {
        throw new NotFoundError('Habit not found');
    }

    let log = await HabitLog.findOne({
        user: userId,
        userHabit: habitId,
        date: dateStr
    });

    if (!log) {
        // Fresh initialization line setup tracking
        log = new HabitLog({
            user: userId,
            userHabit: habitId,
            date: dateStr,
            status: LOG_STATUS.PENDING // Initial state setting
        });
    }

    // ─────────────────────────────────────────────────────────
    //  TOGGLE CORE LOGIC ENGINE
    // ─────────────────────────────────────────────────────────
    if (log.status === LOG_STATUS.COMPLETED) {
        // If already Completed, toggle back to Pending state
        log.status = LOG_STATUS.PENDING;
        log.completedAt = null;
        log.skippedAt = null;
        log.locationLogged = null; // Reset location data if required
    } else {
        // If Pending or Skipped, transition directly to Completed
        log.status = LOG_STATUS.COMPLETED;
        log.completedAt = new Date();
        log.skippedAt = null; // Clear skip tracking if it was skipped before
    }
    await log.save();
    return log;
}

// skipped habit
const skippedHabit = async (user: IUser, habitId: string) => {

    const userId = user._id;
    const dateStr = buildDateBasedOnTimeZone(user.timezone as string);
    // Database entry khujo ba update koro

    const habit = await UserHabit.findById(habitId).select('_id');
    if (!habit) {
        throw new NotFoundError('Habit not found');
    }

    let log = await HabitLog.findOne({
        user: userId,
        userHabit: habitId,
        date: dateStr
    });

    if (!log) {
        // Fresh initialization line setup tracking
        log = new HabitLog({
            user: userId,
            userHabit: habitId,
            date: dateStr,
            status: LOG_STATUS.PENDING // Initial state setting
        });
    }

    // ─────────────────────────────────────────────────────────
    //  TOGGLE CORE LOGIC ENGINE
    // ─────────────────────────────────────────────────────────
    if (log.status === LOG_STATUS.SKIPPED) {
        // If already Skipped, toggle back to Pending state
        log.status = LOG_STATUS.PENDING;
        log.skippedAt = null;
        log.locationLogged = null; // Reset location data if required
    } else {
        // If Pending or Skipped, transition directly to Skipped
        log.status = LOG_STATUS.SKIPPED;
        log.skippedAt = new Date();
    }
    await log.save();
    return log;
}

// get content
const getDynamicHabitContent = async (user: IUser, habitId: string) => {

    const habit = await UserHabit.findOne({ _id: habitId, user: user._id })
        .populate<{ template: IHabitTemplate }>('template', 'adhkarSet quranContent pdfContent infoContent')
        .select('_id template')
        .lean();

    if (!habit) {
        throw new NotFoundError('Habit not found');
    }

    const template = habit.template;
    const pdfContent = template?.pdfContent ?? null;
    const infoContent = template?.infoContent ?? null;

    if (!template?.adhkarSet && !template?.quranContent && !pdfContent && !infoContent) {
        throw new NotFoundError('No dynamic content associated with this habit');
    }

    if (template?.quranContent) {
        const quranData = await QuranContent.findById(template.quranContent).lean();
        if (quranData) {
            return { ...quranData, pdfContent, infoContent };
        }
    }

    if (template?.adhkarSet) {
        const adhkarData = await AdhkarSet.findById(template.adhkarSet).lean();
        if (adhkarData) {
            return { ...adhkarData, pdfContent, infoContent };
        }
    }

    if (pdfContent || infoContent) {
        return { pdfContent, infoContent };
    }

    throw new NotFoundError('No dynamic content associated with this habit');
};

export const userHabitService = {
    toggleHabit,
    getTodayHabits,
    updateUserHabit,
    addCustomHabit,
    searchHabitsToConnect,
    getHabitDetail,
    deleteCustomHabit,
    completedHabit,
    skippedHabit,
    getDynamicHabitContent,
};



