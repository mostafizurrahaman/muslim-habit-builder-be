import { Document, Model, Types } from 'mongoose';
import { TNotificationType, TProvider, TSubscriptionPlan, TUserRole, TUserStatus } from './user.constant';

export type TProfileImage = {
  profile_image: Express.Multer.File[];
};

export interface registerSocialPayload {
  email: string;
  fullName: string;
  provider: TProvider;
}

//Instance methods
export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  fullName: string;
  avatar?: string;
  phone?: string;
  password: string;
  passwordChangedAt?: Date;
  verification: {
    emailVerifiedAt: Date | null;
    phoneVerifiedAt: Date | null;
  };
  role: TUserRole;
  provider?: TProvider;
  timezone?: string | null;
  hasNotification: boolean;
  notificationType: TNotificationType | null;
  subscriptionPlan: TSubscriptionPlan;
  isSocialLogin: boolean;
  status: TUserStatus;
  lastReadAt: Date | null;
  disabledAt: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  isPasswordMatched(plainTextPassword: string): Promise<boolean>;
  isJWTIssuedBeforePasswordChanged(jwtIssuedTimestamp: number | undefined): boolean;
}

// Static methods
export interface IUserModel extends Model<IUser> {
  isUserExistsByEmail(email: string): Promise<IUser | null>;
}
