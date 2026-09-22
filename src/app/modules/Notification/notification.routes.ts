import express, { Router } from 'express';

import { notificationControllers } from './notification.controllers';
import { notificationValidations } from './notification.validations';
import authMiddleware from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/request.validator';

const router: Router = express.Router();

router.post(
  '/',
  authMiddleware(),
  validateRequest({
    body: notificationValidations.createNotificationSchema,
  }),
  notificationControllers.createNotification,
);

router.post('/mark-as-read/all', authMiddleware(), notificationControllers.markAsReadAll);
router.patch('/mark-as-read/:id', authMiddleware(), notificationControllers.markAsRead);

router.get(
  '/all',
  authMiddleware(),
  validateRequest({
    query: notificationValidations.getAllNotificationSchema,
  }),
  notificationControllers.getAllNotification,
);

router.post(
  '/trigger-reminders',
  authMiddleware(),
  notificationControllers.triggerHabitReminders,
);

export const notificationRoutes = router;
