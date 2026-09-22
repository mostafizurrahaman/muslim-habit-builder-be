import z from 'zod';
import { SUBSCRIPTION_MODE, SUBSCRIPTION_PLAN, SUBSCRIPTION_STATUS } from './subscription.constant';

const subscriptionRequestPayload = z.object({
  plan: z.enum(Object.values(SUBSCRIPTION_PLAN) as [string, ...string[]], {
    error: 'Valid subscription plan is required',
  }),
  mode: z.enum(Object.values(SUBSCRIPTION_MODE) as [string, ...string[]], {
    error: 'Valid billing mode is required',
  }),
  price: z.coerce.number().nonnegative().default(0),
});

const updateSubscriptionSchema = z.object({
  status: z.enum(Object.values(SUBSCRIPTION_STATUS) as [string, ...string[]]),
  plan: z.enum(Object.values(SUBSCRIPTION_PLAN) as [string, ...string[]]).optional(),
  billingCycle: z.enum(Object.values(SUBSCRIPTION_MODE) as [string, ...string[]]).optional(),
  price: z.coerce.number().nonnegative().optional(),
  expiryDate: z.string().optional(),
});

export type TUpdateSubscriptionPayload = z.infer<typeof updateSubscriptionSchema>;
export type TSubscriptionRequestPayload = z.infer<typeof subscriptionRequestPayload>;

const subscriptionValidationZodSchema = {
  subscriptionRequestPayload,
  updateSubscriptionSchema,
};

export default subscriptionValidationZodSchema;