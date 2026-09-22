

import { BadRequestError, NotFoundError } from '../../errors/request/apiError';
import { IUser } from '../user/user.interface';
import User from '../user/user.model';
import Subscription from './subscription.model';
import { SUBSCRIPTION_PLAN, SUBSCRIPTION_STATUS } from './subscription.constant';
import { TSubscriptionRequestPayload, TUpdateSubscriptionPayload } from './subscription.zod';
import { notificationServices } from '../Notification/notification.services';
import sendMail from '../../../utilities/sendEmail';
import config from '../../../config';
import subscriptionRequestEmailTemplate from '../../../mailTemplate/subscriptionTemplate';
import subscriptionApprovalEmailTemplate from '../../../mailTemplate/subscriptionApprovalTemplate';

// 1. Send subscription purchase request by user
const sendSubscriptionPurchaseRequest = async (
  user: IUser,
  payload: TSubscriptionRequestPayload,
) => {
  const existingPending = await Subscription.findOne({
    user: user._id,
    status: SUBSCRIPTION_STATUS.PENDING,
  });

  if (existingPending) {
    throw new BadRequestError('You already have a pending subscription request. Please wait for approval.');
  }

  const subscription = await Subscription.create({
    user: user._id,
    plan: payload.plan as any,
    billingCycle: payload.mode as any,
    price: payload.price,
    status: SUBSCRIPTION_STATUS.PENDING,
  });

  // Notify Admins:
  (async () => {
    try {
      await notificationServices.createNotificationForAdmin({
        sender: user._id,
        title: 'New Subscription Request',
        message: `${user.fullName} requested the "${payload.plan}" plan (${payload.mode}).`,
        notificationType: 'SYSTEM_ALERT',
        meta: {
          subscriptionId: subscription._id.toString(),
          plan: payload.plan,
          mode: payload.mode,
          price: payload.price,
        },
      });

      // Send email to admin
      if (config.admin_email) {
        await sendMail({
          from: config.gmail_app_user || 'support@muslimhabitbuilder.com',
          to: config.admin_email,
          subject: 'New Subscription Purchase Request',
          html: subscriptionRequestEmailTemplate(
            user.fullName,
            user.email,
            payload.plan,
            payload.mode,
            'Muslim Habit Builder Admin',
          ),
        });
      }
    } catch (err) {
      console.error('[SubscriptionService] Failed to notify admin about subscription request:', err);
    }
  })();

  // Notify User:
  (async () => {
    try {
      await notificationServices.createNotification({
        receiver: user._id,
        title: 'Subscription Request Received',
        message: `Your request for the "${payload.plan}" plan has been submitted and is pending review.`,
        notificationType: 'SYSTEM_ALERT',
        meta: { subscriptionId: subscription._id.toString(), plan: payload.plan },
      });
    } catch (err) {
      console.error('[SubscriptionService] Failed to notify user about subscription request:', err);
    }
  })();

  return subscription;
};

// 2. Get user's own subscription status
const getMySubscription = async (user: IUser) => {
  const subscription = await Subscription.findOne({ user: user._id })
    .sort({ createdAt: -1 })
    .lean();

  return {
    subscription,
    currentPlan: user.subscriptionPlan,
  };
};

