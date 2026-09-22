import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import asyncHandler from "../../../shared/asynchandler";
import sendResponse from "../../../shared/sendResponse";
import { habitProgressService } from "./habit.progress.service";




const getOverviewProgressAndAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const result = await habitProgressService.getCombinedProgressAndAnalytics(req.user, req.query as { year: string; month: string; category?: string; analyticsView?: string });
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: null,
        data: result,
    })
})

const getIndividualHabitAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { habitId } = req.params;
    const result = await habitProgressService.getIndividualHabitAnalytics(req.user, habitId as string, req.query as { year?: string; month?: string });

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: null,
        data: result,
    })
}
)

const restartProgressIntoDb = asyncHandler(async (req: Request, res: Response) => {
    const { habitId } = req.params;
    const result = await habitProgressService.restartProgress(req.user, habitId as string);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: null,
        data: result,
    })
}
)

export const habitProgressController = {
    getOverviewProgressAndAnalytics,
    getIndividualHabitAnalytics,
    restartProgressIntoDb
}
