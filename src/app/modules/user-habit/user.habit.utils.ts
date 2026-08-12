import moment from 'moment-timezone';

export const buildDateBasedOnTimeZone = (
    timezone: string
): string => {
    return moment.tz(timezone).format('YYYY-MM-DD');
};



/*

import moment from 'moment-timezone';
import mongoose, { Types } from 'mongoose';
import { ConnectedPrayer, HabitCategory } from '../../../interfaces';
import { BadRequestError, NotFoundError } from '../../errors/request/apiError';
import { AdhkarSet } from '../dashboard/adhkar-set/adhkar.set.model';

import { HABIT_TYPES } from '../dashboard/habit-template/system.habit.constant';
import { HabitTemplate } from '../dashboard/habit-template/system.habit.model';
import { QuranContent } from '../dashboard/quran-content/quran.content.model';
import { LOG_STATUS } from '../habit-logger/habit.logger.constant';
import { HabitLog } from '../habit-logger/habit.logger.model';
import { IUser } from '../user/user.interface';
import { FREQUENCY_TYPES, WeekDay } from './user.habit.constant';
import { IConnectedHabit, IFrequency } from './user.habit.interface';
import { UserHabit } from './user.habit.model';
import { buildDateBasedOnTimeZone } from './user.habit.utils';
import { AddCustomHabitPayload, EditHabitPayload } from './user.habit.zod';


// ─────────────────────────────────────────────────────────────
//  HELPER
// ─────────────────────────────────────────────────────────────

const buildHabitPayload = (userId: Types.ObjectId, template: any) => ({
    user: userId,
    template: template._id,
    name: template.name,
    category: template.category,
    habitType: template.habitType,
    group: template.group ?? null,
    parent: template.parent ?? null,

    // Prayer
    connectedPrayer: template.connectedPrayer ?? null,

    allowConnectedPrayers: template.allowConnectedPrayers ?? [],
    // Location

    location: template.supportsLocation ?? null,

    // Lock
    isLocked: template.isLocked ?? false,

    isPrayerLocked: template.isPrayerLocked ?? true,
    // Info
    hasInfoContent: Array.isArray(template.infoContent)
        ? template.infoContent.length > 0
        : !!template.infoContent,
    infoContent: template.infoContent ?? null,

    // Reading content
    adhkarSet: template.adhkarSet ?? null,
    quranContent: template.quranContent ?? null,

    // Target
    targetType: template.targetType ?? null,
    targetDescription: template.targetDescription ?? null,
    allowedFrequencies: template.allowedFrequencies ?? [],
    // Frequency
    frequency: {
        type: template.defaultFrequency.type ?? FREQUENCY_TYPES.DAILY,
        selectedDays: template.defaultFrequency.selectedDays ?? [],
        everyNDays: template.defaultFrequency.everyNDays ?? undefined,
    },

    // Defaults
    reminder: { enabled: false, time: '12:00 AM' },
    startDate: new Date(),
    showOnTodayScreen: true,
    displayOrder: 0,
    isActive: true,
    connectedHabits: template.connectedHabits ?? [],
    customDetails: null,
});


// habit connect
const connectToParent = async (
    userId: Types.ObjectId,
    parentTemplateId: Types.ObjectId,
    newUserHabitId: Types.ObjectId,
) => {

    const parentUserHabit = await UserHabit.findOne({
        user: userId,
        template: parentTemplateId,
        isActive: true,
    }).select('_id connectedHabits');


    if (!parentUserHabit) return;

    console.log({ parentUserHabitConnected: parentUserHabit.connectedHabits })
    const alreadyConnected = parentUserHabit.connectedHabits?.some(
        (c: IConnectedHabit) => c.userHabit.toString() === newUserHabitId.toString(),
    );
    if (alreadyConnected) return;
    console.log({ alreadyConnected })
    console.log("asd", parentUserHabit.connectedHabits?.length)
    const maxOrder = parentUserHabit.connectedHabits?.reduce(
        (max: number, c: IConnectedHabit) => Math.max(max, c.order ?? 0),
        0,
    ) ?? 0;

    await UserHabit.updateOne(
        { _id: parentUserHabit._id },
        {
            $push: {
                connectedHabits: {
                    userHabit: newUserHabitId,
                    order: maxOrder + 1,
                },
            },
        },
    );
};


const disconnectFromParents = async (userHabitId: Types.ObjectId) => {
    await UserHabit.updateMany(
        { 'connectedHabits.userHabit': userHabitId },
        { $pull: { connectedHabits: { userHabit: userHabitId } } },
    );
};

// ─────────────────────────────────────────────────────────────
//  TOGGLE HABIT
// ─────────────────────────────────────────────────────────────
const toggleHabit = async (user: IUser, habitId: string, isActive: boolean) => {
    const userId = user._id as Types.ObjectId;
    const date = buildDateBasedOnTimeZone(user.timezone as string);

    // ─────────────────────────────────────────────────────────
    //  DEACTIVATE PATH
    // ─────────────────────────────────────────────────────────
    if (!isActive) {
        const childTemplates = await HabitTemplate.find({
            group: habitId,
            isActive: true,
        }).lean();

        const isGroup = childTemplates.length > 0;

        // ── Group deactivate ──
        if (isGroup) {
            const activeHabits = await UserHabit.find({
                user: userId,
                template: { $in: childTemplates.map(c => c._id) },
                isActive: true,
            }).select('_id').lean();

            if (!activeHabits.length) {
                throw new BadRequestError('No active habits found in this group.');
            }

            const habitIds = activeHabits.map(h => h._id);

            await UserHabit.updateMany(
                { _id: { $in: habitIds } },
                { $set: { isActive: false } },
            );

            await HabitLog.updateMany(
                { userHabit: { $in: habitIds }, date: String(date), status: LOG_STATUS.PENDING },
                { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
            );


            await Promise.all(habitIds.map(id => disconnectFromParents(id)));



            const parentsWithConnected = await UserHabit.find({
                _id: { $in: habitIds },
            }).select('connectedHabits').lean();

            const connectedChildIds = parentsWithConnected
                .flatMap(p => p.connectedHabits?.map((c: IConnectedHabit) => c.userHabit) ?? []);

            if (connectedChildIds.length) {
                await UserHabit.updateMany(
                    { _id: { $in: connectedChildIds }, isActive: true },
                    { $set: { isActive: false } },
                );

                await HabitLog.updateMany(
                    { userHabit: { $in: connectedChildIds }, date: String(date), status: LOG_STATUS.PENDING },
                    { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
                );

                await Promise.all(connectedChildIds.map((id: Types.ObjectId) => disconnectFromParents(id)));
            }

            return null;
        }

        // Need the template to know whether this is a connected-obligatory habit (e.g. Adhkar after prayer)
        const template = await HabitTemplate.findById(habitId).lean();

        // ── Connected-obligatory deactivate (e.g. Adhkar after prayer: deactivate all 5 instances) ──
        if (template?.isConnectedObligatory) {
            const activeInstances = await UserHabit.find({
                user: userId,
                template: habitId,
                isActive: true,
            }).select('_id').lean();

            if (!activeInstances.length) {
                throw new BadRequestError('Habit is already deactivated');
            }

            const instanceIds = activeInstances.map(h => h._id);

            await UserHabit.updateMany(
                { _id: { $in: instanceIds } },
                { $set: { isActive: false, parent: null } },
            );

            await HabitLog.updateMany(
                { userHabit: { $in: instanceIds }, date: String(date), status: LOG_STATUS.PENDING },
                { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
            );

            await Promise.all(instanceIds.map(id => disconnectFromParents(id)));

            return null;
        }

        // ── Single deactivate ──
        const userHabit = await UserHabit.findOne({
            template: habitId,
            user: userId,
            isActive: true,
        });

        if (!userHabit) {
            const customHabit = await UserHabit.findOne({
                _id: habitId,
                user: userId,
                template: null,
            });


            if (!customHabit) {
                throw new BadRequestError('custom habit not found');
            }
            if (!customHabit.isActive) {
                throw new BadRequestError('Habit is already deactivated');
            }
            await HabitLog.findOneAndUpdate(
                { userHabit: customHabit._id, date: String(date), status: LOG_STATUS.PENDING },
                { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
            );
            customHabit.isActive = false;
            await customHabit.save()

            await disconnectFromParents(customHabit._id);

            return null;
        }

        if (userHabit) {
            userHabit.isActive = false;
            userHabit.parent = null;
            await userHabit?.save();

            await HabitLog.findOneAndUpdate(
                { userHabit: userHabit._id, date: String(date), status: 'Pending' },
                { $set: { status: 'Skipped', skippedAt: new Date() } },
            );

            // Disconnect from the parent's connectedHabits
            await disconnectFromParents(userHabit._id);

            return null;
        }

    }

    // ─────────────────────────────────────────────────────────
    //  ACTIVATE PATH
    // ─────────────────────────────────────────────────────────
    const template = await HabitTemplate.findById(habitId).lean();

    if (!template) {
        // check it is custom habit activation with template null
        const userCustomHabit = await UserHabit.findOne({ user: userId, _id: habitId, template: null }).lean();
        if (!userCustomHabit) {
            throw new NotFoundError('Habit template not found');
        }

        if (userCustomHabit.isActive) {
            throw new BadRequestError('Habit is already active');
        }
        const existingLog = await HabitLog.findOne({
            userHabit: userCustomHabit._id,
            date: String(date),
        });

        if (existingLog) {
            if (existingLog.status === 'Skipped') {
                existingLog.status = 'Pending';
                existingLog.skippedAt = null;
                await existingLog.save();
            }
        } else {
            await HabitLog.create({
                user: userId,
                userHabit: userCustomHabit._id,
                date: String(date),
                status: 'Pending',
            });
        }
        await UserHabit.updateOne(
            { _id: userCustomHabit._id },
            { $set: { isActive: true, startDate: new Date() } }
        );

        return { added: [{ _id: userCustomHabit._id, name: userCustomHabit.name }], skipped: null };
    }

    // non custom habit activation with template found but inactive
    if (!template?.isActive) throw new BadRequestError('This habit is no longer available');

    const childTemplates = await HabitTemplate.find({
        group: habitId,
        isActive: true,
    }).lean();

    const isGroup = childTemplates.length > 0;

    // ── CASE 1: Group activate ──
    if (isGroup) {
        const existingHabits = await UserHabit.find({
            user: userId,
            template: { $in: childTemplates.map(c => c._id) },
        }).select('template isActive _id').lean();

        const existingMap = new Map(
            existingHabits.map(h => [h.template?.toString(), h]),
        );

        const toReactivate: Types.ObjectId[] = [];
        const toReactivateWithTemplate: { id: Types.ObjectId; templateId: Types.ObjectId }[] = [];
        const toCreate: typeof childTemplates = [];

        for (const child of childTemplates) {
            const existing = existingMap.get(child._id.toString());
            if (!existing) {
                toCreate.push(child);
            } else if (!existing.isActive) {
                toReactivate.push(existing._id);
                toReactivateWithTemplate.push({
                    id: existing._id,
                    templateId: child._id,
                });
            }
            // already active → skip silently
        }

        if (!toReactivate.length && !toCreate.length) {
            throw new BadRequestError('You have already added all habits from this group.');
        }

        // Reactivate soft-deleted habits
        if (toReactivate.length) {
            await UserHabit.updateMany(
                { _id: { $in: toReactivate } },
                { $set: { isActive: true, startDate: new Date() } },
            );

            // Today log check
            const existingLogs = await HabitLog.find({
                userHabit: { $in: toReactivate },
                date: String(date),
            }).select('userHabit status').lean();

            const existingLogMap = new Map<string, any>(
                existingLogs.map((l: any) => [l.userHabit?.toString(), l]),
            );

            const logsToInsert: Types.ObjectId[] = [];

            for (const id of toReactivate) {
                const existingLog = existingLogMap.get(id.toString());
                if (!existingLog) {
                    logsToInsert.push(id);
                } else if (existingLog.status === 'Skipped') {
                    await HabitLog.updateOne(
                        { userHabit: id, date: String(date) },
                        { $set: { status: 'Pending', skippedAt: null } },
                    );
                }
            }

            if (logsToInsert.length) {
                await HabitLog.insertMany(
                    logsToInsert.map(id => ({
                        user: userId,
                        userHabit: id,
                        date: String(date),
                        status: 'Pending',
                    })),
                );
            }


            const reactivatedTemplates = await HabitTemplate.find({
                _id: { $in: toReactivateWithTemplate.map(r => r.templateId) },
            }).select('_id parent').lean();

            const reactivatedTemplateMap = new Map<string, any>(
                reactivatedTemplates.map((t: any) => [t._id.toString(), t]),
            );

            for (const { id, templateId } of toReactivateWithTemplate) {
                const tmpl = reactivatedTemplateMap.get(templateId.toString());
                if (tmpl?.parent) {
                    await connectToParent(userId, tmpl.parent, id);
                }
            }
        }


        // Brand new habits create (with parent check)
        const skippedNames: string[] = [];
        const canAdd: typeof toCreate = [];

        for (const child of toCreate) {
            if (child.parent) {
                const parentActive = await UserHabit.exists({
                    user: userId,
                    template: child.parent,
                    isActive: true,
                });

                if (!parentActive) {
                    skippedNames.push(child.name);
                    continue;
                }
            }
            canAdd.push(child);
        }

        if (!canAdd.length && !toReactivate.length) {
            throw new BadRequestError(
                `Activate the obligatory prayers first to unlock: ${skippedNames.join(', ')}`,
            );
        }

        let newHabits: any[] = [];
        if (canAdd.length) {

            const payloads = canAdd.map(t => buildHabitPayload(userId, t));
            newHabits = await UserHabit.insertMany(payloads);

            await HabitLog.insertMany(
                newHabits.map(h => ({
                    user: userId,
                    userHabit: h._id,
                    date: String(date),
                    status: 'Pending',
                })),
            );

            for (let i = 0; i < newHabits.length; i++) {
                const tmpl = canAdd[i];
                if (tmpl.parent) {
                    await connectToParent(userId, tmpl.parent, newHabits[i]._id);
                }
            }
        }

        return {
            added: newHabits.map(h => ({ _id: h._id, name: h.name })),
            reactivated: toReactivate.map(id => ({ _id: id })),
            skipped: skippedNames.length
                ? `${skippedNames.join(', ')} skipped — activate the required habits first`
                : null,
        };
    }

    // ── CASE 1.5: Connected-obligatory activate (e.g. Adhkar after prayer → one instance per obligatory prayer) ──
    if (template.isConnectedObligatory) {
        const obligatoryPrayers = await UserHabit.find({
            user: userId,
            connectedPrayer: { $in: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] },
        }).select('_id isActive template connectedPrayer').lean();

        if (!obligatoryPrayers.length) {
            throw new BadRequestError('Activate the obligatory prayers first to unlock this habit.');
        }

        // Only attach to prayers that are currently active
        const activePrayers = obligatoryPrayers.filter(
            (p): p is typeof p & { template: Types.ObjectId } => p.isActive && !!p.template,
        );

        if (!activePrayers.length) {
            throw new BadRequestError('Activate the obligatory prayers first to unlock this habit.');
        }

        // Existing instances of this exact template for this user, keyed by parent prayer id
        const existingInstances = await UserHabit.find({
            user: userId,
            template: habitId,
        }).select('_id isActive parent connectedPrayer').lean();

        const existingByParent = new Map(
            existingInstances.map(h => [h.parent?.toString(), h]),
        );

        const toReactivate: Types.ObjectId[] = [];
        const toReactivateWithPrayer: { id: Types.ObjectId; prayerTemplateId: Types.ObjectId }[] = [];
        const toCreateForPrayers: typeof activePrayers = [];

        for (const prayer of activePrayers) {
            const existing = existingByParent.get(prayer._id.toString());
            if (!existing) {
                toCreateForPrayers.push(prayer);
            } else if (!existing.isActive) {
                toReactivate.push(existing._id);
                toReactivateWithPrayer.push({ id: existing._id, prayerTemplateId: prayer.template });
            }
            // already active for this prayer → skip silently
        }

        if (!toReactivate.length && !toCreateForPrayers.length) {
            throw new BadRequestError('habit is already activated.');
        }

        // Reactivate soft-deleted instances
        if (toReactivate.length) {
            await UserHabit.updateMany(
                { _id: { $in: toReactivate } },
                { $set: { isActive: true, startDate: new Date() } },
            );

            const existingLogs = await HabitLog.find({
                userHabit: { $in: toReactivate },
                date: String(date),
            }).select('userHabit status').lean();

            const existingLogMap = new Map<string, any>(
                existingLogs.map((l: any) => [l.userHabit?.toString(), l]),
            );

            const logsToInsert: Types.ObjectId[] = [];

            for (const id of toReactivate) {
                const existingLog = existingLogMap.get(id.toString());
                if (!existingLog) {
                    logsToInsert.push(id);
                } else if (existingLog.status === 'Skipped') {
                    await HabitLog.updateOne(
                        { userHabit: id, date: String(date) },
                        { $set: { status: 'Pending', skippedAt: null } },
                    );
                }
            }

            if (logsToInsert.length) {
                await HabitLog.insertMany(
                    logsToInsert.map(id => ({
                        user: userId,
                        userHabit: id,
                        date: String(date),
                        status: 'Pending',
                    })),
                );
            }

            for (const { id, prayerTemplateId } of toReactivateWithPrayer) {
                await connectToParent(userId, prayerTemplateId, id);
            }
        }
        console.log({ toCreateForPrayers })
        // Create a fresh instance for every prayer that doesn't already have one
        let newHabits: any[] = [];
        if (toCreateForPrayers.length) {
            const payloads = toCreateForPrayers.map(() => buildHabitPayload(userId, template));
            const updatedPayloads = payloads.map((p, index) => ({
                ...p,
                parent: toCreateForPrayers[index]._id,
                connectedPrayer: toCreateForPrayers[index].connectedPrayer ?? null,
            }));
            newHabits = await UserHabit.insertMany(updatedPayloads);

            await HabitLog.insertMany(
                newHabits.map(h => ({
                    user: userId,
                    userHabit: h._id,
                    date: String(date),
                    status: 'Pending',
                })),
            );

            for (let i = 0; i < newHabits.length; i++) {
                await connectToParent(userId, toCreateForPrayers[i].template, newHabits[i]._id);
            }
        }

        return {
            added: newHabits.map(h => ({ _id: h._id, name: h.name })),
            reactivated: toReactivate.map(id => ({ _id: id })),
            skipped: null,
        };
    }

    // ── CASE 2: Single activate ──
    const existingHabit = await UserHabit.findOne({
        user: userId,
        template: habitId,
    });

    if (existingHabit) {
        if (existingHabit.isActive) {
            throw new BadRequestError('habit is already activated.');
        }

        // Check Parent active
        if (template.parent) {
            const parentActive = await UserHabit.exists({
                user: userId,
                template: template.parent,
                isActive: true,
            });

            if (!parentActive) {
                throw new BadRequestError(
                    'Activate the required habit first to unlock this habit.',
                );
            }
        }

        existingHabit.isActive = true;
        existingHabit.startDate = new Date();
        await existingHabit.save();

        // Log handle
        const existingLog = await HabitLog.findOne({
            userHabit: existingHabit._id,
            date: String(date),
        });

        if (existingLog) {
            if (existingLog.status === 'Skipped') {
                existingLog.status = 'Pending';
                existingLog.skippedAt = null;
                await existingLog.save();
            }
        } else {
            await HabitLog.create({
                user: userId,
                userHabit: existingHabit._id,
                date: String(date),
                status: 'Pending',
            });
        }

        // reconnect to parent habits
        if (template.parent) {
            await connectToParent(userId, template.parent, existingHabit._id);
        }

        return { added: [{ _id: existingHabit._id, name: existingHabit.name }], skipped: null };
    }

    // No existing habit — create fresh
    if (template.parent) {
        const parentActive = await UserHabit.exists({
            user: userId,
            template: template.parent,
            isActive: true,
        });

        if (!parentActive) {
            throw new BadRequestError(
                'Activate the required habit first to unlock this habit.',
            );
        }
    }

    // Cast to any to satisfy Mongoose create overload typing when payload contains nullable fields
    const newHabit = await UserHabit.create(buildHabitPayload(userId, template) as any);

    await HabitLog.create({
        user: userId,
        userHabit: newHabit._id,
        date: String(date),
        status: 'Pending',
    });

    // Connect to the parent's connectedHabits
    if (template.parent) {
        await connectToParent(userId, template.parent, newHabit._id);
    }

    return { added: [{ _id: newHabit._id, name: newHabit.name }], skipped: null };
};



const STATUS_ORDER: Record<string, number> = {
    Pending: 0,
    Completed: 1,
    Skipped: 2,
};

// get today habits
const getTodayHabits = async (user: IUser, category?: string) => {
    const userId = user._id as Types.ObjectId;
    const dateStr = buildDateBasedOnTimeZone(user.timezone as string);

    const todayDayName = moment(dateStr)
        .format('ddd')
        .toLowerCase() as WeekDay;

    // ── Collect connected habit IDs — they should not show at the top level ──
    const allActiveHabits = await UserHabit.find({
        user: userId,
        isActive: true,
    }).select('_id connectedHabits').lean();

    const connectedHabitIds = new Set(
        allActiveHabits
            .flatMap(h => (h.connectedHabits ?? []).map((c: any) => c.userHabit?.toString()))
            .filter((id): id is string => Boolean(id)),
    );

    const filter: any = {
        user: userId,
        isActive: true,
        _id: { $nin: [...connectedHabitIds] },
    };

    if (category && category.toLowerCase() !== 'all') {
        filter.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    const habits = await UserHabit.find(filter)
        .select('_id name category connectedHabits habitType infoContent adhkarSet quranContent customDetails frequency')
        .populate({
            path: 'connectedHabits.userHabit',
            select: '_id name category adhkarSet quranContent infoContent pdfContent',
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

    // ── Log IDs collect ───────────────────────────────────────

    const allUserHabitIds = todayHabits.map(h => h._id);

    const connectedIds = todayHabits.flatMap(h =>
        (h.connectedHabits ?? [])
            .filter((c: any) => {
                const child = c.userHabit;
                return child?.frequency ? shouldShowToday(child.frequency, child.startDate) : true;
            })
            .map((c: any) => c.userHabit?._id ?? c.userHabit),
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

    const result = todayHabits.map(h => {
        const connectedHabits = (h.connectedHabits ?? [])
            .filter((c: any) => {
                const child = c.userHabit;
                return child?.frequency ? shouldShowToday(child.frequency, child.startDate) : true;
            })
            .filter((c: any) => Boolean(c.userHabit))
            .sort((a: any, b: any) => a.order - b.order)
            .map((c: any) => {
                const child = c.userHabit;
                const childId = child?._id?.toString() ?? c.userHabit?.toString();

                return {
                    _id: child?._id ?? c.userHabit,
                    name: child?.name ?? null,
                    category: child?.category ?? null,
                    habitType: child?.habitType ?? null,
                    infoContent: child?.infoContent ?? null,
                    customDetails: child?.customDetails ?? null,
                    adhkarSet: child?.adhkarSet ?? null,
                    quranContent: child?.quranContent ?? null,
                    frequency: child?.frequency ?? null,
                    startDate: child?.startDate ?? null,
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

        return {
            _id: h._id,
            name: h.name,
            category: h.category,
            habitType: h.habitType,
            infoContent: h.infoContent,
            pdfContent: h.pdfContent,
            customDetails: h.customDetails,
            adhkarSet: h.adhkarSet,
            quranContent: h.quranContent,
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
    console.log({ habitPayload: payload });
    const habit = await UserHabit.findOne({
        _id: userHabitId,
        user: userId,
        isActive: true,
    });
    if (!habit) throw new NotFoundError('Habit not found');

    if (!habit.isPreBuilt) {
        habit.name = payload.name ?? habit.name;
        habit.category = (payload.category as HabitCategory) ?? habit.category;
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

    if (payload.connectedPrayer !== undefined) {


        // check if the connected prayer habit exists for this user
        const connectHabit = await UserHabit.findOne({
            user: userId,
            habitType: HABIT_TYPES.OBLIGATORY_PRAYER,
            connectedPrayer: payload.connectedPrayer,
        });

        if (!connectHabit) {
            throw new NotFoundError('Connected prayer habit not found');
        }

        // Remove this habit from any previously connected prayer parent first.
        await UserHabit.updateMany(
            {
                user: userId,
                habitType: HABIT_TYPES.OBLIGATORY_PRAYER,
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

    if (payload.connectedHabits && payload.connectedHabits.length > 0) {
        if (habit.habitType !== HABIT_TYPES.OBLIGATORY_PRAYER) {
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

            // Set parent template for new additions
            await UserHabit.updateMany(
                { _id: { $in: uniqueNewIds }, user: userId },
                { $set: { parent: habit.template } },
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


// Get Habit Detail
const getHabitDetail = async (user: IUser, userHabitId: string) => {
    const userId = user._id as Types.ObjectId;

    const habit = await UserHabit.findOne({
        _id: userHabitId,
        user: userId,
        isActive: true,
    })
        .populate({
            path: 'connectedHabits.userHabit',
            select: '_id name category habitType isLocked',
        })
        .lean();
    if (!habit) throw new NotFoundError('Habit not found or habit is not active');

    const isObligatoryPrayer = habit.habitType === HABIT_TYPES.OBLIGATORY_PRAYER;

    return {
        _id: habit._id,
        name: habit.name,
        category: habit.category,
        habitType: habit.habitType,
        connectedPrayer: habit.connectedPrayer ?? null,
        isPrayerLocked: habit.isPrayerLocked ?? false,
        location: habit.location ?? null,
        frequency: habit.frequency,
        isPreBuilt: habit.isPreBuilt,
        allowedFrequencies: habit.allowedFrequencies,
        allowedConnectedPrayers: habit.allowConnectedPrayers ?? null,
        reminder: habit.reminder,
        startDate: habit.startDate,
        showOnTodayScreen: habit.showOnTodayScreen,
        isLocked: habit.isLocked,
        customDetails: habit.customDetails ?? null,
        connectedHabits: isObligatoryPrayer
            ? (habit.connectedHabits ?? [])
                .sort((a, b) => a.order - b.order)
                .map((c: any) => ({
                    _id: c.userHabit?._id ?? c.userHabit,
                    name: c.userHabit?.name ?? null,
                    category: c.userHabit?.category ?? null,
                    habitType: c.userHabit?.habitType ?? null,
                    isLocked: c.userHabit?.isLocked ?? false,
                }))
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

    console.log({ payload })

    const newHabit = await UserHabit.create({
        user: userId,
        template: null,
        name: payload.name.trim(),
        category: payload.category,
        isPrayerLocked: false,
        isPreBuilt: false,
        connectedPrayer: payload.connectedPrayer ?? null,
        frequency: payload.frequency,
        allowedFrequencies: [FREQUENCY_TYPES.DAILY, FREQUENCY_TYPES.WEEKLY, FREQUENCY_TYPES.EVERY_N_DAYS],
        reminder: payload.reminder ?? { enabled: false, time: '12:00 AM' },
        startDate: payload.startDate ? new Date(payload.startDate) : new Date(),
        showOnTodayScreen: payload.customDetails ? true : false,
        customDetails: payload.customDetails ?? null,
        parent: null,
        group: null,
        isLocked: false,
        isActive: true,
        infoContent: null,
        adhkarSet: null,
        quranContent: null,
        connectedHabits: [],
    });

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

    // Validate the parent habit
    const parentHabit = await UserHabit.findOne({
        _id: userHabitId,
        user: userId,
        isActive: true,
        habitType: HABIT_TYPES.OBLIGATORY_PRAYER,
    }).select('_id connectedHabits allowConnectedPrayers connectedPrayer').lean();


    if (!parentHabit) throw new NotFoundError('Habit not found or not an obligatory prayer');

    // Already connected ids
    const alreadyConnectedIds = (parentHabit.connectedHabits ?? []).map(
        c => c.userHabit.toString(),
    );

    const filter: any = {
        user: userId,
        isActive: true,
        habitType: { $nin: [HABIT_TYPES.OBLIGATORY_PRAYER, HABIT_TYPES.SUNNAH_PRAYER] },
        allowConnectedPrayers: { $in: [parentHabit.connectedPrayer] },
        _id: { $nin: [userHabitId, ...alreadyConnectedIds] },
    };

    if (searchTerm?.trim()) {
        filter.name = { $regex: new RegExp(searchTerm.trim(), 'i') };
    }

    const habits = await UserHabit.find(filter)
        .select('_id name category habitType')
        .limit(20)
        .lean();

    return habits.map(h => ({
        _id: h._id,
        name: h.name,
        category: h.category,
        habitType: h.habitType,
    }));
};

const deleteCustomHabit = async (user: IUser, habitId: string) => {

    const habit = await UserHabit.findById(habitId);
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
const getDynamicHabitContent = async (user: IUser, contentId: string) => {

    // 1. Check whether the content is Quran data
    const quranData = await QuranContent.findOne({ _id: contentId, isDeleted: false }).lean();

    if (quranData) {
        return quranData;
    }

    // 2. Check whether the content is an Adhkar set before continuing
    const adhkarData = await AdhkarSet.findOne({ _id: contentId, isDeleted: false }).lean();

    if (adhkarData) {
        return adhkarData;
    }

    // 3. Standard error logging fallback for unmatched content queries
    console.log("Mongoose registered collection names:", mongoose.connection.modelNames());

    throw new NotFoundError('Content details not found in either Quran or Adhkar records');
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


*/


