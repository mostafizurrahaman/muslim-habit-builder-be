import { deleteImageFromCloudinary } from '../../../cloudinary/deleteImageFromCloudinary';
import { uploadToCloudinary } from '../../../cloudinary/uploadImageToCLoudinary';
import jwtHelpers from '../../../helpers/jwtHelpers';
import { randomUserImage } from '../../../utilities/randomUserImage';
import { BadRequestError } from '../../errors/request/apiError';

import { sendVerificationOtp } from '../auth/auth.utils';

import { USER_ROLE, USER_STATUS } from './user.constant';
import { IUser, TProfileImage } from './user.interface';
import User from './user.model';
import { generateGuestEmail } from './user.utils';
import { TRegistrationPayload, TUserProfileUpdatePayload } from './user.validations';

// create account
const createAccount = async (payload: TRegistrationPayload) => {
  const existingUser = await User.findOne({ email: payload.email }).select('+password');

  if (existingUser) {
    if (existingUser.deletedAt) {
      const previousDeletedAt = existingUser.deletedAt;
      const previousStatus = existingUser.status;

      existingUser.deletedAt = null;
      existingUser.status = USER_STATUS.ACTIVE;
      existingUser.password = payload.password;
      existingUser.verification.emailVerifiedAt = null;
      await existingUser.save();

      try {
        await sendVerificationOtp(existingUser._id, payload.email);
      } catch {
        existingUser.deletedAt = previousDeletedAt;
        existingUser.status = previousStatus;
        await existingUser.save();
        throw new BadRequestError('Failed to send verification email. Try again.');
      }

      return { status: 'UNVERIFIED' };
    }

    if (existingUser.status === USER_STATUS.BLOCKED) {
      throw new BadRequestError('This account is blocked. Contact support.');
    }

    if (existingUser.status === USER_STATUS.DISABLED) {
      throw new BadRequestError('This account is currently disabled. Please login again to enable it.');
    }

    if (!existingUser.verification.emailVerifiedAt) {
      try {
        await sendVerificationOtp(existingUser._id, payload.email);
      } catch {
        throw new BadRequestError('Failed to send verification email. Try again.');
      }
      return { status: 'UNVERIFIED' };
    }

    throw new BadRequestError('An account with this email already exists.');
  }

  const newUser = new User({
    ...payload,
    avatar: randomUserImage(),
    role: USER_ROLE.USER,
    status: USER_STATUS.ACTIVE,
  });

  await newUser.save();

  try {
    await sendVerificationOtp(newUser._id, payload.email);
  } catch {
    await newUser.deleteOne();
    throw new BadRequestError('Failed to send verification email. Try again.');
  }

  return { id: newUser._id, email: newUser.email };
};


// create guest account
const createGuestAccount = async () => {

  const guestEmail = generateGuestEmail();
  const fullName = `${guestEmail.split('@')[0]}`;
  // Create Guest
  const newGuest = await User.create({
    fullName,
    email: guestEmail,
    avatar: randomUserImage(),
    role: USER_ROLE.GUEST,
    verification: {
      emailVerifiedAt: new Date()
    },
  });

  if (!newGuest) {
    throw new BadRequestError('Failed to create guest account. Try again.');
  }

  const jwtPayload = {
    id: newGuest._id,
    role: newGuest.role,
  };
  const tokens = await jwtHelpers.generateTokens(jwtPayload);
  return tokens;

};


const switchGuestAccountToRealAccount = async (user: IUser, payload: TRegistrationPayload) => {
  // Implementation for switching guest account to real account

  const existingUser = await User.findById(user._id);
  if (!existingUser) {
    throw new BadRequestError('Guest account not found.');
  }

  existingUser.fullName = payload.fullName;
  existingUser.timezone = payload.timezone;
  existingUser.email = payload.email;
  existingUser.password = payload.password;
  existingUser.verification.emailVerifiedAt = null;
  existingUser.role = USER_ROLE.USER;
  existingUser.status = USER_STATUS.ACTIVE;

  await existingUser.save();

  try {
    await sendVerificationOtp(existingUser._id, payload.email);
  } catch {
    throw new BadRequestError('Failed to send verification email. Try again.');
  }

  return null;

};



const updateUserProfileImage = async (user: IUser, files: TProfileImage) => {
  if (!files?.profile_image?.length) {
    throw new BadRequestError('No profile image provided');
  }

  // save old urls
  const oldAvatarUrl = user.avatar;

  let newProfileImageUrl: string;

  try {
    const result = await uploadToCloudinary(
      files.profile_image[0],
      'profile_images'
    );

    if (!result?.secure_url) {
      throw new BadRequestError('Cloudinary upload failed');
    }

    newProfileImageUrl = result.secure_url;
  } catch (error) {
    throw new BadRequestError('Image upload failed');
  }

  try {

    user.avatar = newProfileImageUrl;
    await user.save();

  } catch (error) {
    // Rollback: delete the newly uploaded image
    await deleteImageFromCloudinary(newProfileImageUrl);
    throw error;
  }

  // Now safely delete the OLD image
  if (oldAvatarUrl) {
    await deleteImageFromCloudinary(oldAvatarUrl);
  }

  return { avatar: newProfileImageUrl };
};


const updateUserProfile = async (user: IUser, payload: TUserProfileUpdatePayload) => {
  console.log({ payload })
  const result = await User.findByIdAndUpdate(
    user._id,
    { $set: payload },
    { new: true }
  );
  return result;
};

const getUserProfile = async (user: IUser) => {
  return {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    hasNotification: user.hasNotification ?? false,
    notificationType: user.notificationType,
    subscriptionPlan: user.subscriptionPlan,
  };
}


export const userService = {
  createAccount,
  createGuestAccount,
  switchGuestAccountToRealAccount,
  updateUserProfileImage,
  updateUserProfile,
  getUserProfile,
};
