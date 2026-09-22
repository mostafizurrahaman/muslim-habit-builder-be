import z from 'zod';
import { deviceTypeValues } from './fcm-token.constants';

const updateFcmTokenSchema = z.object({
  token: z.string({
    error: 'Fcm token is required.',
  }),
  deviceType: z.enum(deviceTypeValues, {
    error: `Device type should be ${deviceTypeValues.join(', ')}`,
  }),
});

const removeFcmTokenSchema = z.object({
  token: z.string({
    error: 'Fcm token is required.',
  }),
});

export const fcmTokenValidations = {
  updateFcmTokenSchema,
  removeFcmTokenSchema,
};

export type TUpdateFcmTokenPayloadType = z.infer<typeof updateFcmTokenSchema>;
export type TRemoveFcmTokenPayloadType = z.infer<typeof removeFcmTokenSchema>;

