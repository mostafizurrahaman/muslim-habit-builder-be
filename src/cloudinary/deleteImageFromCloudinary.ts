import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import s3Client, { s3Config } from '../config/aws.config';
import { getS3KeyFromUrl } from './getCoudinaryPublicId';

export const deleteFromS3 = async (fileUrl: string) => {
  const key = getS3KeyFromUrl(fileUrl);
  if (!key) return;

  const bucketName = process.env.AWS_S3_BUCKET_NAME || s3Config.bucketName;
  return s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
};

export const deleteImageFromCloudinary = deleteFromS3;
