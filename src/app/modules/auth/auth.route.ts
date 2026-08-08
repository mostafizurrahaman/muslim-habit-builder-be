import { Router } from 'express';

import authMiddleware from '../../middlewares/auth.middleware';
import { otpRateLimiter } from '../../middlewares/otpRateLimit';
import { validateRequest } from '../../middlewares/request.validator';
import { USER_ROLE } from '../user/user.constant';
import userValidationZodSchema from '../user/user.validations';
import { authController } from './auth.controller';
import { authValidationZodSchema } from './auth.validation';

const authRouter = Router();

authRouter.post(
  '/login',
  validateRequest({
    body: authValidationZodSchema.loginAuthSchema,
  }),
  authController.loginWithCredential,
);

authRouter.post(
  '/admin/login',
  validateRequest({
    body: authValidationZodSchema.loginAuthSchema,
  }),
  authController.adminLoginWithCredential,
);

authRouter.post(
  '/social-login',
  validateRequest({
    body: userValidationZodSchema.createSocialAuthSchema,
  }),
  authController.loginWithOAuth,
);

authRouter.post(
  '/verify-email',
  validateRequest({
    body: authValidationZodSchema.verifyEmailByOtpSchema,
  }),
  authController.verifyEmailByOtp,
);

authRouter.post(
  '/resend-otp',
  otpRateLimiter,
  validateRequest({
    body: authValidationZodSchema.sendVerificationOtpAgainSchema,
  }),
  authController.sendVerificationOtpAgain,
);

authRouter.post(
  '/reset-password-otp',
  validateRequest({
    body: authValidationZodSchema.resetPasswordOtpAgainSchema,
  }),
  otpRateLimiter,
  authController.sendResetPasswordOtpAgain,
);

authRouter.post(
  '/forgot-password',
  validateRequest({
    body: authValidationZodSchema.forgotPasswordSchema,
  }),
  otpRateLimiter,
  authController.requestPasswordReset,
);

authRouter.post(
  '/verify/reset-password',
  validateRequest({
    body: authValidationZodSchema.verifyForgotPasswordSchema,
  }),
  authController.verifyResetPassword,
);

authRouter.post(
  '/reset-password',
  validateRequest({
    body: authValidationZodSchema.resetPasswordSchema,
  }),
  authController.resetForgetPassword,
);

authRouter.patch(
  '/change-password',
  authMiddleware(USER_ROLE.USER, USER_ROLE.SUPER_ADMIN, USER_ROLE.ADMIN),
  validateRequest({
    body: authValidationZodSchema.changePasswordSchema,
  }),
  authController.changePassword,
);

authRouter.post('/refresh-token', authController.getNewAccessTokenByRefreshToken);

export default authRouter;
