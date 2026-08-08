import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import asyncHandler from '../../../shared/asynchandler';
import sendResponse from '../../../shared/sendResponse';
import { userAuthService } from './auth.service';

// login
const loginWithCredential = asyncHandler(async (req: Request, res: Response) => {
  const result = await userAuthService.loginWithCredential(req.body);
  const isVerificationRequired = 'status' in result && result.status === 'UNVERIFIED';
  sendResponse(res, {
    statusCode: isVerificationRequired ? StatusCodes.BAD_REQUEST : StatusCodes.OK,
    success: isVerificationRequired ? false :true,
    message: isVerificationRequired ? 'Your Account is not verified. Please verify your email to login' : 'Welcome back! You have successfully logged in.',
    data: result,
  });
});

// login with credential for admin
const adminLoginWithCredential = asyncHandler(async (req: Request, res: Response) => {
  const result = await userAuthService.adminLoginWithCredential(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Welcome back! You have successfully logged in.',
    data: result,
  });
});

// login with social
const loginWithOAuth = asyncHandler(async (req: Request, res: Response) => {
  const result = await userAuthService.loginWithOAuth(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Welcome back! You have successfully logged in.',
    data: result,
  });
});

// verify email by otp
const verifyEmailByOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp, fcmToken } = req.body;
  const result = await userAuthService.verifyAccountByOtp(email, otp, fcmToken);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Email has been verified successfully!',
    data: result,
  });
});

// send verification otp
const sendVerificationOtpAgain = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await userAuthService.resendEmailVerificationOtpAgain(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Otp Resent successfully!',
    data: result,
  });
});

// request password reset
const requestPasswordReset = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await userAuthService.forgotPassword(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'OTP is send Your Email successfully!',
    data: result,
  });
});

// verify reset password
const verifyResetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const result = await userAuthService.verifyForgetPasswordByOtp(email, otp);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'OTP is correct',
    data: result,
  });
});

// reset forget password
const resetForgetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { newPassword } = req.body;
  const resetToken = req.headers.authorization?.split(' ')[1];
  console.log(newPassword, resetToken);
  if (!resetToken) {
    sendResponse(res, {
      statusCode: StatusCodes.UNAUTHORIZED,
      success: false,
      message: 'Reset token is required',
      data: null,
    });
    return;
  }

  const result = await userAuthService.resetPassword(resetToken, newPassword);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'password reset has been successfully',
    data: result,
  });
});

// send Reset password
const sendResetPasswordOtpAgain = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await userAuthService.resetPasswordOtpAgain(email);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'A new OTP has been sent to your email.',
    data: result,
  });
});

// change password
const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  const result = await userAuthService.changePassword(req.user, oldPassword, newPassword);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'password has been changed successfully',
    data: result,
  });
});

// get new access token
const getNewAccessTokenByRefreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const result = await userAuthService.generateNewAccessTokenByRefreshToken(refreshToken);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Access Token retrieved successfully',
    data: result,
  });
});

export const authController = {
  loginWithCredential,
  adminLoginWithCredential,
  loginWithOAuth,
  verifyEmailByOtp,
  sendVerificationOtpAgain,
  requestPasswordReset,
  verifyResetPassword,
  resetForgetPassword,
  sendResetPasswordOtpAgain,
  changePassword,
  getNewAccessTokenByRefreshToken,
};
