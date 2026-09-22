import { Schema, model } from 'mongoose';
import type { IFcmTokenDoc } from './fcm-token.interfaces';
import { deviceTypeValues } from './fcm-token.constants';

const fcmTokenSchema = new Schema<IFcmTokenDoc>(
  {
    token: {
      type: String,
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deviceType: {
      type: String,
      enum: deviceTypeValues,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const FcmToken = model<IFcmTokenDoc>('FcmToken', fcmTokenSchema);
