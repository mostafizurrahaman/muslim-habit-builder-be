import { Router } from 'express';

import { announcementController } from '../announcement/announcement.controller';
import { USER_ROLE } from '../../user/user.constant';
import authMiddleware from '../../../middlewares/auth.middleware';
import { validateRequest } from '../../../middlewares/request.validator';
import announcementValidationZodSchema from './announcement.zod';

const announcementRouter = Router();

announcementRouter.post(
  '/add',
  authMiddleware(USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  validateRequest({
    body: announcementValidationZodSchema.announcementSchema,
  }),
  announcementController.createAnnouncementIntoDb,
);

announcementRouter.patch(
  '/update/:id',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  validateRequest({
    body: announcementValidationZodSchema.updateAnnouncementSchema,
  }),
  announcementController.updateAnnouncementIntoDb,
);

announcementRouter.delete(
  '/delete/:id',
  authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  announcementController.deleteAnnouncementIntoDb,
);

announcementRouter.get(
  '/',
  announcementController.getAllAnnouncementsForAdmin,
);

announcementRouter.get(
  '/retrieve',
  // authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  announcementController.getAllAnnouncementsForAdmin,
);

export default announcementRouter;
