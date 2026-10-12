import { z } from 'zod';

const createContactDetailSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email('Invalid email address')
      .or(z.literal(''))
      .optional(),
    whatsapp: z.string().trim().optional(),
    website: z.string().trim().optional(),
    twitter: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    facebook: z.string().trim().optional(),
    instagram: z.string().trim().optional(),
    linkedin: z.string().trim().optional(),
    youtube: z.string().trim().optional(),
    telegram: z.string().trim().optional(),
    tiktok: z.string().trim().optional(),
    address: z.string().trim().optional(),
    additionalInfo: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: 'At least one contact field must be provided',
    }
  );

const updateContactDetailSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email('Invalid email address')
      .or(z.literal(''))
      .optional(),
    whatsapp: z.string().trim().optional(),
    website: z.string().trim().optional(),
    twitter: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    facebook: z.string().trim().optional(),
    instagram: z.string().trim().optional(),
    linkedin: z.string().trim().optional(),
    youtube: z.string().trim().optional(),
    telegram: z.string().trim().optional(),
    tiktok: z.string().trim().optional(),
    address: z.string().trim().optional(),
    additionalInfo: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: 'At least one field must be provided for update',
    }
  );

export const contactDetailZodValidation = {
  createContactDetailSchema,
  updateContactDetailSchema,
};
