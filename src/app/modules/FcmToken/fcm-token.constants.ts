export const fcmTokenSearchableFields = ['name'] as const

export const deviceType = {
  ANDROID: 'android',
  IOS: 'ios',
  WEB: 'web',
} as const
export const deviceTypeValues = Object.values(deviceType)

export const fcmTokenSortableFields = ['createdAt', 'updatedAt'] as const

// Types (optional but recommended)
export type TFcmTokenSearchableField = (typeof fcmTokenSearchableFields)[number]

export type TFcmTokenSortableField = (typeof fcmTokenSortableFields)[number]

export type TFcmTokenField = (typeof deviceType)[keyof typeof deviceType]
