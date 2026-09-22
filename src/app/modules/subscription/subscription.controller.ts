import { Request, Response } from 'express';
import asyncHandler from '../../../shared/asynchandler';
import sendResponse from '../../../shared/sendResponse';
import { StatusCodes } from 'http-status-codes';
import { subscriptionService } from './subscription.service';

const sendSubscriptionPurchaseRequestToAdmin = asyncHandler(async (req: Request, res: Response) => {
  const result = await subscriptionService.sendSubscriptionPurchaseRequest(req.user, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Subscription purchase request has been submitted successfully',
    data: result,
  });
});

const getMySubscription = asyncHandler(async (req: Request, res: Response) => {
  const result = await subscriptionService.getMySubscription(req.user);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscription details retrieved successfully',
    data: result,
  });
});

const getAllSubscriptionsForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const result = await subscriptionService.getAllSubscriptions(req.query as Record<string, unknown>);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscriptions retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const updateSubscriptionStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await subscriptionService.updateSubscriptionStatus(id as string, req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscription status updated successfully',
    data: result,
  });
});

const cancelMySubscription = asyncHandler(async (req: Request, res: Response) => {
  const result = await subscriptionService.cancelMySubscription(req.user);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscription cancelled successfully',
    data: result,
  });
});

const checkAndNotifyExpiringSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const result = await subscriptionService.checkAndNotifyExpiringSubscriptions();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Subscription expiry check completed',
    data: result,
  });
});

export const subscriptionController = {
  sendSubscriptionPurchaseRequestToAdmin,
  getMySubscription,
  getAllSubscriptionsForAdmin,
  updateSubscriptionStatus,
  cancelMySubscription,
  checkAndNotifyExpiringSubscriptions,
};