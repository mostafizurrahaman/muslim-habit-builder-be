import { TContent } from './content.constant';
import { TContentPayload } from './content.interface';
import { Content } from './content.model';

const createOrUpdatePage = async (payload: TContentPayload) => {
  const page = await Content.findOneAndUpdate({ type: payload.type }, payload, {
    upsert: true,
    new: true,
  });
  return page;
};

const getContentByType = async (type: string) => {
  const page = await Content.findOne({ type: type as TContent });
  return page;
};

const getAllContent = async () => {
  return Content.find();
};

export const ContentService = {
  createOrUpdatePage,
  getContentByType,
  getAllContent,
};
