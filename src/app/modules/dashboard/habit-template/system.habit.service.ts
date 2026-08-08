import { Types } from 'mongoose';
import { deleteImageFromCloudinary } from '../../../cloudinary/deleteImageFromCloudinary';
import { uploadToCloudinary } from '../../../cloudinary/uploadImageToCLoudinary';
import { BadRequestError, NotFoundError } from '../../../errors/request/apiError';
import { UserHabit } from '../../user-habit/user.habit.model';
import { USER_ROLE } from '../../user/user.constant';
import { IUser } from '../../user/user.interface';
import { HABIT_STATUS, HABIT_TYPES, SYSTEM_HABIT_MESSAGES } from './system.habit.constant';
import { HabitTemplate } from './system.habit.model';
import { TCreateHabitTemplate, TUpdateHabitTemplate } from './system.habit.zod';
import { HABIT_TYPE } from '../../../../shared/constants/habit.shared.types';
import { HABIT_CATEGORIES } from '../../../../interfaces';
import { validateHabitTemplateRules } from './system.habit.utils';
import { EffectiveHabitTemplateFields } from './system.habit.interface';


// get all system habits with status for user
const GetAllHabitsWithStatus = async (user: IUser, category?: string) => {
    const userId = user._id as Types.ObjectId;

    const templateFilter: any = { isActive: true, status: HABIT_STATUS.PUBLISHED };
    if (category && category.toLowerCase() !== 'all') {
        templateFilter.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    const topLevelTemplates = await HabitTemplate.find({
        ...templateFilter,
        $or: [{ group: null }, { group: { $exists: false } }],
    }).lean();

    console.log({ topLevelTemplates })
    const topLevelIds = topLevelTemplates.map(t => t._id);

    const allChildren = await HabitTemplate.find({
        group: { $in: topLevelIds },
        isActive: true,
        status: HABIT_STATUS.PUBLISHED
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

    // A template can now have multiple UserHabit instances for the same user
    // (e.g. "Adhkar after prayer" → one instance per obligatory prayer), so
    // group by template instead of overwriting with a single Map entry.
    const userHabitsByTemplate = new Map<string, typeof userHabits>();
    for (const h of userHabits) {
        const key = h.template?.toString();
        if (!key) continue;
        if (!userHabitsByTemplate.has(key)) userHabitsByTemplate.set(key, []);
        userHabitsByTemplate.get(key)!.push(h);
    }

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
                const habitsForChild = userHabitsByTemplate.get(childId.toString()) ?? [];
                return habitsForChild.some(h => h.isActive);
            });
        } else {
            const habitsForTemplate = userHabitsByTemplate.get(templateId) ?? [];
            isUserActive = habitsForTemplate.some(h => h.isActive);
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

// create system habit
const createHabitTemplateIntoDB = async (
    payload: TCreateHabitTemplate,
    pdfFile?: Express.Multer.File,
) => {
    await validateHabitTemplateRules({
        name: payload.name,
        group: payload.group,
        parent: payload.parent,
        connectedPrayer: payload.connectedPrayer,
        isPrayerLocked: payload.isPrayerLocked,
        allowConnectedPrayers: payload.allowConnectedPrayers,
        isConnectedObligatory: payload.isConnectedObligatory,
        isLocked: payload.isLocked,
        isGuestLocked: payload.isGuestLocked,
        category: payload.category,
        habitType: payload.habitType,
        quranContent: payload.quranContent,
        adhkarSet: payload.adhkarSet,
        level: payload.level
    });
 
    let pdfUrl: string | null = null;
 
    if (pdfFile) {
        const uploaded = await uploadToCloudinary(pdfFile, 'habit_pdfs');
        pdfUrl = uploaded.secure_url;
    }
 
    const newPayload: any = {
        ...payload,
        group: payload.group || null,
        parent: payload.parent || null,
        pdfContent: pdfUrl,
    };
 
    try {
        const newTemplate = await HabitTemplate.create(newPayload);
 
        if (!newTemplate) {
            throw new NotFoundError(SYSTEM_HABIT_MESSAGES.CREATION_FAILED);
        }
 
        return {
            name: newTemplate.name,
            category: newTemplate.category,
            habitType: newTemplate.habitType,
            supportsLocation: newTemplate.supportsLocation,
            defaultFrequency: newTemplate.defaultFrequency,
            group: newTemplate.group,
            parent: newTemplate.parent,
            pdfContent: newTemplate.pdfContent,
        };
    } catch (error) {
        // DB create fail hole cloudinary theke pdf delete kore dao (rollback)
        if (pdfUrl) {
            await deleteImageFromCloudinary(pdfUrl); // resource_type: 'raw' pass korte hobe function er vitor
        }
        throw error;
    }
};

// get all system habits with status
const getAllHabits = async (query: Record<string, unknown>) => {
    const { page = 1, limit = 10, searchTerm, status, category, level } = query;

    const matchStage: any = {};

    // Status filter
    if (status) matchStage.status = status;
    if (category) matchStage.category = category;
    if (level) matchStage.level = level;

    // Search Term logic add kora hoyeche
    if (searchTerm) {
        matchStage.$or = [
            { name: { $regex: searchTerm, $options: 'i' } },
        ];
    }

    const result = await HabitTemplate.aggregate([
        { $match: matchStage },
        {
            $facet: {
                data: [
                    { $sort: { createdAt: -1 } },
                    { $skip: (Number(page) - 1) * Number(limit) },
                    { $limit: Number(limit) },
                    {
                        $project: {
                            name: 1,
                            category: 1,
                            level: 1,
                            habitType: 1,
                            status: 1,
                            isGuestLocked: 1,
                            createdAt: 1
                        },
                    },
                ],
                total: [{ $count: 'count' }],
            },
        },
    ]);

    const users = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;

    const data = users.map((user: any) => ({
        ...user,
    }));

    return {
        meta: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
        },
        data,
    };
}

// get habit template by id
const getHabitTemplateById = async (id: string) => {
    const habitTemplate = await HabitTemplate.findById(id);
    if (!habitTemplate) throw new NotFoundError(SYSTEM_HABIT_MESSAGES.NOT_FOUND);
    return habitTemplate;
}

// update draft habit to publish
const updateDraftHabitToPublish = async (id: string) => {
    const habit = await HabitTemplate.updateOne({ _id: id }, { status: HABIT_STATUS.PUBLISHED });
    if (habit.modifiedCount === 0) throw new NotFoundError(SYSTEM_HABIT_MESSAGES.NOT_FOUND);
    return null;
}

// get group habits
const getGroupHabits = async () => {
    const groupHabits = await HabitTemplate.find({ isGroup: true }).select('_id name').lean();
    return groupHabits;
}

// get parent habits
const getParentHabits = async () => {
    const parentHabits = await HabitTemplate.find({ isParent: true }).select('_id name').lean();
    return parentHabits;
}


const updateSystemHabit = async (
    id: string,
    payload: TUpdateHabitTemplate,
    pdfFile?: Express.Multer.File,
) => {
    const habit = await HabitTemplate.findById(id);
    if (!habit) throw new NotFoundError(SYSTEM_HABIT_MESSAGES.NOT_FOUND);


    const { status, isActive, ...safePayload } = payload as any;

    const effective: EffectiveHabitTemplateFields = {
        name: safePayload.name !== undefined ? safePayload.name : habit.name,
        group: safePayload.group !== undefined ? safePayload.group : habit.group,
        parent: safePayload.parent !== undefined ? safePayload.parent : habit.parent,
        isGuestLocked: safePayload.isGuestLocked !== undefined ? safePayload.isGuestLocked : habit.isGuestLocked,
        connectedPrayer: safePayload.connectedPrayer !== undefined ? safePayload.connectedPrayer : habit.connectedPrayer,
        isPrayerLocked: safePayload.isPrayerLocked !== undefined ? safePayload.isPrayerLocked : habit.isPrayerLocked,
        allowConnectedPrayers:
            safePayload.allowConnectedPrayers !== undefined ? safePayload.allowConnectedPrayers : habit.allowConnectedPrayers,
        isConnectedObligatory:
            safePayload.isConnectedObligatory !== undefined ? safePayload.isConnectedObligatory : habit.isConnectedObligatory,
        isLocked: safePayload.isLocked !== undefined ? safePayload.isLocked : habit.isLocked,
        category: safePayload.category !== undefined ? safePayload.category : habit.category,
        habitType: safePayload.habitType !== undefined ? safePayload.habitType : habit.habitType,
        quranContent: safePayload.quranContent !== undefined ? safePayload.quranContent : habit.quranContent,
        adhkarSet: safePayload.adhkarSet !== undefined ? safePayload.adhkarSet : habit.adhkarSet,
        level: safePayload.level !== undefined ? safePayload.level : habit.level,
    };
 
    await validateHabitTemplateRules(effective);
 
    // If admin is changing allowConnectedPrayers, stamp prayerCustomizedAt so
    // users with a customized connectedPrayer get re-validated against the
    // new list (see getHabitDetail).
    const allowConnectedPrayersChanged =
        safePayload.allowConnectedPrayers !== undefined &&
        JSON.stringify([...safePayload.allowConnectedPrayers].sort()) !==
            JSON.stringify([...(habit.allowConnectedPrayers ?? [])].sort());
 
    let pdfUrl: string | null = null;
 
    if (pdfFile) {
        const uploaded = await uploadToCloudinary(pdfFile, 'habit_pdfs');
        pdfUrl = uploaded.secure_url;
    }
 
    const updatedPayload: any = {
        ...safePayload,
        pdfContent: pdfUrl || habit.pdfContent, // If new PDF is uploaded, use its URL; otherwise, keep the existing one
        ...(allowConnectedPrayersChanged && { prayerCustomizedAt: new Date() }),
    };
 
    try {
        const updatedHabit = await HabitTemplate.findByIdAndUpdate(id, updatedPayload, { new: true });
        if (!updatedHabit) throw new NotFoundError(SYSTEM_HABIT_MESSAGES.NOT_FOUND);
 
        if (pdfUrl && habit.pdfContent) {
            // Delete the old PDF from Cloudinary if a new one is uploaded
            await deleteImageFromCloudinary(habit.pdfContent);
        }
 
        return null;
    } catch (error) {
        // DB update fail hole notun upload kora pdf (jodi thake) cloudinary theke delete kore dao (rollback)
        if (pdfUrl) {
            await deleteImageFromCloudinary(pdfUrl);
        }
        throw error;
    }
};

const deleteSystemHabit = async (id: string) => {
    const habit = await HabitTemplate.findById(id);
    if (!habit) throw new NotFoundError(SYSTEM_HABIT_MESSAGES.NOT_FOUND);
    if (habit.status === HABIT_STATUS.PUBLISHED) throw new BadRequestError('published habit can not be deleted');
 
    await HabitTemplate.findByIdAndDelete(id);
    if (habit.pdfContent) {
        await deleteImageFromCloudinary(habit.pdfContent);
    }
};

export const habitTemplateService = {
    createHabitTemplateIntoDB,
    GetAllHabitsWithStatus,
    getGroupHabits,
    getHabitTemplateById,
    updateDraftHabitToPublish,
    getParentHabits,
    getAllHabits,
    updateSystemHabit,
    deleteSystemHabit
}