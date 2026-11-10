import { S3Client } from '@aws-sdk/client-s3';
import config from './index';

export const s3Config = {
  region: config.aws_region,
  bucketName: config.aws_s3_bucket_name,
  accessKeyId: config.aws_access_key_id,
  secretAccessKey: config.aws_secret_access_key,
};

const s3Client = new S3Client({
  region: s3Config.region,
  credentials: {
    accessKeyId: s3Config.accessKeyId,
    secretAccessKey: s3Config.secretAccessKey,
  },
});

export default s3Client;

