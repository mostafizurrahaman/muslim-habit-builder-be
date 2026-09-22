import { firebaseAdmin } from '../../../config/firebase';
import { fcmTokenServices } from '../FcmToken/fcm-token.services';
import type { BatchResponse } from 'firebase-admin/messaging';
import User from '../user/user.model';
import { INotification } from './notification.interfaces';

const sendPushNotification = async (notification: INotification) => {
  try {
    if (!firebaseAdmin.apps.length) {
      return;
    }

    const { receiver, sender, title, message, meta } = notification;

    // Check receiver settings:
    const receiverUser = await User.findById(receiver);
    if (!receiverUser || receiverUser.hasNotification === false) {
      return;
    }

    // Get FCM tokens for receiver:
    const receiverFcmTokens = await fcmTokenServices.getFcmTokensByUserId(receiver);
    if (!receiverFcmTokens || receiverFcmTokens.length === 0) return;

    // Retrieved sender (if any):
    const senderUser = sender ? await User.findById(sender) : null;

    // Sanitize data payload for Firebase (all keys and values MUST be strings):
    const sanitizedData: Record<string, string> = {
      title: String(title || ''),
      message: String(message || ''),
      notificationType: String(notification.notificationType || 'GENERAL'),
      receiverId: receiver.toString(),
      senderId: sender ? sender.toString() : '',
      userNotificationPreference: String(receiverUser.notificationType || 'vibrate'),
    };

    if (meta && typeof meta === 'object') {
      Object.entries(meta).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object') {
            sanitizedData[key] = typeof (value as any).toString === 'function' && !(value instanceof Array) && !(value.constructor === Object)
              ? (value as any).toString()
              : JSON.stringify(value);
          } else {
            sanitizedData[key] = String(value);
          }
        }
      });
    }

    const isSound = receiverUser.notificationType === 'sound';

    const notificationResponse = await firebaseAdmin.messaging().sendEachForMulticast({
      tokens: receiverFcmTokens,
      notification: {
        title,
        body: message,
        imageUrl: senderUser?.avatar || undefined,
      },
      data: sanitizedData,
      android: {
        notification: {
          sound: isSound ? 'default' : undefined,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: isSound ? 'default' : undefined,
          },
        },
      },
    });

    // Clean up invalid tokens:
    await removeInvalidTokens(notificationResponse, receiverFcmTokens);
  } catch (error) {
    console.error('[NotificationUtils] Push notification error:', error);
  }
};

// Clean up invalid tokens:
const removeInvalidTokens = async (response: BatchResponse, tokens: string[]) => {
  try {
    const invalidTokens: string[] = [];

    response.responses.forEach((res, index) => {
      if (!res.success) {
        if (
          res.error?.code === 'messaging/registration-token-not-registered' ||
          res.error?.code === 'messaging/invalid-registration-token'
        ) {
          const token = tokens[index] as string;
          invalidTokens.push(token);
        }
      }
    });

    if (invalidTokens.length > 0) {
      await fcmTokenServices.deleteFcmTokens(invalidTokens);
    }
  } catch (error) {
    console.error('[NotificationUtils] Failed to clean up invalid tokens:', error);
  }
};

export const notificationUtils = {
  sendPushNotification,
};

