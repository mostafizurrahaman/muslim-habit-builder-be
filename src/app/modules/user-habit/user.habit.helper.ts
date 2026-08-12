// ─────────────────────────────────────────────────────────────
//  Helpers — DEACTIVATE
// ─────────────────────────────────────────────────────────────

import mongoose, { Types } from "mongoose";
import { BadRequestError, InternalServerError, NotFoundError } from "../../errors/request/apiError";
import { HABIT_TYPES } from "../dashboard/habit-template/system.habit.constant";
import { IHabitTemplate } from "../dashboard/habit-template/system.habit.interface";
import { HabitTemplate } from "../dashboard/habit-template/system.habit.model";
import { LOG_STATUS } from "../habit-logger/habit.logger.constant";
import { HabitLog } from "../habit-logger/habit.logger.model";
import { FREQUENCY_TYPES } from "./user.habit.constant";
import { IConnectedHabit } from "./user.habit.interface";
import { UserHabit } from "./user.habit.model";



/**
  * builds a new UserHabit payload based on a HabitTemplate, for creating
 */
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

/**
 * Deactivates every active habit in a group (e.g. "Prayers" group containing
 * Fajr, Zuhr, Asr...), plus any habit connected under them (e.g. Adhkar
 * instances attached to those prayers via connectedHabits).
 */

// export const deactivateGroupHabit = async (
//     userId: Types.ObjectId,
//     childTemplateIds: Types.ObjectId[],
//     date: string,
// ) => {
//     const activeHabits = await UserHabit.find({
//         user: userId,
//         template: { $in: childTemplateIds },
//         isActive: true,
//     }).select('_id').lean();

//     if (!activeHabits.length) {
//         throw new BadRequestError('No active habits found in this group.');
//     }

//     const habitIds = activeHabits.map(h => h._id);

//     await UserHabit.updateMany(
//         { _id: { $in: habitIds } },
//         { $set: { isActive: false } },
//     );

//     await HabitLog.updateMany(
//         { userHabit: { $in: habitIds }, date, status: LOG_STATUS.PENDING },
//         { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
//     );

//     // Disconnect each deactivated habit from wherever it was connected as a child
//     await Promise.all(habitIds.map(id => disconnectFromParents(id)));

//     // Also deactivate anything that was connected under these habits
//     // (e.g. Adhkar instances attached to the prayers we just turned off)
//     const parentsWithConnected = await UserHabit.find({
//         _id: { $in: habitIds },
//     }).select('connectedHabits').lean();

//     const connectedChildIds = parentsWithConnected.flatMap(
//         p => p.connectedHabits?.map((c: IConnectedHabit) => c.userHabit) ?? [],
//     );

//     if (connectedChildIds.length) {
//         await UserHabit.updateMany(
//             { _id: { $in: connectedChildIds }, isActive: true },
//             { $set: { isActive: false } },
//         );

//         await HabitLog.updateMany(
//             { userHabit: { $in: connectedChildIds }, date, status: LOG_STATUS.PENDING },
//             { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
//         );

//         await Promise.all(connectedChildIds.map((id: Types.ObjectId) => disconnectFromParents(id)));
//     }
// };


