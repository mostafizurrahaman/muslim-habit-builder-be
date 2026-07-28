import { Request, Response } from "express";

import { StatusCodes } from "http-status-codes";
import asyncHandler from "../../../../shared/asynchandler";
import sendResponse from "../../../../shared/sendResponse";
import { analyticService } from "./analytics.service";




const getHabitAnalyticsIntoDb = asyncHandler(async (req: Request, res: Response) => {
    const result = await analyticService.getHabitAnalytics(req.query);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: result.data.length > 0 ? 'Recent users data has been retrieved successfully' : 'No recent users found',
        meta: result.meta,
        data: result.data,
    });
});


export const analyticsController = {
    getHabitAnalyticsIntoDb
}