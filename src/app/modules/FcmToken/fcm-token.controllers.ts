import { fcmTokenServices } from './fcm-token.services';

import asyncHandler from '../../../shared/asynchandler';
import sendResponse from '../../../shared/sendResponse';
import { StatusCodes } from 'http-status-codes';

const updateFcmToken = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const result = await fcmTokenServices.updateFcmToken(userId, req.body);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'The fcm token updated successfully!',
    data: result,
  });
});

const removeFcmToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const result = await fcmTokenServices.deleteFcmTokens([token]);

  sendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'The fcm token removed successfully!',
    data: result,
  });
});

export const fcmTokenControllers = {
  updateFcmToken,
  removeFcmToken,
};

