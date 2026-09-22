import { IUser } from '../user/user.interface';
import { FcmToken } from './fcm-token.model';
import type { TUpdateFcmTokenPayloadType } from './fcm-token.validations';
import type { DeleteResult, Types } from 'mongoose';

// ?? Update an user fcm token
const updateFcmToken = async (userId: Types.ObjectId | string, payload: TUpdateFcmTokenPayloadType) => {
  const { token, deviceType } = payload;

  const newToken = await FcmToken.findOneAndUpdate(
    {
      token,
    },
    {
      $set: {
        token,
        user: userId,
        deviceType,
        updatedAt: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
    },
  );

  return newToken;
};

// ?? Get an user all fcm token:
const getFcmTokensByUserId = async (userId: Types.ObjectId | string) => {
  const fcmTokens = await FcmToken.find({
    user: userId,
  })
    .select({
      _id: 0,
      token: 1,
    })
    .lean();

  const allTokens = fcmTokens.map((token) => token.token);

  return allTokens;
};

// ?? Delete FCM Token by tokens:
const deleteFcmTokens = async (tokens: string[]): Promise<DeleteResult> => {
  const deletedTokens = await FcmToken.deleteMany({
    token: {
      $in: tokens,
    },
  });

  return deletedTokens;
};

export const fcmTokenServices = {
  updateFcmToken,
  getFcmTokensByUserId,
  deleteFcmTokens,
};