/*

const buildHabitPayload = (userId: Types.ObjectId, template: Partial<IHabitTemplate>) => ({
    user: userId,
    template: template._id,
    name: null,
    category: template.category,
    parent: template.parent ?? null,
    connectedPrayer: template.connectedPrayer ?? null,
    allowConnectedPrayers: template.allowConnectedPrayers ?? [],
    location: template.supportsLocation ?? null,
    allowedFrequencies: template.allowedFrequencies ?? [],
    frequency: {
        type: template.defaultFrequency?.type ?? FREQUENCY_TYPES.DAILY,
        selectedDays: template.defaultFrequency?.selectedDays ?? [],
        everyNDays: template.defaultFrequency?.everyNDays ?? undefined,
    },
    reminder: { enabled: false, time: '12:00 AM' },
    startDate: new Date(),
    showOnTodayScreen: true,
    prayerCustomizedAt: template.prayerCustomizedAt ?? null,
    displayOrder: 0,
    isActive: true,
    customDetails: null,
});


// habit connect
const connectToParent = async (
    userId: Types.ObjectId,
    parentTemplateId: Types.ObjectId,
    newUserHabitId: Types.ObjectId,
) => {

    const parentUserHabit = await UserHabit.findOne({
        user: userId,
        template: parentTemplateId,
        isActive: true,
    }).select('_id connectedHabits');


    if (!parentUserHabit) return;

    console.log({ parentUserHabitConnected: parentUserHabit.connectedHabits })
    const alreadyConnected = parentUserHabit.connectedHabits?.some(
        (c: IConnectedHabit) => c.userHabit.toString() === newUserHabitId.toString(),
    );
    if (alreadyConnected) return;
    console.log({ alreadyConnected })
    console.log("asd", parentUserHabit.connectedHabits?.length)
    const maxOrder = parentUserHabit.connectedHabits?.reduce(
        (max: number, c: IConnectedHabit) => Math.max(max, c.order ?? 0),
        0,
    ) ?? 0;

    await UserHabit.updateOne(
        { _id: parentUserHabit._id },
        {
            $push: {
                connectedHabits: {
                    userHabit: newUserHabitId,
                    order: maxOrder + 1,
                },
            },
        },
    );
};


const disconnectFromParents = async (userHabitId: Types.ObjectId) => {
    await UserHabit.updateMany(
        { 'connectedHabits.userHabit': userHabitId },
        { $pull: { connectedHabits: { userHabit: userHabitId } } },
    );
};

// ─────────────────────────────────────────────────────────────
//  TOGGLE HABIT
// ─────────────────────────────────────────────────────────────
const toggleHabit = async (user: IUser, habitId: string, isActive: boolean) => {
    const userId = user._id as Types.ObjectId;
    const date = buildDateBasedOnTimeZone(user.timezone as string);

    // ─────────────────────────────────────────────────────────
    //  DEACTIVATE PATH
    // ─────────────────────────────────────────────────────────
    if (!isActive) {
        const childTemplates = await HabitTemplate.find({
            group: habitId,
            isActive: true,
        }).lean();

        const isGroup = childTemplates.length > 0;

        // ── Group deactivate ──
        if (isGroup) {
            const activeHabits = await UserHabit.find({
                user: userId,
                template: { $in: childTemplates.map(c => c._id) },
                isActive: true,
            }).select('_id').lean();

            if (!activeHabits.length) {
                throw new BadRequestError('No active habits found in this group.');
            }

            const habitIds = activeHabits.map(h => h._id);

            await UserHabit.updateMany(
                { _id: { $in: habitIds } },
                { $set: { isActive: false } },
            );

            await HabitLog.updateMany(
                { userHabit: { $in: habitIds }, date: String(date), status: LOG_STATUS.PENDING },
                { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
            );


            await Promise.all(habitIds.map(id => disconnectFromParents(id)));



            const parentsWithConnected = await UserHabit.find({
                _id: { $in: habitIds },
            }).select('connectedHabits').lean();

            const connectedChildIds = parentsWithConnected
                .flatMap(p => p.connectedHabits?.map((c: IConnectedHabit) => c.userHabit) ?? []);

            if (connectedChildIds.length) {
                await UserHabit.updateMany(
                    { _id: { $in: connectedChildIds }, isActive: true },
                    { $set: { isActive: false } },
                );

                await HabitLog.updateMany(
                    { userHabit: { $in: connectedChildIds }, date: String(date), status: LOG_STATUS.PENDING },
                    { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
                );

                await Promise.all(connectedChildIds.map((id: Types.ObjectId) => disconnectFromParents(id)));
            }

            return null;
        }

        // Need the template to know whether this is a connected-obligatory habit (e.g. Adhkar after prayer)
        const template = await HabitTemplate.findById(habitId).lean();

        // ── Connected-obligatory deactivate (e.g. Adhkar after prayer: deactivate all 5 instances) ──
        if (template?.isConnectedObligatory) {
            const activeInstances = await UserHabit.find({
                user: userId,
                template: habitId,
                isActive: true,
            }).select('_id').lean();

            if (!activeInstances.length) {
                throw new BadRequestError('Habit is already deactivated');
            }

            const instanceIds = activeInstances.map(h => h._id);

            await UserHabit.updateMany(
                { _id: { $in: instanceIds } },
                { $set: { isActive: false, parent: null } },
            );

            await HabitLog.updateMany(
                { userHabit: { $in: instanceIds }, date: String(date), status: LOG_STATUS.PENDING },
                { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
            );

            await Promise.all(instanceIds.map(id => disconnectFromParents(id)));

            return null;
        }

        // ── Single deactivate ──
        const userHabit = await UserHabit.findOne({
            template: habitId,
            user: userId,
            isActive: true,
        });

        if (!userHabit) {
            const customHabit = await UserHabit.findOne({
                _id: habitId,
                user: userId,
                template: null,
            });


            if (!customHabit) {
                throw new BadRequestError('custom habit not found');
            }
            if (!customHabit.isActive) {
                throw new BadRequestError('Habit is already deactivated');
            }
            await HabitLog.findOneAndUpdate(
                { userHabit: customHabit._id, date: String(date), status: LOG_STATUS.PENDING },
                { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
            );
            customHabit.isActive = false;
            await customHabit.save()

            await disconnectFromParents(customHabit._id);

            return null;
        }

        if (userHabit) {
            userHabit.isActive = false;
            userHabit.parent = null;
            await userHabit?.save();

            await HabitLog.findOneAndUpdate(
                { userHabit: userHabit._id, date: String(date), status: 'Pending' },
                { $set: { status: 'Skipped', skippedAt: new Date() } },
            );

            // Disconnect from the parent's connectedHabits
            await disconnectFromParents(userHabit._id);

            return null;
        }

    }

    // ─────────────────────────────────────────────────────────
    //  ACTIVATE PATH
    // ─────────────────────────────────────────────────────────
    const template = await HabitTemplate.findById(habitId).lean();

    if (!template) {
        // check it is custom habit activation with template null
        const userCustomHabit = await UserHabit.findOne({ user: userId, _id: habitId, template: null }).lean();
        if (!userCustomHabit) {
            throw new NotFoundError('Habit template not found');
        }

        if (userCustomHabit.isActive) {
            throw new BadRequestError('Habit is already active');
        }
        const existingLog = await HabitLog.findOne({
            userHabit: userCustomHabit._id,
            date: String(date),
        });

        if (existingLog) {
            if (existingLog.status === 'Skipped') {
                existingLog.status = 'Pending';
                existingLog.skippedAt = null;
                await existingLog.save();
            }
        } else {
            await HabitLog.create({
                user: userId,
                userHabit: userCustomHabit._id,
                date: String(date),
                status: 'Pending',
            });
        }
        await UserHabit.updateOne(
            { _id: userCustomHabit._id },
            { $set: { isActive: true, startDate: new Date() } }
        );

        return { added: [{ _id: userCustomHabit._id, name: userCustomHabit.name }], skipped: null };
    }

    // non custom habit activation with template found but inactive
    if (!template?.isActive) throw new BadRequestError('This habit is no longer available');

    const childTemplates = await HabitTemplate.find({
        group: habitId,
        isActive: true,
    }).lean();

    const isGroup = childTemplates.length > 0;

    // ── CASE 1: Group activate ──
    if (isGroup) {
        const existingHabits = await UserHabit.find({
            user: userId,
            template: { $in: childTemplates.map(c => c._id) },
        }).select('template isActive _id').lean();

        const existingMap = new Map(
            existingHabits.map(h => [h.template?.toString(), h]),
        );

        const toReactivate: Types.ObjectId[] = [];
        const toReactivateWithTemplate: { id: Types.ObjectId; templateId: Types.ObjectId }[] = [];
        const toCreate: typeof childTemplates = [];

        for (const child of childTemplates) {
            const existing = existingMap.get(child._id.toString());
            if (!existing) {
                toCreate.push(child);
            } else if (!existing.isActive) {
                toReactivate.push(existing._id);
                toReactivateWithTemplate.push({
                    id: existing._id,
                    templateId: child._id,
                });
            }
            // already active → skip silently
        }

        if (!toReactivate.length && !toCreate.length) {
            throw new BadRequestError('You have already added all habits from this group.');
        }

        // Reactivate soft-deleted habits
        if (toReactivate.length) {
            await UserHabit.updateMany(
                { _id: { $in: toReactivate } },
                { $set: { isActive: true, startDate: new Date() } },
            );

            // Today log check
            const existingLogs = await HabitLog.find({
                userHabit: { $in: toReactivate },
                date: String(date),
            }).select('userHabit status').lean();

            const existingLogMap = new Map<string, any>(
                existingLogs.map((l: any) => [l.userHabit?.toString(), l]),
            );

            const logsToInsert: Types.ObjectId[] = [];

            for (const id of toReactivate) {
                const existingLog = existingLogMap.get(id.toString());
                if (!existingLog) {
                    logsToInsert.push(id);
                } else if (existingLog.status === 'Skipped') {
                    await HabitLog.updateOne(
                        { userHabit: id, date: String(date) },
                        { $set: { status: 'Pending', skippedAt: null } },
                    );
                }
            }

            if (logsToInsert.length) {
                await HabitLog.insertMany(
                    logsToInsert.map(id => ({
                        user: userId,
                        userHabit: id,
                        date: String(date),
                        status: 'Pending',
                    })),
                );
            }


            const reactivatedTemplates = await HabitTemplate.find({
                _id: { $in: toReactivateWithTemplate.map(r => r.templateId) },
            }).select('_id parent').lean();

            const reactivatedTemplateMap = new Map<string, any>(
                reactivatedTemplates.map((t: any) => [t._id.toString(), t]),
            );

            for (const { id, templateId } of toReactivateWithTemplate) {
                const tmpl = reactivatedTemplateMap.get(templateId.toString());
                if (tmpl?.parent) {
                    await connectToParent(userId, tmpl.parent, id);
                }
            }
        }


        // Brand new habits create (with parent check)
        const skippedNames: string[] = [];
        const canAdd: typeof toCreate = [];

        for (const child of toCreate) {
            if (child.parent) {
                const parentActive = await UserHabit.exists({
                    user: userId,
                    template: child.parent,
                    isActive: true,
                });

                if (!parentActive) {
                    skippedNames.push(child.name);
                    continue;
                }
            }
            canAdd.push(child);
        }

        if (!canAdd.length && !toReactivate.length) {
            throw new BadRequestError(
                `Activate the obligatory prayers first to unlock: ${skippedNames.join(', ')}`,
            );
        }

        let newHabits: any[] = [];
        if (canAdd.length) {

            const payloads = canAdd.map(t => buildHabitPayload(userId, t));
            newHabits = await UserHabit.insertMany(payloads);

            await HabitLog.insertMany(
                newHabits.map(h => ({
                    user: userId,
                    userHabit: h._id,
                    date: String(date),
                    status: 'Pending',
                })),
            );

            for (let i = 0; i < newHabits.length; i++) {
                const tmpl = canAdd[i];
                if (tmpl.parent) {
                    await connectToParent(userId, tmpl.parent, newHabits[i]._id);
                }
            }
        }

        return {
            added: newHabits.map(h => ({ _id: h._id, name: h.name })),
            reactivated: toReactivate.map(id => ({ _id: id })),
            skipped: skippedNames.length
                ? `${skippedNames.join(', ')} skipped — activate the required habits first`
                : null,
        };
    }

    // ── CASE 1.5: Connected-obligatory activate (e.g. Adhkar after prayer → one instance per obligatory prayer) ──
    if (template.isConnectedObligatory) {
        const obligatoryPrayers = await UserHabit.find({
            user: userId,
            connectedPrayer: { $in: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha And Witr'] },
        }).select('_id isActive template connectedPrayer').lean();

        if (!obligatoryPrayers.length) {
            throw new BadRequestError('Activate the obligatory prayers first to unlock this habit.');
        }

        // Only attach to prayers that are currently active
        const activePrayers = obligatoryPrayers.filter(
            (p): p is typeof p & { template: Types.ObjectId } => p.isActive && !!p.template,
        );

        if (!activePrayers.length) {
            throw new BadRequestError('Activate the obligatory prayers first to unlock this habit.');
        }

        // Existing instances of this exact template for this user, keyed by parent prayer id
        const existingInstances = await UserHabit.find({
            user: userId,
            template: habitId,
        }).select('_id isActive parent connectedPrayer').lean();

        const existingByParent = new Map(
            existingInstances.map(h => [h.parent?.toString(), h]),
        );

        const toReactivate: Types.ObjectId[] = [];
        const toReactivateWithPrayer: { id: Types.ObjectId; prayerTemplateId: Types.ObjectId }[] = [];
        const toCreateForPrayers: typeof activePrayers = [];

        for (const prayer of activePrayers) {
            const existing = existingByParent.get(prayer._id.toString());
            if (!existing) {
                toCreateForPrayers.push(prayer);
            } else if (!existing.isActive) {
                toReactivate.push(existing._id);
                toReactivateWithPrayer.push({ id: existing._id, prayerTemplateId: prayer.template });
            }
            // already active for this prayer → skip silently
        }

        if (!toReactivate.length && !toCreateForPrayers.length) {
            throw new BadRequestError('habit is already activated.');
        }

        // Reactivate soft-deleted instances
        if (toReactivate.length) {
            await UserHabit.updateMany(
                { _id: { $in: toReactivate } },
                { $set: { isActive: true, startDate: new Date() } },
            );

            const existingLogs = await HabitLog.find({
                userHabit: { $in: toReactivate },
                date: String(date),
            }).select('userHabit status').lean();

            const existingLogMap = new Map<string, any>(
                existingLogs.map((l: any) => [l.userHabit?.toString(), l]),
            );

            const logsToInsert: Types.ObjectId[] = [];

            for (const id of toReactivate) {
                const existingLog = existingLogMap.get(id.toString());
                if (!existingLog) {
                    logsToInsert.push(id);
                } else if (existingLog.status === 'Skipped') {
                    await HabitLog.updateOne(
                        { userHabit: id, date: String(date) },
                        { $set: { status: 'Pending', skippedAt: null } },
                    );
                }
            }

            if (logsToInsert.length) {
                await HabitLog.insertMany(
                    logsToInsert.map(id => ({
                        user: userId,
                        userHabit: id,
                        date: String(date),
                        status: 'Pending',
                    })),
                );
            }

            for (const { id, prayerTemplateId } of toReactivateWithPrayer) {
                await connectToParent(userId, prayerTemplateId, id);
            }
        }
        console.log({ toCreateForPrayers })
        // Create a fresh instance for every prayer that doesn't already have one
        let newHabits: any[] = [];
        if (toCreateForPrayers.length) {
            const payloads = toCreateForPrayers.map(() => buildHabitPayload(userId, template));
            const updatedPayloads = payloads.map((p, index) => ({
                ...p,
                parent: toCreateForPrayers[index]._id,
                connectedPrayer: toCreateForPrayers[index].connectedPrayer ?? null,
            }));
            newHabits = await UserHabit.insertMany(updatedPayloads);

            await HabitLog.insertMany(
                newHabits.map(h => ({
                    user: userId,
                    userHabit: h._id,
                    date: String(date),
                    status: 'Pending',
                })),
            );

            for (let i = 0; i < newHabits.length; i++) {
                await connectToParent(userId, toCreateForPrayers[i].template, newHabits[i]._id);
            }
        }

        return {
            added: newHabits.map(h => ({ _id: h._id, name: h.name })),
            reactivated: toReactivate.map(id => ({ _id: id })),
            skipped: null,
        };
    }

    // ── CASE 2: Single activate ──
    const existingHabit = await UserHabit.findOne({
        user: userId,
        template: habitId,
    });

    if (existingHabit) {
        if (existingHabit.isActive) {
            throw new BadRequestError('habit is already activated.');
        }

        // Check Parent active
        if (template.parent) {
            const parentActive = await UserHabit.exists({
                user: userId,
                template: template.parent,
                isActive: true,
            });

            if (!parentActive) {
                throw new BadRequestError(
                    'Activate the required habit first to unlock this habit.',
                );
            }
        }

        existingHabit.isActive = true;
        existingHabit.startDate = new Date();
        await existingHabit.save();

        // Log handle
        const existingLog = await HabitLog.findOne({
            userHabit: existingHabit._id,
            date: String(date),
        });

        if (existingLog) {
            if (existingLog.status === 'Skipped') {
                existingLog.status = 'Pending';
                existingLog.skippedAt = null;
                await existingLog.save();
            }
        } else {
            await HabitLog.create({
                user: userId,
                userHabit: existingHabit._id,
                date: String(date),
                status: 'Pending',
            });
        }

        // reconnect to parent habits
        if (template.parent) {
            await connectToParent(userId, template.parent, existingHabit._id);
        }

        return { added: [{ _id: existingHabit._id, name: existingHabit.name }], skipped: null };
    }

    // No existing habit — create fresh
    if (template.parent) {
        const parentActive = await UserHabit.exists({
            user: userId,
            template: template.parent,
            isActive: true,
        });

        if (!parentActive) {
            throw new BadRequestError(
                'Activate the required habit first to unlock this habit.',
            );
        }
    }

    // Cast to any to satisfy Mongoose create overload typing when payload contains nullable fields
    const newHabit = await UserHabit.create(buildHabitPayload(userId, template) as any);

    await HabitLog.create({
        user: userId,
        userHabit: newHabit._id,
        date: String(date),
        status: 'Pending',
    });

    // Connect to the parent's connectedHabits
    if (template.parent) {
        await connectToParent(userId, template.parent, newHabit._id);
    }

    return { added: [{ _id: newHabit._id, name: newHabit.name }], skipped: null };
};


*/