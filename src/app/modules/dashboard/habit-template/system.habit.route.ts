import { Router } from 'express';

import authMiddleware from '../../../middlewares/auth.middleware';
import { USER_ROLE } from '../../user/user.constant';
import { habitTemplateController } from './system.habit.controller';
import { uploadFile } from '../../../../helpers/fileuploader';
import { validateFormDataRequest } from '../../../middlewares/request.validator';
import systemHabitValidationZodSchema from './system.habit.zod';
import { validateFileSizes } from '../../../middlewares/validateFileSize';


const habitTemplateRouter = Router();

habitTemplateRouter.post(
    '/create',
    authMiddleware(USER_ROLE.GUEST, USER_ROLE.USER, USER_ROLE.SUPER_ADMIN),
    uploadFile(),         
    validateFileSizes,
    validateFormDataRequest(systemHabitValidationZodSchema.createHabitTemplateZod), 
    habitTemplateController.createHabitTemplate,
);

habitTemplateRouter.get(
    '/get-habits',
    authMiddleware(USER_ROLE.GUEST, USER_ROLE.USER, USER_ROLE.SUPER_ADMIN),
    habitTemplateController.getSystemHabitsForUsers,
);

habitTemplateRouter.get(
    '/get-all-habits',
    authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
    habitTemplateController.getAllHabitsForAdmin,
);

habitTemplateRouter.patch(
    '/update/:id',
    authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
    uploadFile(),
    validateFileSizes,
    validateFormDataRequest(systemHabitValidationZodSchema.updateHabitTemplateZod),
    habitTemplateController.updateTemplateHabit,
);

habitTemplateRouter.delete(
    '/delete/:id',
    authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
    habitTemplateController.deleteHabitTemplate,
);

habitTemplateRouter.patch(
    '/publish/:id',
    authMiddleware(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
    habitTemplateController.updateDraftHabitToPublish,
);

habitTemplateRouter.get(
    '/get-habit-details/:id',
    authMiddleware(USER_ROLE.GUEST, USER_ROLE.USER, USER_ROLE.SUPER_ADMIN),
    habitTemplateController.getHabitDetailsById,
);

habitTemplateRouter.get(
    '/get-group-habits',
    authMiddleware(USER_ROLE.GUEST, USER_ROLE.USER, USER_ROLE.SUPER_ADMIN),
    habitTemplateController.getGroupHabits,
);

habitTemplateRouter.get(
    '/get-parent-habits',
    authMiddleware(USER_ROLE.GUEST, USER_ROLE.USER, USER_ROLE.SUPER_ADMIN),
    habitTemplateController.getParentHabits,
);


export default habitTemplateRouter;
