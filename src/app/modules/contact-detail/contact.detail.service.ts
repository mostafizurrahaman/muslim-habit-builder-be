import { BadRequestError, NotFoundError } from '../../errors/request/apiError';
import {
  TCreateContactDetailPayload,
  TUpdateContactDetailPayload,
} from './contact.detail.interface';
import { ContactDetail } from './contact.detail.model';

const createContactDetail = async (payload: TCreateContactDetailPayload) => {
  const existing = await ContactDetail.findOne();
  if (existing) {
    throw new BadRequestError(
      'Contact details already exist. Only one record is allowed. Please use the update API to modify it.'
    );
  }

  const result = await ContactDetail.create(payload);
  return result;
};

const updateContactDetail = async (
  payload: TUpdateContactDetailPayload,
  id?: string
) => {
  let result;
  if (id) {
    result = await ContactDetail.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    if (!result) {
      throw new NotFoundError('Contact details not found with the given ID');
    }
  } else {
    result = await ContactDetail.findOneAndUpdate({}, payload, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    });
  }

  return result;
};

const getContactDetail = async () => {
  const result = await ContactDetail.findOne();
  return result;
};

export const ContactDetailService = {
  createContactDetail,
  updateContactDetail,
  getContactDetail,
};
