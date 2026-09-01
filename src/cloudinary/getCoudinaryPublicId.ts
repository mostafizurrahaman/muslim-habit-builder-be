export function getCloudinaryPublicId(url: string, options?: { keepExtension?: boolean }): string | null {
  try {
    const cleanUrl = url.split('?')[0]; 
    const uploadIndex = cleanUrl.indexOf('/upload/');
    if (uploadIndex === -1) return null;

    let publicId = cleanUrl
      .substring(uploadIndex + 8)
      .replace(/^v\d+\//, '');

    if (!options?.keepExtension) {
      publicId = publicId.replace(/\.[^/.]+$/, '');
    }
   
      console.log({publicId: publicId})
    return publicId;
  } catch {
    return null;
  }
}

