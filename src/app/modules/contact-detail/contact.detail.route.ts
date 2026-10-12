import { Router } from 'express';
import { validateRequest } from '../../middlewares/request.validator';
import { ContactDetailController } from './contact.detail.controller';
import { contactDetailZodValidation } from './contact.detail.zod';

const router = Router();

// Create contact detail
router.post(
  '/create',
  validateRequest({
    body: contactDetailZodValidation.createContactDetailSchema,
  }),
  ContactDetailController.createContactDetail,
);

// Update contact detail
router.patch(
  '/update',
  validateRequest({
    body: contactDetailZodValidation.updateContactDetailSchema,
  }),
  ContactDetailController.updateContactDetail,
);

// Get contact detail
router.get('/', ContactDetailController.getContactDetail);

export const contactDetailRouter = router;
export default router;
