import cloudinary from '../config/cloudinary.config';
import { getCloudinaryPublicId } from './getCoudinaryPublicId';

export const deleteImageFromCloudinary = async (imageUrl: string) => {
  const publicId = getCloudinaryPublicId(imageUrl);
  if (publicId) {
    const result = await cloudinary.uploader.destroy(publicId as string);
    return result;
  }
  return;
};