export const deactivateGroupHabit = async (
    userId: Types.ObjectId,
    childTemplateIds: Types.ObjectId[],
    date: string,
) => {
    // 1. Fetch active habits outside the transaction
    const activeHabits = await UserHabit.find({
        user: userId,
        template: { $in: childTemplateIds },
        isActive: true,
    }).select('_id connectedHabits').lean();

    if (!activeHabits.length) {
        throw new BadRequestError('No active habits found in this group.');
    }

    const habitIds = activeHabits.map(h => h._id);

    // Extract connected child IDs to avoid querying the DB twice
    const connectedChildIds = activeHabits.flatMap(
        p => p.connectedHabits?.map((c: IConnectedHabit) => c.userHabit) ?? [],
    );

    // 2. Start DB Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Deactivate primary group habits
        await UserHabit.updateMany(
            { _id: { $in: habitIds } },
            { $set: { isActive: false } },
            { session },
        );

        await HabitLog.updateMany(
            { userHabit: { $in: habitIds }, date, status: LOG_STATUS.PENDING },
            { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
            { session },
        );

        // Disconnect parents for primary habits
        await Promise.all(
            habitIds.map(id => disconnectFromParents(id, session)),
        );

        // Deactivate connected children if any exist
        if (connectedChildIds.length) {
            await UserHabit.updateMany(
                { _id: { $in: connectedChildIds }, isActive: true },
                { $set: { isActive: false } },
                { session },
            );

            await HabitLog.updateMany(
                { userHabit: { $in: connectedChildIds }, date, status: LOG_STATUS.PENDING },
                { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
                { session },
            );

            await Promise.all(
                connectedChildIds.map((id: Types.ObjectId) => disconnectFromParents(id, session)),
            );
        }

        // Commit all modifications
        await session.commitTransaction();
    } catch (error: any) {
        await session.abortTransaction();

        if (error instanceof BadRequestError) {
            throw error;
        }

        console.error('Error during group habit deactivation:', error);
        throw new InternalServerError('Failed to deactivate group habits. Please try again later.');
    } finally {
        await session.endSession();
    }
};

/**
 * Deactivates a "connected obligatory" habit (e.g. Adhkar after prayer) —
 * every instance under every prayer gets turned off together.
 */
export const deactivateConnectedObligatoryHabit = async (
    userId: Types.ObjectId,
    habitId: string,
    date: string,
) => {
    // 1. Fetch target instances outside transaction
    const activeInstances = await UserHabit.find({
        user: userId,
        template: habitId,
        isActive: true,
    })
        .select('_id')
        .lean();

    if (!activeInstances.length) {
        throw new BadRequestError('Habit is already deactivated');
    }

    const instanceIds = activeInstances.map(h => h._id);

    // 2. Start Mongoose session right before database writes
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Note: `parent` is cleared here. Reactivation must NOT rely on `parent`
        // to find these instances again — it's matched by `connectedPrayer`
        // instead (see activateConnectedObligatoryHabit), which is never cleared.
        await UserHabit.updateMany(
            { _id: { $in: instanceIds } },
            { $set: { isActive: false, parent: null } },
            { session },
        );

        await HabitLog.updateMany(
            { userHabit: { $in: instanceIds }, date, status: LOG_STATUS.PENDING },
            { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
            { session },
        );

        // Pass session context to nested operations
        await Promise.all(
            instanceIds.map(id => disconnectFromParents(id, session)),
        );

        // Commit all changes atomically
        await session.commitTransaction();
    } catch (error: any) {
        await session.abortTransaction();

        // Preserve application/business errors
        if (error instanceof BadRequestError) {
            throw error;
        }

        console.error('Error deactivating connected obligatory habit:', error);
        throw new InternalServerError('Failed to deactivate habit. Please try again later.');
    } finally {
        // Always close the session to prevent memory/connection leaks
        await session.endSession();
    }
};

/**
 * Deactivates a single, non-grouped habit — either a template-based habit
 * or a custom (template: null) habit.
 */
export const deactivateSingleHabit = async (
    userId: Types.ObjectId,
    habitId: string,
    date: string,
) => {
    // 1. Fetch target habit (Template-based or Custom)
    let habit = await UserHabit.findOne({
        template: habitId,
        user: userId,
        isActive: true,
    }).populate<{ template: IHabitTemplate }>('template', 'connectedPrayer isPrayerLocked connectedPrayer defaultFrequency allowedFrequencies');

    if (!habit) {
        habit = await UserHabit.findOne({
            _id: habitId,
            user: userId,
            template: null,
        });
    }

    // 2. Early Guard Clauses
    if (!habit || !habit.isActive) {
        throw new BadRequestError('Habit not found or already deactivated');
    }

    // 3. Start DB Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Update pending logs for the given date
        await HabitLog.findOneAndUpdate(
            { userHabit: habit._id, date, status: LOG_STATUS.PENDING },
            { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
            { session }
        );

        // Disconnect parent dependencies
        if (habit.parent || habit.template) {
            await disconnectFromParents(habit._id, session);
        }

        // Update habit status and relations
        habit.isActive = false;
        habit.parent = null;
        habit.frequency = habit.template?.defaultFrequency ?? habit.frequency;
        habit.allowedFrequencies = habit.template?.allowedFrequencies ?? habit.allowedFrequencies;

        if (habit.template && !habit.template.isPrayerLocked) {
            habit.connectedPrayer = null;
        }

        await habit.save({ session });

        // Commit all changes
        await session.commitTransaction();
    } catch (error: any) {
        await session.abortTransaction();

        // Preserve custom application errors (e.g., BadRequestError)
        if (error instanceof BadRequestError) {
            throw error;
        }

        console.error('Error during habit deactivation:', error);
        throw new InternalServerError('Failed to deactivate habit. Please try again later.');
    } finally {
        // Safely release session connection
        await session.endSession();
    }
};

// ─────────────────────────────────────────────────────────────
//  Helpers — ACTIVATE
// ─────────────────────────────────────────────────────────────

/**
 * Activates every habit in a group, creating new UserHabit instances for
 * ones the user has never had, and reactivating soft-deleted ones.
 */
export const activateGroupHabit = async (
    userId: Types.ObjectId,
    childTemplates: any[],
    date: string,
) => {
    // 1. Fetch existing user habits for these templates outside transaction
    const existingHabits = await UserHabit.find({
        user: userId,
        template: { $in: childTemplates.map(c => c._id) },
    })
        .select('template isActive _id')
        .lean();

    const existingMap = new Map(existingHabits.map(h => [h.template?.toString(), h]));

    // 2. Batch-check parent status for both reactivate and create cases
    const parentTemplateIds = [
        ...new Set(childTemplates.filter(c => c.parent).map(c => c.parent.toString())),
    ];

    const activeParents = parentTemplateIds.length
        ? await UserHabit.find({
              user: userId,
              template: { $in: parentTemplateIds },
              isActive: true,
          })
              .select('template')
              .lean()
        : [];

    const activeParentTemplateIds = new Set(activeParents.map(p => p.template?.toString()));
    const isParentActive = (child: any) =>
        !child.parent || activeParentTemplateIds.has(child.parent.toString());

    const toReactivate: Types.ObjectId[] = [];
    const toReactivateWithTemplate: { id: Types.ObjectId; templateId: Types.ObjectId }[] = [];
    const toCreate: typeof childTemplates = [];
    const skippedNames: string[] = [];

    for (const child of childTemplates) {
        const existing = existingMap.get(child._id.toString());

        if (!existing) {
            if (!isParentActive(child)) {
                skippedNames.push(child.name);
                continue;
            }
            toCreate.push(child);
        } else if (!existing.isActive) {
            if (!isParentActive(child)) {
                skippedNames.push(child.name);
                continue;
            }
            toReactivate.push(existing._id);
            toReactivateWithTemplate.push({ id: existing._id, templateId: child._id });
        }
        // Already active → skip silently
    }

    if (!toReactivate.length && !toCreate.length) {
        if (skippedNames.length) {
            throw new BadRequestError(
                `Activate the obligatory prayers first to unlock: ${skippedNames.join(', ')}`,
            );
        }
        throw new BadRequestError('You have already added all habits from this group.');
    }

    // 3. Start DB Transaction right before write operations
    const session = await mongoose.startSession();
    session.startTransaction();

    let newHabits: any[] = [];

    try {
        // ── Reactivate soft-deleted habits ──
        if (toReactivate.length) {
            await UserHabit.updateMany(
                { _id: { $in: toReactivate } },
                { $set: { isActive: true, startDate: new Date() } },
                { session },
            );

            const existingLogs = await HabitLog.find({
                userHabit: { $in: toReactivate },
                date,
            })
                .select('userHabit status')
                .session(session)
                .lean();

            const existingLogMap = new Map<string, any>(
                existingLogs.map((l: any) => [l.userHabit?.toString(), l]),
            );

            const logsToInsert: Types.ObjectId[] = [];
            const logsToUnskip: Types.ObjectId[] = [];

            for (const id of toReactivate) {
                const existingLog = existingLogMap.get(id.toString());
                if (!existingLog) {
                    logsToInsert.push(id);
                } else if (existingLog.status === LOG_STATUS.SKIPPED) {
                    logsToUnskip.push(id);
                }
            }

            if (logsToInsert.length) {
                await HabitLog.insertMany(
                    logsToInsert.map(id => ({
                        user: userId,
                        userHabit: id,
                        date,
                        status: LOG_STATUS.PENDING,
                    })),
                    { session },
                );
            }

            if (logsToUnskip.length) {
                await HabitLog.updateMany(
                    { userHabit: { $in: logsToUnskip }, date },
                    { $set: { status: LOG_STATUS.PENDING, skippedAt: null } },
                    { session },
                );
            }

            const reactivatedTemplates = await HabitTemplate.find({
                _id: { $in: toReactivateWithTemplate.map(r => r.templateId) },
            })
                .select('_id parent')
                .session(session)
                .lean();

            const reactivatedTemplateMap = new Map<string, any>(
                reactivatedTemplates.map((t: any) => [t._id.toString(), t]),
            );

            await Promise.all(
                toReactivateWithTemplate.map(({ id, templateId }) => {
                    const tmpl = reactivatedTemplateMap.get(templateId.toString());
                    return tmpl?.parent
                        ? connectToParent(userId, tmpl.parent, id, session)
                        : Promise.resolve();
                }),
            );
        }

        // ── Create brand-new habits ──
        if (toCreate.length) {
            const payloads = toCreate.map(t => buildHabitPayload(userId, t));
            newHabits = await UserHabit.insertMany(payloads, { session });

            await HabitLog.insertMany(
                newHabits.map(h => ({
                    user: userId,
                    userHabit: h._id,
                    date,
                    status: LOG_STATUS.PENDING,
                })),
                { session },
            );

            await Promise.all(
                newHabits.map((h, i) => {
                    const tmpl = toCreate[i];
                    return tmpl.parent
                        ? connectToParent(userId, tmpl.parent, h._id, session)
                        : Promise.resolve();
                }),
            );
        }

        // Commit all changes
        await session.commitTransaction();

        return {
            added: newHabits.map(h => ({ _id: h._id })),
            reactivated: toReactivate.map(id => ({ _id: id })),
            skipped: skippedNames.length
                ? `${skippedNames.join(', ')} skipped — activate the required habits first`
                : null,
        };
    } catch (error: any) {
        await session.abortTransaction();

        if (error instanceof BadRequestError) {
            throw error;
        }

        console.error('Error during group habit activation:', error);
        throw new InternalServerError('Failed to activate group habits. Please try again later.');
    } finally {
        await session.endSession();
    }
};

/**
 * Activates a "connected obligatory" habit (e.g. Adhkar after prayer) — one
 * instance is created/reactivated per active obligatory prayer.
 *
 * IMPORTANT: instances are matched to their prayer by `connectedPrayer`
 * (e.g. "Fajr"), NOT by `parent`. `parent` gets cleared to null on
 * deactivate (see deactivateConnectedObligatoryHabit), so matching on it
 * here would treat every previously-deactivated instance as "not found"
 * and create a duplicate on every activate/deactivate cycle.
 */
export const activateConnectedObligatoryHabit = async (
    userId: Types.ObjectId,
    template: any,
    habitId: string,
    date: string,
) => {
    // 1. Fetch obligatory prayer templates
    const obligatoryPrayerTemplates = await HabitTemplate.find({
        habitType: HABIT_TYPES.OBLIGATORY_PRAYER,
        isActive: true,
    })
        .select('_id')
        .lean();

    const obligatoryPrayerTemplateIds = obligatoryPrayerTemplates.map(t => t._id);

    // 2. Fetch user's obligatory prayers
    const obligatoryPrayers = await UserHabit.find({
        user: userId,
        template: { $in: obligatoryPrayerTemplateIds },
    })
        .select('_id isActive template connectedPrayer')
        .lean();

    // Filter active prayers with required fields
    const activePrayers = obligatoryPrayers.filter(
        (p): p is typeof p & { template: Types.ObjectId; connectedPrayer: string } =>
            p.isActive && !!p.template && !!p.connectedPrayer,
    );

    if (!activePrayers.length) {
        throw new BadRequestError(
            'Activate the obligatory prayers (Five daily Prayers) first to unlock this habit.',
        );
    }

    // 3. Fetch existing habit instances matching this template
    const existingInstances = await UserHabit.find({
        user: userId,
        template: habitId,
    })
        .select('_id isActive connectedPrayer')
        .lean();

    const existingByPrayer = new Map(existingInstances.map(h => [h.connectedPrayer, h]));

    const toReactivate: {
        id: Types.ObjectId;
        prayerUserHabitId: Types.ObjectId;
        prayerTemplateId: Types.ObjectId;
    }[] = [];
    const toCreateForPrayers: typeof activePrayers = [];

    for (const prayer of activePrayers) {
        const existing = existingByPrayer.get(prayer.connectedPrayer);
        if (!existing) {
            toCreateForPrayers.push(prayer);
        } else if (!existing.isActive) {
            toReactivate.push({
                id: existing._id,
                prayerUserHabitId: prayer._id,
                prayerTemplateId: prayer.template,
            });
        }
    }

    if (!toReactivate.length && !toCreateForPrayers.length) {
        throw new BadRequestError('Habit is already activated.');
    }

    // 4. Start Session & Transaction for writes
    const session = await mongoose.startSession();
    session.startTransaction();

    let newHabits: any[] = [];

    try {
        // ── Reactivate soft-deleted instances ──
        if (toReactivate.length) {
            await UserHabit.bulkWrite(
                toReactivate.map(({ id, prayerUserHabitId }) => ({
                    updateOne: {
                        filter: { _id: id },
                        update: {
                            $set: {
                                isActive: true,
                                startDate: new Date(),
                                parent: prayerUserHabitId,
                            },
                        },
                    },
                })),
                { session },
            );

            const reactivatedIds = toReactivate.map(r => r.id);

            const existingLogs = await HabitLog.find({
                userHabit: { $in: reactivatedIds },
                date,
            })
                .select('userHabit status')
                .session(session)
                .lean();

            const existingLogMap = new Map<string, any>(
                existingLogs.map((l: any) => [l.userHabit?.toString(), l]),
            );

            const logsToInsert: Types.ObjectId[] = [];
            const logsToUnskip: Types.ObjectId[] = [];

            for (const id of reactivatedIds) {
                const existingLog = existingLogMap.get(id.toString());
                if (!existingLog) {
                    logsToInsert.push(id);
                } else if (existingLog.status === LOG_STATUS.SKIPPED) {
                    logsToUnskip.push(id);
                }
            }

            if (logsToInsert.length) {
                await HabitLog.insertMany(
                    logsToInsert.map(id => ({
                        user: userId,
                        userHabit: id,
                        date,
                        status: LOG_STATUS.PENDING,
                    })),
                    { session },
                );
            }

            if (logsToUnskip.length) {
                await HabitLog.updateMany(
                    { userHabit: { $in: logsToUnskip }, date },
                    { $set: { status: LOG_STATUS.PENDING, skippedAt: null } },
                    { session },
                );
            }

            await Promise.all(
                toReactivate.map(({ id, prayerTemplateId }) =>
                    connectToParent(userId, prayerTemplateId, id, session),
                ),
            );
        }

        // ── Create fresh instances for missing prayers ──
        if (toCreateForPrayers.length) {
            const payloads = toCreateForPrayers.map(prayer => ({
                ...buildHabitPayload(userId, template),
                parent: prayer._id,
                connectedPrayer: prayer.connectedPrayer,
            }));

            newHabits = await UserHabit.insertMany(payloads, { session });

            await HabitLog.insertMany(
                newHabits.map(h => ({
                    user: userId,
                    userHabit: h._id,
                    date,
                    status: LOG_STATUS.PENDING,
                })),
                { session },
            );

            await Promise.all(
                newHabits.map((h, i) =>
                    connectToParent(userId, toCreateForPrayers[i].template, h._id, session),
                ),
            );
        }

        // Commit all changes
        await session.commitTransaction();

        return {
            added: newHabits.map(h => ({ _id: h._id, name: h.name })),
            reactivated: toReactivate.map(r => ({ _id: r.id })),
            skipped: null,
        };
    } catch (error: any) {
        await session.abortTransaction();

        if (error instanceof BadRequestError) {
            throw error;
        }

        console.error('Error activating connected obligatory habit:', error);
        throw new InternalServerError('Failed to activate habit. Please try again later.');
    } finally {
        await session.endSession();
    }
};

/**
 * Activates a single, non-grouped, non-connected-obligatory template-based
 * habit — reactivating the user's existing instance if one exists, or
 * creating a fresh one otherwise.
 */
export const activateSingleHabit = async (
    userId: Types.ObjectId,
    template: any,
    habitId: string,
    date: string,
) => {
    // 1. Fetch existing habit record
    const existingHabit = await UserHabit.findOne({ user: userId, template: habitId });

    if (existingHabit?.isActive) {
        throw new BadRequestError('Habit is already activated.');
    }

    // 2. Parent habit dependency guard check
    if (template.parent) {
        const parentActive = await UserHabit.exists({
            user: userId,
            template: template.parent,
            isActive: true,
        });

        if (!parentActive) {
            throw new BadRequestError('Activate the required habit first to unlock this habit.');
        }
    }

    // 3. Start DB Transaction before writes
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let habitToActivate: any;

        if (existingHabit) {
            // Reactivate soft-deleted instance
            existingHabit.isActive = true;
            existingHabit.startDate = new Date();
            await existingHabit.save({ session });

            const existingLog = await HabitLog.findOne({
                userHabit: existingHabit._id,
                date,
            }).session(session);

            if (existingLog) {
                if (existingLog.status === LOG_STATUS.SKIPPED) {
                    existingLog.status = LOG_STATUS.PENDING;
                    existingLog.skippedAt = null;
                    await existingLog.save({ session });
                }
            } else {
                await HabitLog.create(
                    [{ user: userId, userHabit: existingHabit._id, date, status: LOG_STATUS.PENDING }],
                    { session },
                );
            }

            habitToActivate = existingHabit;
        } else {
            // Create fresh habit instance
            const [newHabit] = await UserHabit.create(
                [buildHabitPayload(userId, template)],
                { session },
            );

            await HabitLog.create(
                [{ user: userId, userHabit: newHabit._id, date, status: LOG_STATUS.PENDING }],
                { session },
            );

            habitToActivate = newHabit;
        }

        // Link habit to parent dependency if applicable
        if (template.parent) {
            await connectToParent(userId, template.parent, habitToActivate._id, session);
        }

        // Commit all operations atomically
        await session.commitTransaction();

        return {
            added: [{ _id: habitToActivate._id, name: habitToActivate.name }],
            skipped: null,
        };
    } catch (error: any) {
        await session.abortTransaction();

        if (error instanceof BadRequestError) {
            throw error;
        }

        console.error('Error during single habit activation:', error);
        throw new InternalServerError('Failed to activate habit. Please try again later.');
    } finally {
        await session.endSession();
    }
};

