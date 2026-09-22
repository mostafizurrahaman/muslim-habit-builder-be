import { StatusCodes } from 'http-status-codes';
import asyncHandler from '../../../shared/asynchandler';
import sendResponse from '../../../shared/sendResponse';
import { notificationServices } from './notification.services';
import { TGetAllNotificationQueryParamsType } from './notification.validations';

const createNotification = asyncHandler(async (req, res) => {
  const sender = req.body.sender || req.user?._id;
  const result = await notificationServices.createNotification({
    ...req.body,
    sender,
  });

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.CREATED,
    message: 'The notification created successfully!',
    data: result,
  });
});

const markAsRead = asyncHandler(async (req, res) => {
  const notificationId = req.params.id as string;
  const user = req.user;
  const result = await notificationServices.markedAsRead(user, notificationId);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'The notification has marked as read successfully.',
    data: result,
  });
});

const markAsReadAll = asyncHandler(async (req, res) => {
  const user = req.user;
  const result = await notificationServices.markedAsReadAll(user);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'All notifications have marked as read successfully.',
    data: result,
  });
});

const getAllNotification = asyncHandler(async (req, res) => {
  const user = req.user;
  const result = await notificationServices.getAllNotification(user, req.query as unknown as TGetAllNotificationQueryParamsType);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'The notification retrieved successfully!',
    data: result.data,
    meta: result.meta,
  });
});

export const notificationControllers = {
  createNotification,
  getAllNotification,
  markAsRead,
  markAsReadAll,
};
