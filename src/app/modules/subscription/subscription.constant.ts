export const SUBSCRIPTION_PLAN = {
    FREE: 'free',
    PREMIUM: 'premium',
    ALL_ACCESS: 'all-access',
    PREMIUM_PLUS: 'premium-plus',
    // Backward compatibility aliases
    FULL_ACCESS: 'all-access',
    MATURA: 'matura',
    SEMI_MATURA: 'semi_matura',
    PROVIME: 'provime',
} as const;

export const SUBSCRIPTION_MODE = {
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
    LIFETIME: 'lifetime',
    // Backward compatibility aliases
    ONE_MONTH: 'monthly',
    THREE_MONTHS: 'three_months',
} as const;

export const SUBSCRIPTION_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled',
} as const;

export type TSubscriptionPlan = (typeof SUBSCRIPTION_PLAN)[keyof typeof SUBSCRIPTION_PLAN];
export type TSubscriptionMode = (typeof SUBSCRIPTION_MODE)[keyof typeof SUBSCRIPTION_MODE];
export type TSubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

