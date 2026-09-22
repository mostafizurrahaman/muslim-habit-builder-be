import { Types, type PipelineStage } from 'mongoose';
import type { TGetAllNotificationQueryParamsType } from './notification.validations';
import { notificationUtils } from './notification.utils';
import { INotification } from './notification.interfaces';
import User from '../user/user.model';
import { USER_ROLE, USER_STATUS } from '../user/user.constant';
import { IUser } from '../user/user.interface';
import { Notification } from './notification.model';
import { NotFoundError } from '../../errors/request/apiError';
import moment from 'moment-timezone';
import { notificationSearchableFields } from './notification.constants';

const createNotification = async (payload: INotification) => {
  const { receiver: receiverId, sender: senderId, title, message, notificationType = 'GENERAL', meta } = payload;

  // Retrieve receiver:
  const receiverObjId = typeof receiverId === 'string' ? new Types.ObjectId(receiverId) : receiverId;
  const receiver = await User.findById(receiverObjId);
  if (!receiver) return null;

  // Retrieve sender (if provided):
  const senderObjId = senderId ? (typeof senderId === 'string' ? new Types.ObjectId(senderId) : senderId) : null;
  const sender = senderObjId ? await User.findById(senderObjId) : null;

  // Prepare notification meta:
  const notificationMeta = {
    ...(meta || {}),
    receiverId: receiver._id.toString(),
    receiverName: receiver.fullName,
    receiverProfileImg: receiver.avatar || null,
    senderId: sender ? sender._id.toString() : null,
    senderName: sender ? sender.fullName : 'System',
    senderProfileImg: sender?.avatar || null,
  };

  const result = await Notification.create({
    receiver: receiver._id,
    sender: sender ? sender._id : null,
    title,
    message,
    notificationType,
    meta: notificationMeta,
  });

  // Only dispatch push notification if user has enabled notifications in settings:
  if (receiver.hasNotification !== false) {
    await notificationUtils.sendPushNotification({
      receiver: receiver._id,
      sender: sender ? sender._id : null,
      title,
      message,
      notificationType,
      meta: notificationMeta,
    });
  }

  return result;
};

const createNotificationForAdmin = async (payload: Omit<INotification, 'receiver'>) => {
  const admins = await User.find({
    role: {
      $in: [USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN],
    },
    status: USER_STATUS.ACTIVE,
  }).select('_id');

  if (!admins?.length) return [];

  const adminNotifications = admins.map((admin) =>
    createNotification({
      ...payload,
      receiver: admin._id,
    }),
  );

  return Promise.all(adminNotifications);
};

const createNotificationForMultipleUser = async (payload: Omit<INotification, 'receiver'>, userIds: (string | Types.ObjectId)[] = []) => {
  if (!userIds?.length) return [];

  const userNotifications = userIds.map((id) =>
    createNotification({
      ...payload,
      receiver: new Types.ObjectId(id),
    }),
  );

  return Promise.all(userNotifications);
};

const markedAsRead = async (user: IUser, notificationId: string) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    receiver: user?._id,
  });

  if (!notification) {
    throw new NotFoundError('Notification not found!');
  }

  notification.isRead = true;
  await notification.save();

  return notification;
};

const markedAsReadAll = async (user: IUser) => {
  user.lastReadAt = new Date();
  await user.save();

  return {
    message: 'All notifications marked as read',
  };
};

const getAllNotification = async (user: IUser, query: TGetAllNotificationQueryParamsType) => {
  const { page: currentPage = 1, limit: currentLimit = 10, searchTerm, sortOrder = 'desc', sortBy = 'createdAt', fromDate, toDate } = query;

  const page = Number(currentPage) || 1;
  const limit = Number(currentLimit) || 10;
  const skip = (page - 1) * limit;

  const pipeline: PipelineStage[] = [
    {
      $match: {
        receiver: user?._id,
      },
    },
  ];

  if (fromDate || toDate) {
    const dateFilter: Record<string, Date> = {};

    if (fromDate) {
      dateFilter.$gte = moment(fromDate).startOf('day').toDate();
    }
    if (toDate) {
      dateFilter.$lte = moment(toDate).endOf('day').toDate();
    }

    pipeline.push({
      $match: {
        createdAt: dateFilter,
      },
    });
  }

  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'sender',
      foreignField: '_id',
      as: 'senderDetails',
    },
  });

  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'receiver',
      foreignField: '_id',
      as: 'receiverDetails',
    },
  });

  pipeline.push({
    $unwind: {
      path: '$senderDetails',
      preserveNullAndEmptyArrays: true,
    },
  });

  pipeline.push({
    $unwind: {
      path: '$receiverDetails',
      preserveNullAndEmptyArrays: true,
    },
  });

  // Calculate isRead considering both direct notification.isRead and bulk lastReadAt
  const readCondition: any = [
    { $eq: ['$isRead', true] },
  ];
  if (user?.lastReadAt) {
    readCondition.push({ $lte: ['$createdAt', user.lastReadAt] });
  }

  pipeline.push({
    $addFields: {
      isRead: {
        $cond: [{ $or: readCondition }, true, false],
      },
    },
  });

  pipeline.push({
    $project: {
      _id: 0,
      notificationId: '$_id',
      title: '$title',
      message: '$message',
      notificationType: '$notificationType',
      receiverId: '$receiver',
      receiverName: '$receiverDetails.fullName',
      receiverEmail: '$receiverDetails.email',
      receiverProfileImage: { $ifNull: ['$receiverDetails.avatar', null] },
      senderId: '$sender',
      senderName: { $ifNull: ['$senderDetails.fullName', 'System'] },
      senderEmail: { $ifNull: ['$senderDetails.email', null] },
      senderProfileImage: { $ifNull: ['$senderDetails.avatar', null] },
      isRead: '$isRead',
      meta: '$meta',
      createdAt: '$createdAt',
      updatedAt: '$updatedAt',
    },
  });

  if (searchTerm) {
    pipeline.push({
      $match: {
        $or: notificationSearchableFields.map((field) => ({
          [field]: { $regex: searchTerm, $options: 'i' },
        })),
      },
    });
  }

  pipeline.push({ $sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 } });

  pipeline.push({
    $facet: {
      data: [{ $skip: skip }, { $limit: limit }],
      meta: [{ $count: 'total' }],
    },
  });

  const aggregated = await Notification.aggregate(pipeline);

  const data = aggregated?.[0]?.data || [];
  const total = aggregated?.[0]?.meta?.[0]?.total || 0;

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const notificationServices = {
  createNotification,
  createNotificationForAdmin,
  createNotificationForMultipleUser,
  getAllNotification,
  markedAsRead,
  markedAsReadAll,
};

