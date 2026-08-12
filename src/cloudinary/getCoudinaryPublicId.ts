export function getCloudinaryPublicId(url: string): string | null {
  try {
    const cleanUrl = url.split('?')[0]; 
    const uploadIndex = cleanUrl.indexOf('/upload/');
    if (uploadIndex === -1) return null;

    const publicId = cleanUrl
      .substring(uploadIndex + 8)
      .replace(/^v\d+\//, '') 
      .replace(/\.[^/.]+$/, '');
   
      console.log({publicId: publicId})
    return publicId;
  } catch {
    return null;
  }
}