// 3. Get all subscriptions (Admin)
const getAllSubscriptions = async (query: Record<string, unknown>) => {
  const { page = 1, limit = 10, status, plan } = query;

  const matchStage: any = {};
  if (status) matchStage.status = status;
  if (plan) matchStage.plan = plan;

  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  const result = await Subscription.aggregate([
    { $match: matchStage },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limitNum },
          {
            $lookup: {
              from: 'users',
              localField: 'user',
              foreignField: '_id',
              as: 'userDetails',
            },
          },
          {
            $unwind: {
              path: '$userDetails',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              plan: 1,
              billingCycle: 1,
              status: 1,
              price: 1,
              activatedAt: 1,
              expiryDate: 1,
              createdAt: 1,
              userId: '$userDetails._id',
              userName: '$userDetails.fullName',
              userEmail: '$userDetails.email',
              userAvatar: '$userDetails.avatar',
            },
          },
        ],
        meta: [{ $count: 'total' }],
      },
    },
  ]);

  const data = result?.[0]?.data || [];
  const total = result?.[0]?.meta?.[0]?.total || 0;

  return {
    data,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

// 4. Update subscription status (Admin Approve / Reject / Cancel / Expire)
const updateSubscriptionStatus = async (
  subscriptionId: string,
  payload: TUpdateSubscriptionPayload,
) => {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw new NotFoundError('Subscription not found');
  }

  const user = await User.findById(subscription.user);
  if (!user) {
    throw new NotFoundError('User associated with this subscription not found');
  }

  const isApproved = payload.status === SUBSCRIPTION_STATUS.APPROVED || payload.status === SUBSCRIPTION_STATUS.ACTIVE;

  subscription.status = payload.status as any;

  if (isApproved) {
    subscription.activatedAt = new Date();

    // Calculate expiry date if not provided
    if (payload.expiryDate) {
      subscription.expiryDate = new Date(payload.expiryDate);
    } else {
      const now = new Date();
      const cycle = payload.billingCycle || subscription.billingCycle;
      if (cycle === 'monthly') {
        subscription.expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else if (cycle === 'yearly') {
        subscription.expiryDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      } else if (cycle === 'lifetime') {
        subscription.expiryDate = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000);
      } else {
        subscription.expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
    }

    const planToSet = payload.plan || subscription.plan || SUBSCRIPTION_PLAN.PREMIUM;
    user.subscriptionPlan = planToSet as any;
    await user.save();
  } else {
    // If not approved (rejected, cancelled, expired), reset user to free plan
    user.subscriptionPlan = SUBSCRIPTION_PLAN.FREE as any;
    await user.save();
  }

  await subscription.save();

  // Send notification to User based on status:
  (async () => {
    try {
      const planName = subscription.plan || 'Premium';
      let title = 'Subscription Request Update';
      let message = `Your request for the "${planName}" plan could not be approved at this time.`;

      if (isApproved) {
        title = 'Subscription Approved! 🎉';
        message = `Your "${planName}" subscription has been approved! Enjoy all premium features.`;
      } else if (payload.status === SUBSCRIPTION_STATUS.CANCELLED) {
        title = 'Subscription Cancelled';
        message = `Your subscription for the "${planName}" plan has been cancelled. Your account is now on the Free tier.`;
      } else if (payload.status === SUBSCRIPTION_STATUS.EXPIRED) {
        title = 'Subscription Expired';
        message = `Your "${planName}" subscription has expired. Please renew to keep enjoying premium features.`;
      } else if (payload.status === SUBSCRIPTION_STATUS.REJECTED) {
        title = 'Subscription Request Declined';
        message = `Your request for the "${planName}" plan was not approved. Please contact support if you need assistance.`;
      }

      await notificationServices.createNotification({
        receiver: user._id,
        title,
        message,
        notificationType: 'SYSTEM_ALERT',
        meta: {
          subscriptionId: subscription._id.toString(),
          plan: planName,
          status: subscription.status,
        },
      });

      // Send email notification to user:
      if (user.email) {
        await sendMail({
          from: config.gmail_app_user || 'support@muslimhabitbuilder.com',
          to: user.email,
          subject: isApproved ? 'Subscription Approved' : 'Subscription Request Update',
          html: subscriptionApprovalEmailTemplate(
            user.fullName,
            subscription.plan,
            isApproved ? 'approved' : 'rejected',
          ),
        });
      }
    } catch (err) {
      console.error('[SubscriptionService] Failed to notify user about subscription decision:', err);
    }
  })();

  return subscription;
};

// 5. Cancel user's own subscription
const cancelMySubscription = async (user: IUser) => {
  const subscription = await Subscription.findOne({
    user: user._id,
    status: { $in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.APPROVED, SUBSCRIPTION_STATUS.PENDING] },
  }).sort({ createdAt: -1 });

  if (!subscription) {
    throw new NotFoundError('No active or pending subscription found to cancel');
  }

  const previousPlan = subscription.plan || 'Premium';
  subscription.status = SUBSCRIPTION_STATUS.CANCELLED as any;
  await subscription.save();

  // Reset user's plan to free
  await User.findByIdAndUpdate(user._id, { subscriptionPlan: SUBSCRIPTION_PLAN.FREE });

  // Notify User:
  (async () => {
    try {
      await notificationServices.createNotification({
        receiver: user._id,
        title: 'Subscription Cancelled',
        message: `Your "${previousPlan}" subscription has been cancelled. You can renew or select a new plan anytime.`,
        notificationType: 'SYSTEM_ALERT',
        meta: {
          subscriptionId: subscription._id.toString(),
          plan: previousPlan,
          status: 'cancelled',
        },
      });
    } catch (err) {
      console.error('[SubscriptionService] Failed to notify user about cancellation:', err);
    }
  })();

  // Notify Admin:
  (async () => {
    try {
      await notificationServices.createNotificationForAdmin({
        sender: user._id,
        title: 'Subscription Cancelled by User',
        message: `${user.fullName} (${user.email}) has cancelled their "${previousPlan}" subscription.`,
        notificationType: 'SYSTEM_ALERT',
        meta: {
          subscriptionId: subscription._id.toString(),
          userId: user._id.toString(),
          plan: previousPlan,
        },
      });
    } catch (err) {
      console.error('[SubscriptionService] Failed to notify admin about user cancellation:', err);
    }
  })();

  return subscription;
};

