import cloudinary from '../config/cloudinary.config';
import { getCloudinaryPublicId } from './getCoudinaryPublicId';

export const deleteImageFromCloudinary = async (imageUrl: string) => {
  const isRaw = imageUrl.includes('/raw/upload/');
  const publicId = getCloudinaryPublicId(imageUrl, { keepExtension: isRaw });
  if (publicId) {
    const result = await cloudinary.uploader.destroy(publicId as string, {
      resource_type: isRaw ? 'raw' : 'image',
    });
    return result;
  }
  return;
};
