import { Types } from 'mongoose';
import { NotFoundError } from '../../../errors/request/apiError';
import { UserHabit } from '../../user-habit/user.habit.model';
import { USER_ROLE } from '../../user/user.constant';
import { IUser } from '../../user/user.interface';
import { SYSTEM_HABIT_MESSAGES } from './system.habit.constant';
import { HabitTemplate } from './system.habit.model';
import { TCreateHabitTemplate } from './system.habit.zod';
import { deleteImageFromCloudinary } from '../../../cloudinary/deleteImageFromCloudinary';
import { uploadToCloudinary } from '../../../cloudinary/uploadImageToCLoudinary';


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

// create system habit
const createHabitTemplateIntoDB = async (
  payload: TCreateHabitTemplate,
  pdfFile?: Express.Multer.File
) => {

  let groupId = null;
  if (payload.group) {
    const groupExists = await HabitTemplate.findById(payload.group).select('_id');
    groupId = groupExists?._id || null;
  }

  let parentId = null;
  if (payload.parent) {
    const parentExists = await HabitTemplate.findById(payload.parent).select('_id');
    parentId = parentExists?._id || null;
  }

  let pdfUrl: string | null = null;

  if (pdfFile) {
    const uploaded = await uploadToCloudinary(pdfFile, 'habit_pdfs');
    pdfUrl = uploaded.secure_url;
  }

  const newPayload: any = {
    ...payload,
    group: groupId,
    parent: parentId,
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




// update system habit
// const updateSystemHabit = async (id: string, payload: TUpdateSystemHabit) => {
//     const habit = await SystemHabit.findByIdAndUpdate(id, payload, {
//         new: true,
//         runValidators: true,
//     })
//     if (!habit) throw new NotFoundError(SYSTEM_HABIT_MESSAGES.NOT_FOUND)
//     return habit
// }


export const habitTemplateService = {
    createHabitTemplateIntoDB,
    GetAllHabitsWithStatus,
    // updateSystemHabit,
}