import z from 'zod';
import { notificationSortableFields, notificationTypeValues } from './notification.constants';

const getAllNotificationSchema = z.object({
  page: z.preprocess((val) => (val !== undefined ? Number(val) : 1), z.number().min(1).default(1)),
  limit: z.preprocess((val) => (val !== undefined ? Number(val) : 10), z.number().min(1).max(100).default(10)),
  searchTerm: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  sortBy: z.enum(notificationSortableFields).default('createdAt'),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

const createNotificationSchema = z.object({
  receiver: z.string({ error: 'Receiver user ID is required' }),
  title: z.string({ error: 'Title is required' }).min(1, 'Title cannot be empty'),
  message: z.string({ error: 'Message is required' }).min(1, 'Message cannot be empty'),
  notificationType: z.enum(notificationTypeValues as [string, ...string[]]).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const notificationValidations = {
  getAllNotificationSchema,
  createNotificationSchema,
};

export type TGetAllNotificationQueryParamsType = z.infer<typeof getAllNotificationSchema>;
export type TCreateNotificationPayloadType = z.infer<typeof createNotificationSchema>;

