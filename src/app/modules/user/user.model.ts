import bcrypt from 'bcrypt';
import mongoose, { Schema } from 'mongoose';
import config from '../../../config';
import { NOTIFICATION_TYPE, PROVIDER, SUBSCRIPTION_PLAN, USER_ROLE, USER_STATUS } from './user.constant';
import { IUser, IUserModel } from './user.interface';


export const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email address is required'],
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    phone: {
      type: String,
      default: null
    },
    avatar: {
      type: String,
      default: null
    },
    password: {
      type: String,
      required: false,
    },
    passwordChangedAt: {
      type: Date,
      select: false,
    },
    verification: {
      emailVerifiedAt: { type: Date, default: null },
      phoneVerifiedAt: { type: Date, default: null },
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLE),
      default: 'user',
    },
    provider: {
      type: String,
      enum: Object.values(PROVIDER),
      default: null
    },
    isSocialLogin: {
      type: Boolean,
      default: false,
    },
    timezone: {
      type: String,
      default: null
    },
    hasNotification: {
      type: Boolean,
      default: false
    },
    subscriptionPlan: {
      type: String,
      enum: Object.values(SUBSCRIPTION_PLAN),
      default: SUBSCRIPTION_PLAN.FREE,
    },

    notificationType: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPE),
      default: NOTIFICATION_TYPE.VIBRATE,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    disabledAt: {
      type: Date,
      default: null
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

userSchema.pre('save', async function () {
  const salt = await bcrypt.genSalt(Number(config.salt_rounds));
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, salt);
  }

});

// isUserExistsByEmail
userSchema.statics.isUserExistsByEmail = async function (email: string): Promise<IUser | null> {
  return await User.findOne({ email }).select('+password');
};

// isPasswordMatched
userSchema.methods.isPasswordMatched = async function (plainTextPassword: string): Promise<boolean> {
  return await bcrypt.compare(plainTextPassword, this.password);
};

// isJWTIssuedBeforePasswordChanged
userSchema.methods.isJWTIssuedBeforePasswordChanged = function (jwtIssuedTimestamp: number): boolean {
  const passwordChangedTime = new Date(this.passwordChangedAt).getTime() / 1000;
  return passwordChangedTime > jwtIssuedTimestamp;
};


userSchema.index({ "email": 1 })
userSchema.index({ "fullName": 1 })

const User = mongoose.model<IUser, IUserModel>('User', userSchema);
export default User;