// 6. Check upcoming expiry (remind 3 days ahead) and expire passed subscriptions
const checkAndNotifyExpiringSubscriptions = async () => {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // A. Find subscriptions expiring within 3 days
  const expiringSoon = await Subscription.find({
    status: { $in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.APPROVED] },
    expiryDate: { $gt: now, $lte: threeDaysFromNow },
  }).populate<{ user: IUser }>('user');

  let remindedCount = 0;
  for (const sub of expiringSoon) {
    if (sub.user?._id) {
      try {
        const expiryStr = sub.expiryDate ? sub.expiryDate.toISOString().split('T')[0] : '';
        await notificationServices.createNotification({
          receiver: sub.user._id,
          title: 'Subscription Expiring Soon ⏳',
          message: `Your "${sub.plan || 'Premium'}" subscription will expire on ${expiryStr}. Renew now to avoid losing access to premium features!`,
          notificationType: 'SYSTEM_ALERT',
          meta: {
            subscriptionId: sub._id.toString(),
            expiryDate: sub.expiryDate?.toISOString(),
            plan: sub.plan,
          },
        });
        remindedCount++;
      } catch (err) {
        console.error('[SubscriptionService] Failed to send expiry warning notification:', err);
      }
    }
  }

  // B. Find subscriptions that have passed their expiry date
  const expiredSubscriptions = await Subscription.find({
    status: { $in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.APPROVED] },
    expiryDate: { $lte: now },
  }).populate<{ user: IUser }>('user');

  let expiredCount = 0;
  for (const sub of expiredSubscriptions) {
    sub.status = SUBSCRIPTION_STATUS.EXPIRED as any;
    await sub.save();

    if (sub.user?._id) {
      await User.findByIdAndUpdate(sub.user._id, { subscriptionPlan: SUBSCRIPTION_PLAN.FREE });

      try {
        await notificationServices.createNotification({
          receiver: sub.user._id,
          title: 'Subscription Expired',
          message: `Your "${sub.plan || 'Premium'}" subscription has expired. Renew your plan to unlock all premium habits.`,
          notificationType: 'SYSTEM_ALERT',
          meta: {
            subscriptionId: sub._id.toString(),
            plan: sub.plan,
            status: 'expired',
          },
        });
        expiredCount++;
      } catch (err) {
        console.error('[SubscriptionService] Failed to send expired notification:', err);
      }
    }
  }

  return {
    remindedCount,
    expiredCount,
  };
};

export const subscriptionService = {
  sendSubscriptionPurchaseRequest,
  getMySubscription,
  getAllSubscriptions,
  updateSubscriptionStatus,
  cancelMySubscription,
  checkAndNotifyExpiringSubscriptions,
};

