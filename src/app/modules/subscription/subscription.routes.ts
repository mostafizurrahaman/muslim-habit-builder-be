
import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/request.validator';
import { USER_ROLE } from '../user/user.constant';
import { subscriptionController } from './subscription.controller';
import subscriptionValidationZodSchema from './subscription.zod';

const subscriptionRouter = Router();

// User routes
subscriptionRouter.post(
  '/send-request',
  authMiddleware(USER_ROLE.USER),
  validateRequest({
    body: subscriptionValidationZodSchema.subscriptionRequestPayload,
  }),
  subscriptionController.sendSubscriptionPurchaseRequestToAdmin,
);

subscriptionRouter.get(
  '/my-subscription',
  authMiddleware(USER_ROLE.USER),
  subscriptionController.getMySubscription,
);

subscriptionRouter.patch(
  '/cancel',
  authMiddleware(USER_ROLE.USER),
  subscriptionController.cancelMySubscription,
);

// Admin routes
subscriptionRouter.get(
  '/all',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  subscriptionController.getAllSubscriptionsForAdmin,
);

subscriptionRouter.patch(
  '/update-status/:id',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    body: subscriptionValidationZodSchema.updateSubscriptionSchema,
  }),
  subscriptionController.updateSubscriptionStatus,
);

subscriptionRouter.post(
  '/check-expiry',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  subscriptionController.checkAndNotifyExpiringSubscriptions,
);

export default subscriptionRouter;