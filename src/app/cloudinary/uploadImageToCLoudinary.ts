import sharp from 'sharp';
import cloudinary from "../../config/cloudinary.config";

export const uploadToCloudinary = (
  file: Express.Multer.File,
  folderName: 'profile_images' | 'habit_images' | 'pdf_documents' | 'habit_documents' | 'quran_verse' | 'bug_images' | 'habit_pdfs' ,
): Promise<{ secure_url: string; public_id: string }> => {
  return new Promise(async (resolve, reject) => {
    try {
      const isPdf = file.mimetype === 'application/pdf';
      let uploadBuffer: Buffer = file.buffer;
      
    
      const uploadOptions: any = {
        folder: folderName,
        resource_type: isPdf ? 'raw' : 'image', 
      };

     
      if (!isPdf && file.mimetype.startsWith('image/')) {
        uploadBuffer = await sharp(file.buffer)
          .resize({ width: 800, withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer();
        
        uploadOptions.format = 'webp'; 
      }

      const stream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error || !result) {
            return reject(
              new Error(`Cloudinary upload failed: ${error?.message}`)
            );
          }
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        },
      );

      stream.end(uploadBuffer);
    } catch (error) {
      reject(new Error(`File processing failed: ${error}`));
    }
  });
};