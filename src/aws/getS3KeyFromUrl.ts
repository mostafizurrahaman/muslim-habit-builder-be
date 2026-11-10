export function getS3KeyFromUrl(url: string): string | null {
  try {
    if (!url) return null;
    const cleanUrl = url.split('?')[0];

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return decodeURIComponent(cleanUrl.replace(/^\/+/, ''));
    }

    const parsed = new URL(cleanUrl);
    let key = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');

    // Handle path-style S3 URLs: https://s3.<region>.amazonaws.com/<bucket>/<key>
    const bucket = process.env.AWS_S3_BUCKET_NAME;
    if (bucket && key.startsWith(`${bucket}/`)) {
      key = key.slice(bucket.length + 1);
    }

    return key || null;
  } catch {
    return null;
  }
}

