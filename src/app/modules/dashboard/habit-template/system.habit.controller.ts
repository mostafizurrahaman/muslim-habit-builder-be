import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import asyncHandler from "../../../../shared/asynchandler";
import sendResponse from "../../../../shared/sendResponse";
import { habitTemplateService } from "./system.habit.service";
import { TCreateHabitTemplate } from "./system.habit.zod";


const createHabitTemplate = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const pdfFile = files?.pdf?.[0];

    const payload = req.body as TCreateHabitTemplate;

    const result = await habitTemplateService.createHabitTemplateIntoDB(payload, pdfFile);

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Habit template has been created successfully",
        data: result,
    });
});

const getSystemHabitsForUsers = asyncHandler(async (req: Request, res: Response) => {
    const result = await habitTemplateService.GetAllHabitsWithStatus(req.user, req.query.category as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Habit templates fetched successfully',
        data: result,
    });
});

const getAllHabitsForAdmin = asyncHandler(async (req: Request, res: Response) => {
    const result = await habitTemplateService.getAllHabits(req.query);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Habit templates fetched successfully',
        meta: result.meta,
        data: result.data,
    });
});

const updateDraftHabitToPublish = asyncHandler(async (req: Request, res: Response) => {
    const result = await habitTemplateService.updateDraftHabitToPublish(req.params.id as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Habit template has been published successfully',
        data: result,
    });
});

const getHabitDetailsById = asyncHandler(async (req: Request, res: Response) => {
    const result = await habitTemplateService.getHabitTemplateById(req.params.id as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Habit template fetched successfully',
        data: result,
    });
});

const deleteHabitTemplate = asyncHandler(async (req: Request, res: Response) => {
    const result = await habitTemplateService.deleteSystemHabit(req.params.id as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Habit template deleted successfully',
        data: result,
    });
});

const getGroupHabits = asyncHandler(async (req: Request, res: Response) => {
    const result = await habitTemplateService.getGroupHabits();
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Group habits fetched successfully',
        data: result,
    });
});

const updateTemplateHabit = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const pdfFile = files?.pdf?.[0];

    const result = await habitTemplateService.updateSystemHabit(req.params.id as string, req.body, pdfFile);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Habit template updated successfully',
        data: result,
    });
});

const getParentHabits = asyncHandler(async (req: Request, res: Response) => {
    const result = await habitTemplateService.getParentHabits();
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Parent habits fetched successfully',
        data: result,
    });
});


export const habitTemplateController = {
    createHabitTemplate,
    getSystemHabitsForUsers,
    getAllHabitsForAdmin,
    getGroupHabits,
    getParentHabits,
    getHabitDetailsById,
    updateDraftHabitToPublish,
    updateTemplateHabit,
    deleteHabitTemplate,
};


/*
const GetAllHabitsWithStatus = async (user: IUser, category?: string) => {
    const userId = user._id as Types.ObjectId;

    const templateFilter: any = { isActive: true };
    if (category) templateFilter.category = category;

    // Fetch only top-level templates, not group children
    const topLevelTemplates = await HabitTemplate.find({
        ...templateFilter,
        group: null,
    }).lean();

    // Fetch all UserHabits for the user
    const userHabits = await UserHabit.find({ user: userId })
        .select('template isActive _id')
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

        // If this is a group, check whether its children are active
        let isUserActive = false;

        if (t.isGroup) {
            const childUserHabits = await UserHabit.exists({
                user: userId,
                group: t._id,
                isActive: true,
            });
            isUserActive = !!childUserHabits;
        } else {
            const userHabit = userHabitMap.get(templateId);
            isUserActive = userHabit?.isActive ?? false;
        }

        if (isUserActive) activeCount++;
        totalCount++;

        const habitEntry = {
            _id: t._id,
            name: t.name,
            isUserActive,
        };

        const level = (t.level ?? 'beginner').toLowerCase();
        buckets[level in buckets ? level : 'custom'].push(habitEntry);
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