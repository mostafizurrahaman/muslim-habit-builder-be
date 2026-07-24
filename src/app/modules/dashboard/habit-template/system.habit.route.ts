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
    uploadFile(),          // multer, memoryStorage, field name 'pdf'
    validateFileSizes,
    validateFormDataRequest(systemHabitValidationZodSchema.createHabitTemplateZod), // 'data' field ke parse+validate korbe
    habitTemplateController.createHabitTemplate,
);


habitTemplateRouter.get(
    '/get-habits',
    authMiddleware(USER_ROLE.GUEST, USER_ROLE.USER, USER_ROLE.SUPER_ADMIN),
    habitTemplateController.getSystemHabits,
);


export default habitTemplateRouter;
