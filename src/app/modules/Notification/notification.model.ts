import { Schema, model } from 'mongoose';
import type { INotificationDoc } from './notification.interfaces';
import { notificationTypeValues } from './notification.constants';

const notificationSchema = new Schema<INotificationDoc>(
  {
    receiver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    notificationType: {
      type: String,
      enum: notificationTypeValues,
      default: 'GENERAL',
    },
    isRead: {
      type: Boolean,
      required: true,
      default: false,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

notificationSchema.index({ receiver: 1, createdAt: -1 });
notificationSchema.index({ receiver: 1, isRead: 1 });

// Static method
// notificationSchema.statics.getById = async function (id: string) {
//   return this.findById(id)
// }

export const Notification = model<INotificationDoc>('Notification', notificationSchema);
