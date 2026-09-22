import express, { Router } from 'express';

import { fcmTokenControllers } from './fcm-token.controllers';
import { fcmTokenValidations } from './fcm-token.validations';
import authMiddleware from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/request.validator';

const router: Router = express.Router();

router.post(
  '/register',
  authMiddleware(),
  validateRequest({
    body: fcmTokenValidations.updateFcmTokenSchema,
  }),
  fcmTokenControllers.updateFcmToken,
);

router.post(
  '/unregister',
  authMiddleware(),
  validateRequest({
    body: fcmTokenValidations.removeFcmTokenSchema,
  }),
  fcmTokenControllers.removeFcmToken,
);

export const fcmTokenRoutes = router;

