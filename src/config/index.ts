import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({
  path: path.join(process.cwd(), '.env'),
});

const envSchema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'test']).default('development'),
  PORT: z.preprocess((val) => Number(val), z.number().default(5000)),
  SERVER_NAME: z.string().min(1, 'Server name is required'),
  SERVER_URL: z.string().min(1, 'Server URL is required'),
  BASE_URL: z.string().min(1, 'base URL is required'),
  FRONTEND_URL: z.string().min(1, 'frontend url is required'),
  SALT_ROUNDS: z.string().min(1, 'salt rounds is required'),
  MONGODB_URL: z.string().min(1, 'MongoDB connection URL is required'),
  GOOGLE_CLIENT_ID_WEB: z.string().min(1, 'Google CLient ID is required'),
  GOOGLE_CLIENT_ID_ANDROID: z.string().min(1, 'Google CLient ID is required'),
  GOOGLE_CLIENT_ID_IOS: z.string().min(1, 'Google CLient ID is required'),
  HASH_SECRET_KEY: z.string().min(1, 'hash secret key is required'),
  JWT_ACCESS_TOKEN_SECRET: z.string().min(1, 'Access token secret key is required'),
  OTP_TOKEN_EXPIRESIN: z.string().default('2m'),
  JWT_ACCESS_TOKEN_EXPIRESIN: z.string().default('1d'),
  JWT_REFRESH_TOKEN_SECRET: z.string().min(1, 'Refresh token secret key is required'),
  JWT_REFRESH_TOKEN_EXPIRESIN: z.string().default('7d'),
  OTP_EXPIRY_MINUTES: z.string(),
  ADMIN_PASSWORD: z.string(),
  ADMIN_EMAIL: z.string().email('Invalid email format'),
  APP_ID: z.string(),
  SERVER_SECRET: z.string(),
  CALLBACK_SECRET: z.string(),
  STRIPE_SECRET_KEY: z.string().min(1, 'stripe secret key is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'stripe secret key is required'),
  GMAIL_APP_USER: z.email('Invalid email format'),
  GMAIL_APP_PASSWORD: z.string().min(1, 'Gmail app password is required'),
  CORS_ORIGINS: z.string({ error: 'Cors origin is required' }).transform((val) => val.split(',')),
});

const envVars = envSchema.parse(process.env);

export default {
  node_env: envVars.NODE_ENV,
  server_port: envVars.PORT,
  server_name: envVars.SERVER_NAME,
  mongodb_url: envVars.MONGODB_URL,
  frontend_url: envVars.FRONTEND_URL,
  base_url: envVars.BASE_URL,
  hash_secret_key: envVars.HASH_SECRET_KEY,
  google_client_id_web: envVars.GOOGLE_CLIENT_ID_WEB,
  google_client_id_android: envVars.GOOGLE_CLIENT_ID_ANDROID,
  google_client_id_ios: envVars.GOOGLE_CLIENT_ID_IOS,
  jwt_access_token_secret: envVars.JWT_ACCESS_TOKEN_SECRET,
  jwt_access_token_expiresin: envVars.JWT_ACCESS_TOKEN_EXPIRESIN,
  jwt_refresh_token_secret: envVars.JWT_REFRESH_TOKEN_SECRET,
  jwt_refresh_token_expiresin: envVars.JWT_REFRESH_TOKEN_EXPIRESIN,
  otp_expires_in: envVars.OTP_EXPIRY_MINUTES,
  salt_rounds: envVars.SALT_ROUNDS,
  otp_token_expiresin: envVars.OTP_TOKEN_EXPIRESIN,
  stripe_webhook_secret: envVars.STRIPE_WEBHOOK_SECRET,
  stripe_secret_key: envVars.STRIPE_SECRET_KEY,
  gmail_app_user: envVars.GMAIL_APP_USER,
  gmail_app_password: envVars.GMAIL_APP_PASSWORD,
  admin_email: envVars.ADMIN_EMAIL,
  admin_password: envVars.ADMIN_PASSWORD,
  server_url: envVars.SERVER_URL,
  app_id: envVars.APP_ID,
  server_secret: envVars.SERVER_SECRET,
  callback_secret: envVars.CALLBACK_SECRET,
  CORS_ORIGINS: envVars.CORS_ORIGINS,
};
