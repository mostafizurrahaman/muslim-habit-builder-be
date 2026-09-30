// ─────────────────────────────────────────────────────────────
//  Helpers — DEACTIVATE
// ─────────────────────────────────────────────────────────────

import mongoose, { Types } from "mongoose";
import { ConnectedPrayer, CONNECTED_PRAYERS } from "../../../interfaces";
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
const buildHabitPayload = (
    userId: Types.ObjectId,
    template: Partial<IHabitTemplate>,
    displayOrder = 0,
) => ({
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
    displayOrder,
    isActive: true,
    customDetails: null,
});

export const getNextDisplayOrder = async (
    userId: Types.ObjectId,
    session?: mongoose.ClientSession,
) => {
    const last = await UserHabit.findOne({ user: userId })
        .sort({ displayOrder: -1 })
        .select('displayOrder')
        .session(session ?? null)
        .lean();

    return (last?.displayOrder ?? -1) + 1;
};

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
    }).select('_id connectedHabits connectedPrayer').lean();

    if (!activeHabits.length) {
        throw new BadRequestError('No active habits found in this group.');
    }

    const habitIds = activeHabits.map(h => h._id);

    // Extract connected child IDs to avoid querying the DB twice
    const connectedChildIds = activeHabits.flatMap(
        p => p.connectedHabits?.map((c: IConnectedHabit) => c.userHabit) ?? [],
    );

    const connectedChildren = connectedChildIds.length
        ? await UserHabit.find({ _id: { $in: connectedChildIds } })
            .populate<{ template: IHabitTemplate }>('template', 'isConnectedObligatory name habitType')
            .lean()
        : [];

    const adhkarChildren: typeof connectedChildren = [];
    const nonAdhkarChildIds: Types.ObjectId[] = [];

    for (const child of connectedChildren) {
        if (isAdhkarAfterPrayer(child)) {
            adhkarChildren.push(child);
        } else {
            nonAdhkarChildIds.push(child._id as Types.ObjectId);
        }
    }

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

        // For connected Adhkar habits: DO NOT DEACTIVATE!
        // Instead: detach them from parent, set name to '<Prayer> Adhkar After Prayer', keep active!
        if (adhkarChildren.length) {
            for (const child of adhkarChildren) {
                const cleanName = formatPrayerCleanName(child.connectedPrayer);
                const standaloneName = `${cleanName} Adhkar After Prayer`;
                await UserHabit.updateOne(
                    { _id: child._id },
                    {
                        $set: {
                            parent: null,
                            name: standaloneName,
                            isActive: true,
                            showOnTodayScreen: true,
                            connectedHabits: [],
                        },
                    },
                    { session },
                );
            }

            const adhkarIds = adhkarChildren.map(c => c._id);
            await UserHabit.updateMany(
                { _id: { $in: habitIds } },
                { $pull: { connectedHabits: { userHabit: { $in: adhkarIds } } } },
                { session },
            );
        }

        // Deactivate non-Adhkar connected children if any exist
        if (nonAdhkarChildIds.length) {
            await UserHabit.updateMany(
                { _id: { $in: nonAdhkarChildIds }, isActive: true },
                { $set: { isActive: false } },
                { session },
            );

            await HabitLog.updateMany(
                { userHabit: { $in: nonAdhkarChildIds }, date, status: LOG_STATUS.PENDING },
                { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
                { session },
            );

            await Promise.all(
                nonAdhkarChildIds.map((id: Types.ObjectId) => disconnectFromParents(id, session)),
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
            { $set: { isActive: false, parent: null, connectedHabits: [] } },
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

        // If habit had connected habits, detach any Adhkar habits as standalone
        const connectedChildIds = habit.connectedHabits?.map((c: IConnectedHabit) => c.userHabit) ?? [];
        if (connectedChildIds.length) {
            const connectedChildren = await UserHabit.find({ _id: { $in: connectedChildIds } })
                .populate<{ template: IHabitTemplate }>('template', 'isConnectedObligatory name habitType')
                .session(session)
                .lean();

            for (const child of connectedChildren) {
                if (isAdhkarAfterPrayer(child)) {
                    const cleanName = formatPrayerCleanName(child.connectedPrayer ?? habit.connectedPrayer);
                    await UserHabit.updateOne(
                        { _id: child._id },
                        {
                            $set: {
                                parent: null,
                                name: `${cleanName} Adhkar After Prayer`,
                                isActive: true,
                                showOnTodayScreen: true,
                                connectedHabits: [],
                            },
                        },
                        { session },
                    );
                }
            }
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
        let nextDisplayOrder = await getNextDisplayOrder(userId, session);

        // ── Reactivate soft-deleted habits ──
        if (toReactivate.length) {
            await UserHabit.bulkWrite(
                toReactivate.map(id => ({
                    updateOne: {
                        filter: { _id: id },
                        update: {
                            $set: {
                                isActive: true,
                                startDate: new Date(),
                                displayOrder: nextDisplayOrder++,
                            },
                        },
                    },
                })),
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
            const payloads = toCreate.map(t => buildHabitPayload(userId, t, nextDisplayOrder++));
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

        // Check for any active standalone connected-obligatory habits (e.g. Adhkar after prayer created without prayers)
        // and link them under the activated prayers
        const activePrayersForUser = await UserHabit.find({
            user: userId,
            template: { $in: childTemplates.map(c => c._id) },
            isActive: true,
        })
            .select('_id connectedPrayer template')
            .session(session)
            .lean();

        if (activePrayersForUser.length) {
            const standaloneConnected = await UserHabit.find({
                user: userId,
                isActive: true,
            })
                .populate<{ template: IHabitTemplate }>('template', 'isConnectedObligatory')
                .session(session);

            for (const item of standaloneConnected) {
                if (isAdhkarAfterPrayer(item)) {
                    let prayerKey = item.connectedPrayer ? item.connectedPrayer.trim().toLowerCase() : null;
                    if (!prayerKey && item.name) {
                        for (const p of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
                            if (item.name.toLowerCase().includes(p)) {
                                prayerKey = p;
                                break;
                            }
                        }
                    }

                    const matchingPrayer = activePrayersForUser.find(p =>
                        isSamePrayer(p.connectedPrayer, prayerKey ?? item.connectedPrayer),
                    );
                    if (matchingPrayer) {
                        await UserHabit.updateOne(
                            { _id: item._id },
                            {
                                $set: {
                                    parent: matchingPrayer._id,
                                    name: 'Adhkar After Prayer',
                                    connectedPrayer: matchingPrayer.connectedPrayer ?? item.connectedPrayer,
                                    connectedHabits: [],
                                },
                            },
                            { session },
                        );
                        await connectHabitToParentById(matchingPrayer._id, item._id, session);
                    }
                }
            }
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

export const isSamePrayer = (a: string | null | undefined, b: string | null | undefined): boolean => {
    if (!a || !b) return false;
    const cleanA = a.trim().toLowerCase();
    const cleanB = b.trim().toLowerCase();
    if (cleanA === cleanB) return true;
    const isIshaA = cleanA === 'isha' || cleanA === 'isha and witr';
    const isIshaB = cleanB === 'isha' || cleanB === 'isha and witr';
    return isIshaA && isIshaB;
};

export const formatPrayerCleanName = (prayer: string | null | undefined): string => {
    if (!prayer) return '';
    const clean = prayer.trim();
    const lower = clean.toLowerCase();
    if (lower === 'isha and witr' || lower === 'isha') return 'Isha';
    if (lower === 'fajr') return 'Fajr';
    if (lower === 'dhuhr') return 'Dhuhr';
    if (lower === 'asr') return 'Asr';
    if (lower === 'maghrib') return 'Maghrib';
    return clean.charAt(0).toUpperCase() + clean.slice(1);
};

export const isAdhkarAfterPrayer = (h: any): boolean => {
    if (!h) return false;
    if (h.isConnectedObligatory) return true;
    const template = h.template as any;
    if (template?.isConnectedObligatory) return true;
    const templateName = template?.name?.toLowerCase() ?? '';
    if (templateName.includes('adhkar after prayer') || templateName.includes('adhkar after salah')) return true;
    const name = (h.name ?? '').toLowerCase();
    if (name.includes('adhkar after prayer') || name.includes('adhkar after salah')) return true;
    return false;
};

export const ADHKAR_PRAYER_CONFIG: { cleanName: string; prayer: ConnectedPrayer }[] = [
    { cleanName: 'Fajr', prayer: CONNECTED_PRAYERS.FAJR },
    { cleanName: 'Dhuhr', prayer: CONNECTED_PRAYERS.DHUHR },
    { cleanName: 'Asr', prayer: CONNECTED_PRAYERS.ASR },
    { cleanName: 'Maghrib', prayer: CONNECTED_PRAYERS.MAGHRIB },
    { cleanName: 'Isha', prayer: CONNECTED_PRAYERS.ISHA },
];

/**
 * Activates a "connected obligatory" habit (e.g. Adhkar after prayer).
 *
 * Case 1: The user has active obligatory prayers:
 *   Creates or reactivates one instance per active obligatory prayer,
 *   nested under that prayer via `parent` and `connectedHabits`, with name "Adhkar After Prayer".
 *
 * Case 2: The user does NOT have active obligatory prayers:
 *   Creates or reactivates 5 standalone habits with prayer prefix:
 *   - Fajr Adhkar After Prayer
 *   - Dhuhr Adhkar After Prayer
 *   - Asr Adhkar After Prayer
 *   - Maghrib Adhkar After Prayer
 *   - Isha Adhkar After Prayer
 *   Each with parent: null so they appear individually in the Today list.
 *
 * Handles mixed states seamlessly (active prayers get nested instance, inactive get standalone instance).
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
        .select('_id connectedPrayer')
        .lean();

    const obligatoryPrayerTemplateIds = obligatoryPrayerTemplates.map(t => t._id);

    // 2. Fetch user's obligatory prayers
    const obligatoryPrayers = await UserHabit.find({
        user: userId,
        template: { $in: obligatoryPrayerTemplateIds },
    })
        .select('_id isActive template connectedPrayer displayOrder')
        .lean();

    // Filter active prayers with required fields
    const activePrayers = obligatoryPrayers.filter(
        (p): p is typeof p & { template: Types.ObjectId; connectedPrayer: ConnectedPrayer } =>
            p.isActive && !!p.template && !!p.connectedPrayer,
    );

    // 3. Fetch existing habit instances matching this template or name
    const existingInstances = await UserHabit.find({
        user: userId,
        $or: [
            { template: habitId },
            { name: { $regex: /adhkar after (prayer|salah)/i } },
        ],
    })
        .select('_id isActive connectedPrayer name parent displayOrder')
        .lean();

    // Check if all 5 are already active in their expected state
    let allAlreadyActive = true;
    for (const config of ADHKAR_PRAYER_CONFIG) {
        const matchingPrayer = activePrayers.find(p => isSamePrayer(p.connectedPrayer, config.prayer));
        const expectedParent = matchingPrayer?._id?.toString() ?? null;
        const expectedName = matchingPrayer ? 'Adhkar After Prayer' : `${config.cleanName} Adhkar After Prayer`;

        const existing = existingInstances.find(h =>
            isSamePrayer(h.connectedPrayer, config.prayer) ||
            (h.name && h.name.toLowerCase().includes(config.cleanName.toLowerCase()))
        );

        if (!existing || !existing.isActive) {
            allAlreadyActive = false;
            break;
        }
        const currentParent = existing.parent?.toString() ?? null;
        if (currentParent !== expectedParent || existing.name !== expectedName) {
            allAlreadyActive = false;
            break;
        }
    }

    if (allAlreadyActive && existingInstances.length >= 5) {
        throw new BadRequestError('Habit is already activated.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    let newHabits: any[] = [];
    const reactivatedIds: Types.ObjectId[] = [];

    try {
        let nextDisplayOrder = await getNextDisplayOrder(userId, session);

        for (const config of ADHKAR_PRAYER_CONFIG) {
            const matchingPrayer = activePrayers.find(p => isSamePrayer(p.connectedPrayer, config.prayer));
            const targetParent = matchingPrayer?._id ?? null;
            const targetName = matchingPrayer ? 'Adhkar After Prayer' : `${config.cleanName} Adhkar After Prayer`;
            const targetOrder = targetParent
                ? (matchingPrayer?.displayOrder ?? nextDisplayOrder++)
                : nextDisplayOrder++;

            const existing = existingInstances.find(h =>
                isSamePrayer(h.connectedPrayer, config.prayer) ||
                (h.name && h.name.toLowerCase().includes(config.cleanName.toLowerCase()))
            );

            if (existing) {
                // Update / reactivate existing instance
                await UserHabit.updateOne(
                    { _id: existing._id },
                    {
                        $set: {
                            isActive: true,
                            startDate: new Date(),
                            parent: targetParent,
                            name: targetName,
                            connectedPrayer: config.prayer,
                            displayOrder: targetOrder,
                            showOnTodayScreen: true,
                            adhkarSet: template.adhkarSet ?? null,
                            habitType: template.habitType ?? HABIT_TYPES.ADHKAR,
                            connectedHabits: [],
                        },
                    },
                    { session },
                );

                reactivatedIds.push(existing._id as Types.ObjectId);

                if (targetParent) {
                    await connectHabitToParentById(targetParent, existing._id as Types.ObjectId, session);
                } else {
                    // Remove from any parent connectedHabits if it was previously attached
                    await UserHabit.updateMany(
                        { 'connectedHabits.userHabit': existing._id },
                        { $pull: { connectedHabits: { userHabit: existing._id } } },
                        { session },
                    );
                }

                // Handle daily HabitLog
                const existingLog = await HabitLog.findOne({
                    userHabit: existing._id,
                    date,
                }).session(session);

                if (!existingLog) {
                    await HabitLog.create(
                        [{ user: userId, userHabit: existing._id, date, status: LOG_STATUS.PENDING }],
                        { session },
                    );
                } else if (existingLog.status === LOG_STATUS.SKIPPED) {
                    await HabitLog.updateOne(
                        { _id: existingLog._id },
                        { $set: { status: LOG_STATUS.PENDING, skippedAt: null } },
                        { session },
                    );
                }
            } else {
                // Create brand new instance
                const payload = {
                    ...buildHabitPayload(userId, template, targetOrder),
                    name: targetName,
                    parent: targetParent,
                    connectedPrayer: config.prayer,
                    isActive: true,
                    showOnTodayScreen: true,
                    adhkarSet: template.adhkarSet ?? null,
                    habitType: template.habitType ?? HABIT_TYPES.ADHKAR,
                    connectedHabits: [],
                };

                const [created] = await UserHabit.create([payload], { session });
                newHabits.push(created);

                if (targetParent) {
                    await connectHabitToParentById(targetParent, created._id as Types.ObjectId, session);
                }

                await HabitLog.create(
                    [{ user: userId, userHabit: created._id, date, status: LOG_STATUS.PENDING }],
                    { session },
                );
            }
        }

        await session.commitTransaction();

        return {
            added: newHabits.map(h => ({ _id: h._id, name: h.name })),
            reactivated: reactivatedIds.map(id => ({ _id: id })),
            skipped: null,
        };
    } catch (error: any) {
        await session.abortTransaction();
        if (error instanceof BadRequestError) throw error;
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
        const displayOrder = await getNextDisplayOrder(userId, session);

        if (existingHabit) {
            // Reactivate soft-deleted instance
            existingHabit.isActive = true;
            existingHabit.startDate = new Date();
            existingHabit.displayOrder = displayOrder;
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
                [buildHabitPayload(userId, template, displayOrder)],
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

        // If this habit is an obligatory prayer, link any active Adhkar habits under it
        const prayerName = habitToActivate.connectedPrayer ?? template.connectedPrayer;
        if (template.habitType === HABIT_TYPES.OBLIGATORY_PRAYER || prayerName) {
            const connectedObligatory = await UserHabit.find({
                user: userId,
                isActive: true,
            })
                .populate<{ template: IHabitTemplate }>('template', 'isConnectedObligatory')
                .session(session);

            for (const item of connectedObligatory) {
                if (isAdhkarAfterPrayer(item)) {
                    let itemPrayer = item.connectedPrayer ? item.connectedPrayer.trim().toLowerCase() : null;
                    if (!itemPrayer && item.name) {
                        for (const p of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
                            if (item.name.toLowerCase().includes(p)) {
                                itemPrayer = p;
                                break;
                            }
                        }
                    }

                    if (isSamePrayer(itemPrayer ?? item.connectedPrayer, prayerName)) {
                        await UserHabit.updateOne(
                            { _id: item._id },
                            {
                                $set: {
                                    parent: habitToActivate._id,
                                    name: 'Adhkar After Prayer',
                                    connectedPrayer: prayerName,
                                },
                            },
                            { session },
                        );
                        await connectHabitToParentById(habitToActivate._id, item._id, session);
                    }
                }
            }
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
        const displayOrder = await getNextDisplayOrder(userId, session);

        await UserHabit.updateOne(
            { _id: userCustomHabit._id },
            { $set: { isActive: true, startDate: new Date(), displayOrder } },
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

export const connectHabitToParentById = async (
    parentHabitId: Types.ObjectId,
    childHabitId: Types.ObjectId,
    session?: mongoose.ClientSession,
) => {
    if (parentHabitId.toString() === childHabitId.toString()) return;

    const parentHabit = await UserHabit.findById(parentHabitId)
        .select('_id connectedHabits name category habitType template')
        .populate({ path: 'template', select: 'name category isConnectedObligatory habitType' })
        .session(session ?? null);

    if (!parentHabit) return;
    if (isAdhkarAfterPrayer(parentHabit)) return;

    const alreadyConnected = parentHabit.connectedHabits?.some(
        (c: IConnectedHabit) => c.userHabit.toString() === childHabitId.toString(),
    );
    if (alreadyConnected) return;

    const maxOrder = parentHabit.connectedHabits?.reduce(
        (max: number, c: IConnectedHabit) => Math.max(max, c.order ?? 0),
        0,
    ) ?? 0;

    await UserHabit.updateOne(
        { _id: parentHabit._id },
        {
            $push: {
                connectedHabits: {
                    userHabit: childHabitId,
                    order: maxOrder + 1,
                },
            },
        },
        { session },
    );
};

export const connectToParent = async (
    userId: Types.ObjectId,
    parentTemplateId: Types.ObjectId,
    newUserHabitId: Types.ObjectId,
    session?: mongoose.ClientSession,
) => {
    const parentUserHabit = await UserHabit.findOne({
        user: userId,
        template: parentTemplateId,
        isActive: true,
    })
        .select('_id connectedHabits name category habitType template')
        .populate({ path: 'template', select: 'name category isConnectedObligatory habitType' })
        .session(session ?? null);

    if (!parentUserHabit) return;
    if (parentUserHabit._id.toString() === newUserHabitId.toString()) return;
    if (isAdhkarAfterPrayer(parentUserHabit)) return;

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
        { session },
    );
};

// ─────────────────────────────────────────────────────────────
//  disconnect from Parent
// ─────────────────────────────────────────────────────────────
export const disconnectFromParents = async (userHabitId: Types.ObjectId, session?: mongoose.ClientSession) => {
    await UserHabit.updateMany(
        { 'connectedHabits.userHabit': userHabitId },
        { $pull: { connectedHabits: { userHabit: userHabitId } } },
        { session }
    );
    await UserHabit.updateOne(
        { _id: userHabitId },
        { $set: { parent: null } },
        { session }
    );
};

export const isObligatoryPrayer = (h: any): boolean => {
    if (!h) return false;
    if (isAdhkarAfterPrayer(h)) return false;
    const template = h.template as any;
    if (template?.habitType === HABIT_TYPES.OBLIGATORY_PRAYER) return true;
    if (h.habitType === HABIT_TYPES.OBLIGATORY_PRAYER) return true;
    const name = (h.name ?? template?.name ?? '').toLowerCase();
    const isPrayerCategory = (h.category ?? template?.category)?.toLowerCase() === 'prayer';
    const isObligatoryName = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].some(n => name.includes(n));
    return isPrayerCategory && isObligatoryName;
};

export const selfHealActiveHabits = async (
    userId: Types.ObjectId,
    allHabits: any[],
): Promise<Set<string>> => {
    const parentHabitsMap = new Map<string, any>();
    const activePrayersMap = new Map<string, any>();

    for (const h of allHabits) {
        if (!h.parent && isObligatoryPrayer(h)) {
            parentHabitsMap.set(h._id.toString(), h);
            if (h.connectedPrayer) {
                const prayerKey = h.connectedPrayer.trim().toLowerCase();
                activePrayersMap.set(prayerKey, h);
                if (prayerKey === 'isha and witr') {
                    activePrayersMap.set('isha', h);
                } else if (prayerKey === 'isha') {
                    activePrayersMap.set('isha and witr', h);
                }
            }
        }
    }

    const repairs: { parentId: Types.ObjectId; childId: Types.ObjectId }[] = [];
    const parentUpdates: { childId: Types.ObjectId; parentId: Types.ObjectId | null; name?: string; connectedPrayer?: string }[] = [];
    const nestedHabitIds = new Set<string>();

    for (const h of allHabits) {
        if (isAdhkarAfterPrayer(h)) {
            // Adhkar habits must NEVER have connectedHabits
            if (h.connectedHabits && h.connectedHabits.length > 0) {
                h.connectedHabits = [];
                await UserHabit.updateOne(
                    { _id: h._id },
                    { $set: { connectedHabits: [] } },
                );
            }

            let prayerKey = h.connectedPrayer ? h.connectedPrayer.trim().toLowerCase() : null;
            if (!prayerKey && h.name) {
                for (const p of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
                    if (h.name.toLowerCase().includes(p)) {
                        prayerKey = p;
                        break;
                    }
                }
            }

            const cleanPrayer = formatPrayerCleanName(prayerKey ?? h.connectedPrayer);
            const matchingPrayer = prayerKey ? activePrayersMap.get(prayerKey) : null;

            // Clear invalid self-parenting
            if (h.parent && h.parent.toString() === h._id.toString()) {
                h.parent = null;
            }

            if (matchingPrayer && matchingPrayer._id.toString() !== h._id.toString()) {
                // Obligatory prayer is active -> must be nested under prayer with name 'Adhkar After Prayer'
                const expectedName = 'Adhkar After Prayer';
                if (h.parent?.toString() !== matchingPrayer._id.toString() || h.name !== expectedName) {
                    parentUpdates.push({
                        childId: h._id as Types.ObjectId,
                        parentId: matchingPrayer._id as Types.ObjectId,
                        name: expectedName,
                        connectedPrayer: matchingPrayer.connectedPrayer ?? cleanPrayer,
                    });
                    h.parent = matchingPrayer._id;
                    h.name = expectedName;
                }

                const inConnected = matchingPrayer.connectedHabits?.some(
                    (c: any) => (c.userHabit?._id?.toString() ?? c.userHabit?.toString()) === h._id.toString(),
                );
                if (!inConnected) {
                    repairs.push({ parentId: matchingPrayer._id as Types.ObjectId, childId: h._id as Types.ObjectId });
                }

                nestedHabitIds.add(h._id.toString());
            } else {
                // Obligatory prayer is NOT active -> must be standalone with name '<Prayer> Adhkar After Prayer'
                const expectedName = `${cleanPrayer} Adhkar After Prayer`;
                if (h.parent !== null || h.name !== expectedName) {
                    parentUpdates.push({
                        childId: h._id as Types.ObjectId,
                        parentId: null,
                        name: expectedName,
                        connectedPrayer: cleanPrayer,
                    });
                    h.parent = null;
                    h.name = expectedName;
                }
                // Do NOT add to nestedHabitIds so it appears in Today list as top-level item
            }
        } else if (h.parent) {
            if (h.parent.toString() === h._id.toString()) {
                h.parent = null;
                parentUpdates.push({ childId: h._id as Types.ObjectId, parentId: null });
            } else {
                const parentHabit = parentHabitsMap.get(h.parent.toString());
                if (parentHabit) {
                    const inConnected = parentHabit.connectedHabits?.some(
                        (c: any) => (c.userHabit?._id?.toString() ?? c.userHabit?.toString()) === h._id.toString(),
                    );
                    if (!inConnected) {
                        repairs.push({ parentId: h.parent as Types.ObjectId, childId: h._id as Types.ObjectId });
                    }
                    nestedHabitIds.add(h._id.toString());
                } else {
                    // Parent is no longer active
                    parentUpdates.push({ childId: h._id as Types.ObjectId, parentId: null });
                    h.parent = null;
                }
            }
        }

        if (!isAdhkarAfterPrayer(h)) {
            for (const c of h.connectedHabits ?? []) {
                const id = c.userHabit?._id?.toString() ?? c.userHabit?.toString();
                if (id && id !== h._id.toString()) nestedHabitIds.add(id);
            }
        }
    }

    for (const r of repairs) {
        nestedHabitIds.add(r.childId.toString());
    }

    if (parentUpdates.length > 0) {
        await Promise.all(
            parentUpdates.map(({ childId, parentId, name, connectedPrayer }) => {
                const update: any = { parent: parentId };
                if (name) update.name = name;
                if (connectedPrayer) update.connectedPrayer = connectedPrayer;
                return UserHabit.updateOne({ _id: childId }, { $set: update });
            }),
        );
    }

    if (repairs.length > 0) {
        for (const { parentId, childId } of repairs) {
            await UserHabit.updateOne(
                { _id: parentId, 'connectedHabits.userHabit': { $ne: childId } },
                { $push: { connectedHabits: { userHabit: childId, order: 1 } } },
            );
        }
    }

    return nestedHabitIds;
};


