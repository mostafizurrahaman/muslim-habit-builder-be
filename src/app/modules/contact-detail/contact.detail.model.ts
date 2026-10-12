import { model, Schema } from 'mongoose';
import { IContactDetail } from './contact.detail.interface';

const contactDetailSchema = new Schema<IContactDetail>(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    whatsapp: {
      type: String,
      trim: true,
      default: null,
    },
    website: {
      type: String,
      trim: true,
      default: null,
    },
    twitter: {
      type: String,
      trim: true,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    facebook: {
      type: String,
      trim: true,
      default: null,
    },
    instagram: {
      type: String,
      trim: true,
      default: null,
    },
    linkedin: {
      type: String,
      trim: true,
      default: null,
    },
    youtube: {
      type: String,
      trim: true,
      default: null,
    },
    telegram: {
      type: String,
      trim: true,
      default: null,
    },
    tiktok: {
      type: String,
      trim: true,
      default: null,
    },
    address: {
      type: String,
      trim: true,
      default: null,
    },
    additionalInfo: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: false,
  }
);

export const ContactDetail = model<IContactDetail>(
  'ContactDetail',
  contactDetailSchema
);