/**
 * Activates a custom habit (template: null) — these are always single
 * instances the user created themselves.
 */
export const activateCustomHabit = async (
    userId: Types.ObjectId,
    habitId: string,
    date: string,
) => {
    // 1. Fetch custom habit record outside the transaction
    const userCustomHabit = await UserHabit.findOne({
        user: userId,
        _id: habitId,
        template: null,
    }).lean();

    // 2. Early Guard Clauses
    if (!userCustomHabit) {
        throw new NotFoundError('Habit not found');
    }
    if (userCustomHabit.isActive) {
        throw new BadRequestError('Habit is already active');
    }

    // 3. Start DB Session & Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Activate custom habit
        await UserHabit.updateOne(
            { _id: userCustomHabit._id },
            { $set: { isActive: true, startDate: new Date() } },
            { session },
        );

        // Manage daily habit log
        const existingLog = await HabitLog.findOne({
            userHabit: userCustomHabit._id,
            date,
        }).session(session);

        if (existingLog) {
            if (existingLog.status === LOG_STATUS.SKIPPED) {
                await HabitLog.updateOne(
                    { _id: existingLog._id },
                    { $set: { status: LOG_STATUS.PENDING, skippedAt: null } },
                    { session },
                );
            }
        } else {
            await HabitLog.create(
                [{ user: userId, userHabit: userCustomHabit._id, date, status: LOG_STATUS.PENDING }],
                { session },
            );
        }

        // Commit all changes atomically
        await session.commitTransaction();

        return {
            added: [{ _id: userCustomHabit._id, name: userCustomHabit.name }],
            skipped: null,
        };
    } catch (error: any) {
        await session.abortTransaction();

        if (error instanceof NotFoundError || error instanceof BadRequestError) {
            throw error;
        }

        console.error('Error activating custom habit:', error);
        throw new InternalServerError('Failed to activate habit. Please try again later.');
    } finally {
        await session.endSession();
    }
};

// ─────────────────────────────────────────────────────────────
//  Connect to Parent
// ─────────────────────────────────────────────────────────────

export const connectToParent = async (
    userId: Types.ObjectId,
    parentTemplateId: Types.ObjectId,
    newUserHabitId: Types.ObjectId,
    session?: mongoose.ClientSession
) => {

    const parentUserHabit = await UserHabit.findOne({
        user: userId,
        template: parentTemplateId,
        isActive: true,
    }).select('_id connectedHabits');


    if (!parentUserHabit) return;


    const alreadyConnected = parentUserHabit.connectedHabits?.some(
        (c: IConnectedHabit) => c.userHabit.toString() === newUserHabitId.toString(),
    );
    if (alreadyConnected) return;
 
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
        { session }
    );
};

// ─────────────────────────────────────────────────────────────
//  disconnect from Parent
// ─────────────────────────────────────────────────────────────
export const disconnectFromParents = async (userHabitId: Types.ObjectId, session?: mongoose.ClientSession) => {
    await UserHabit.updateMany(
        { 'connectedHabits.userHabit': userHabitId },
        { $set: { parent: null }, $pull: { connectedHabits: { userHabit: userHabitId } } },
        { session }
    );
};

