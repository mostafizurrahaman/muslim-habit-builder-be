import { Document, Types } from 'mongoose';
import type { TNotificationType } from './notification.constants';

export interface INotification {
  receiver: Types.ObjectId | string;
  sender?: Types.ObjectId | string | null;
  title: string;
  message: string;
  notificationType?: TNotificationType;
  isRead?: boolean;
  meta?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}


export interface INotificationDoc extends Document, INotification {}

// export interface INotificationModel extends Model<INotificationDoc> {
//   getById(id: string): Promise<INotification | null>
// }
