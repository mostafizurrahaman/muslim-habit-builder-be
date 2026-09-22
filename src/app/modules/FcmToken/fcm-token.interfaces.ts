import { Document, Types } from 'mongoose';
import type { TFcmTokenField } from '../FcmToken/fcm-token.constants';

export interface IFcmToken {
  token: string;
  user: Types.ObjectId;
  deviceType: TFcmTokenField;
}

export interface IFcmTokenDoc extends Document, IFcmToken {}

// export interface IFcmTokenModel extends Model<IFcmTokenDoc> {
//   getById(id: string): Promise<IFcmToken | null>
// }

// Check this token as for another (user, deviceType, token) pair, if so update the token user (ownership transfer) and return the updated token, otherwise return null

// When user logged out
