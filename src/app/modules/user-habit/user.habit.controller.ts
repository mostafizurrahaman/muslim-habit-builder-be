import { Request, Response } from "express"
import { StatusCodes } from "http-status-codes"
import asyncHandler from "../../../shared/asynchandler"
import sendResponse from "../../../shared/sendResponse"
import { USER_HABIT_MESSAGES } from "./user.habit.constant"
import { userHabitService } from "./user.habit.service"


// add habit
const addHabitInYourHabitListIntoDb = asyncHandler(async (req: Request, res: Response) => {
  const { habitId } = req.params;
  const { isActive } = req.body
  const result = await userHabitService.toggleHabit(req.user, habitId as string, isActive)

  sendResponse(res, {
    statusCode: isActive ? StatusCodes.CREATED : StatusCodes.OK,
    success: true,
    message: isActive ? USER_HABIT_MESSAGES.ACTIVATED : USER_HABIT_MESSAGES.DEACTIVATED,
    data: result,
  })
})

// get today habit
const getTodayHabits = asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.query;
  const result = await userHabitService.getTodayHabits(req.user, category as string)

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: USER_HABIT_MESSAGES.FETCHED,
    data: result,
  })
})


// get habit detail
const getHabitDetail = asyncHandler(async (req: Request, res: Response) => {
  const { habitId } = req.params;
  const result = await userHabitService.getHabitDetail(req.user, habitId as string)
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: USER_HABIT_MESSAGES.FETCHED,
    data: result,
  })
})


// update habit 
const updateHabitIntodb = asyncHandler(async (req: Request, res: Response) => {

  const { habitId } = req.params;

  const payload = req.body;

  const result = await userHabitService.updateUserHabit(req.user, habitId as string, payload);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: USER_HABIT_MESSAGES.UPDATED,
    data: result,
  })
})

// add custom habit
const addCustomHabitIntoDb = asyncHandler(async (req: Request, res: Response) => {
  const result = await userHabitService.addCustomHabit(req.user, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: USER_HABIT_MESSAGES.CREATED,
    data: result,
  });
})

// search habit
const searchHabitsToConnect = asyncHandler(async (req: Request, res: Response) => {
  const { habitId } = req.params;
  const result = await userHabitService.searchHabitsToConnect(req.user, habitId as string, req.query.searchTerm as string);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: USER_HABIT_MESSAGES.FETCHED,
    data: result,
  })
})

// delete habit
const deleteCustomHabitFromDb = asyncHandler(async (req: Request, res: Response) => {
  const { habitId } = req.params;
  const result = await userHabitService.deleteCustomHabit(req.user, habitId as string);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: USER_HABIT_MESSAGES.DELETED,
    data: result,
  });
})

// completed habit

const completeHabitIntoDb = asyncHandler(async (req: Request, res: Response) => {
  const { habitId } = req.params;
  const result = await userHabitService.completedHabit(req.user, habitId as string);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: USER_HABIT_MESSAGES.COMPLETED,
    data: result,
  });
});

const skipHabitIntoDb = asyncHandler(async (req: Request, res: Response) => {
  const { habitId } = req.params;
  const result = await userHabitService.skippedHabit(req.user, habitId as string);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: USER_HABIT_MESSAGES.SKIPPED,
    data: result,
  });
});


const fetchDynamicContentIntoDb = asyncHandler(async (req: Request, res: Response) => {

  const { habitId } = req.params;
  const result = await userHabitService.getDynamicHabitContent(req.user, habitId as string);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: USER_HABIT_MESSAGES.CONTENT_FETCHED,
    data: result,
  });
});


export const userHabitController = {
  addHabitInYourHabitListIntoDb,
  getTodayHabits,
  getHabitDetail,
  updateHabitIntodb,
  addCustomHabitIntoDb,
  searchHabitsToConnect,
  completeHabitIntoDb,
  deleteCustomHabitFromDb,
  skipHabitIntoDb,
  fetchDynamicContentIntoDb
}
