import { Document } from 'mongoose';

export interface IContactDetail extends Document {
  email?: string;
  whatsapp?: string;
  website?: string;
  twitter?: string;
  phone?: string;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  telegram?: string;
  tiktok?: string;
  address?: string;
  additionalInfo?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TCreateContactDetailPayload {
  email?: string;
  whatsapp?: string;
  website?: string;
  twitter?: string;
  phone?: string;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  telegram?: string;
  tiktok?: string;
  address?: string;
  additionalInfo?: Record<string, any>;
  [key: string]: any;
}

export type TUpdateContactDetailPayload = Partial<TCreateContactDetailPayload>;
