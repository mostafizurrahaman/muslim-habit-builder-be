import { z } from 'zod';


const createAuthSchema = z.object({

  fullName: z
    .string({
      error: (issue) => {
        if (issue.input === undefined) return 'Full name is required';
        if (typeof issue.input !== 'string') return 'Full name must be a string';
        return 'Invalid full name format';
      },
    })
    .min(3, 'Full name must be at least 3 characters long')
    .max(30, 'Full name cannot exceed 30 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Full name can only contain letters and spaces'),


  email: z
    .string()
    .superRefine((val, ctx) => {
      if (val === undefined) {
        ctx.addIssue({ code: 'custom', message: 'Email address is required' });
        return;
      }
      if (typeof val !== 'string') {
        ctx.addIssue({ code: 'custom', message: 'Email must be text' });
        return;
      }
    })
    .transform((val) => val.trim().toLowerCase())
    .pipe(
      z.email('Please provide a valid email address')
        .min(5, 'Email must be at least 5 characters long')
        .max(254, 'Email cannot exceed 254 characters')
    ),

 password: z
    .string({
      error: (issue) => {
        if (issue.input === undefined) return 'Password is required';
        if (typeof issue.input !== 'string') return 'Password must be a string';
        return 'Invalid password format';
      },
    })
    .superRefine((val, ctx) => {
      if (val.length < 8) {
        ctx.addIssue({
          code: 'custom',
          message: 'Password must be at least 8 characters long, less than 30 characters , and contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        });
        return; // Length choto thakle porer check-gula ar run korbe na, tai direct min er message ashbe!
      }
      if (val.length > 25) {
        ctx.addIssue({
          code: 'custom',
          message: 'Password cannot exceed 25 characters',
        });
        return;
      }
      if (!/[A-Z]/.test(val)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Password must contain at least one uppercase letter',
        });
        return;
      }
      if (!/[a-z]/.test(val)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Password must contain at least one lowercase letter',
        });
        return;
      }
      if (!/[0-9]/.test(val)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Password must contain at least one number',
        });
        return;
      }
      if (!/[@$!%*?&#]/.test(val)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Password must contain at least one special character',
        });
        return;
      }
    }),


  timezone: z.string({
    error: (issue) => {
      if (issue.input === undefined) return 'Timezone is required';
      if (typeof issue.input !== 'string') return 'Timezone must be a string';
      return 'Invalid timezone format';
    },
  }),

  // fcmToken: z.string({
  //   error: (issue) => {
  //     if (issue.input === undefined) return 'FCM token is required';
  //     if (typeof issue.input !== 'string') return 'FCM token must be a string';
  //     return 'Invalid FCM token format';
  //   },
  // }),

});



const updateUserProfileSchema = z.object({
  fullName: z
    .string({
      error: (issue) => {
        if (issue.input === undefined) return 'Full name is required';
        if (typeof issue.input !== 'string') return 'Full name must be a string';
        return 'Invalid full name format';
      },
    })
    .min(3, 'Full name must be at least 3 characters long')
    .max(30, 'Full name cannot exceed 30 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Full name can only contain letters and spaces').optional(),

  phone: z.string({
    error: (issue) => {
      if (issue.input === undefined) return 'Phone number is required';
      if (typeof issue.input !== 'string') return 'Phone number must be a string';
      return 'Invalid phone number format';
    },
  })
    .regex(/^[0-9]+$/, "Phone number must contain only numbers").optional(),

  hasNotification: z.boolean().optional(),

  notificationType: z.enum(['vibrate', 'sound'], {
    message: 'Notification type must be either vibrate or sound',
  }).optional(),

});



const createSocialAuthSchema = z.object({
  provider: z.enum(['google', 'apple'], {
    message: 'Provider must be google or apple',
  }),
  token: z
    .string({
      message: 'Token is required',
    })
    .min(10, { message: 'Invalid token' }),

  fcmToken: z.string({
    message: 'FCM token must be a string',
  }),
});



const updateUserLocationSchema = z.object({
  address: z.string().max(100, 'Address cannot exceed 100 characters'),
  geo: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([
      z.number().refine((lng) => lng >= -180 && lng <= 180, 'Longitude must be between -180 and 180'),
      z.number().refine((lat) => lat >= -90 && lat <= 90, 'Latitude must be between -90 and 90'),
    ])
  })
})


export type TUserProfileUpdatePayload = z.infer<
  typeof updateUserProfileSchema
>;


export type TUserLocationPayload = z.infer<
  typeof updateUserLocationSchema
>;


export type TRegistrationPayload = z.infer<
  typeof createAuthSchema
>;
const userValidationZodSchema = {
  createAuthSchema,
  createSocialAuthSchema,
  updateUserLocationSchema,
  updateUserProfileSchema
};

export default userValidationZodSchema;

/*

export const registerUserValidationSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z
      .string({ invalid_type_error: 'Please add a valid email' })
      .email('Invalid email format')
      .optional(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    phone: z.string().min(1, 'Phone number is required').max(15).optional(),
  }),
});






phone: z
    .string()
    .min(11, "Phone number must be at least 11 digits")
    .max(15, "Phone number cannot exceed 15 digits")
    .regex(/^[0-9]+$/, "Phone number must contain only numbers"),

  address: z.string().max(200, "Address cannot exceed 200 characters").optional(),

  geoLocation: z
    .object({
      type: z.literal("Point"),
      coordinates: z
        .tuple([
          z.number(),
          z.number(),
        ])
        .refine(
          ([lat, lng]) =>
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180,
          "Invalid latitude or longitude values"
        ),
    })
    .optional(),


*/
