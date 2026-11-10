import { PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import s3Client, { s3Config } from '../config/aws.config';

export type TUploadFolder =
  | 'profile_images'
  | 'habit_images'
  | 'pdf_documents'
  | 'habit_documents'
  | 'quran_verse'
  | 'bug_images'
  | 'habit_pdfs';

export const uploadToS3 = async (
  file: Express.Multer.File,
  folderName: TUploadFolder,
): Promise<{ secure_url: string; public_id: string }> => {
  try {
    const isPdf = file.mimetype === 'application/pdf';
    let uploadBuffer: Buffer = file.buffer;
    let contentType = file.mimetype || 'application/octet-stream';

    const baseName =
      (file.originalname || 'file')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 80) || 'file';

    let fileName: string;

    if (!isPdf && file.mimetype.startsWith('image/')) {
      uploadBuffer = await sharp(file.buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();

      contentType = 'image/webp';
      fileName = `${baseName}_${Date.now()}.webp`;
    } else if (isPdf) {
      contentType = 'application/pdf';
      fileName = `${baseName}_${Date.now()}.pdf`;
    } else {
      const ext = file.originalname?.match(/\.[^/.]+$/)?.[0] || '';
      fileName = `${baseName}_${Date.now()}${ext}`;
    }

    const key = `${folderName}/${fileName}`;
    const bucketName = process.env.AWS_S3_BUCKET_NAME || s3Config.bucketName;
    const region = process.env.AWS_REGION || s3Config.region;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: uploadBuffer,
        ContentType: contentType,
        ...(isPdf ? { ContentDisposition: 'inline' } : {}),
      }),
    );

    const secure_url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

    return {
      secure_url,
      public_id: key,
    };
  } catch (error: any) {
    throw new Error(`AWS S3 upload failed: ${error?.message || error}`);
  }
};

export const uploadToCloudinary = uploadToS3;
