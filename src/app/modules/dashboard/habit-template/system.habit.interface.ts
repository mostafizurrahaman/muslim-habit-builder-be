import { Types } from 'mongoose';
import { AllowedConnectedPrayer, ConnectedPrayer, HabitCategory, HabitLevel } from '../../../../interfaces';
import { FrequencyType, HabitLocation, WeekDay } from '../../user-habit/user.habit.constant';
import { Frequency, HabitStatus, HabitType } from './system.habit.constant';


export interface IDefaultFrequency {
  type: FrequencyType;
  selectedDays?: WeekDay[];
  everyNDays?: number;
}


 
export interface EffectiveHabitTemplateFields {
    name: string;
    group?: string | Types.ObjectId | null;
    parent?: string | Types.ObjectId | null;
    connectedPrayer?: string | null;
    level?: string;
    isGuestLocked?: boolean;
    isPrayerLocked?: boolean;
    allowConnectedPrayers?: string[];
    isConnectedObligatory?: boolean;
    isLocked?: boolean;
    category?: string;
    habitType?: string;
    quranContent?: unknown;
    adhkarSet?: unknown;
}

export interface IHabitTemplate {
  _id: Types.ObjectId;

  name: string;

  category: HabitCategory;

  connectedPrayer?: ConnectedPrayer;

  allowConnectedPrayers: AllowedConnectedPrayer[];

  isPrayerLocked: Boolean;

  habitType: HabitType;

  parent: Types.ObjectId | null;

  isParent: boolean;

  supportsLocation: HabitLocation;    

  group?: Types.ObjectId | null;
  
  isGroup: boolean;

  defaultFrequency: IDefaultFrequency;

  allowedFrequencies: Frequency[];

  level: HabitLevel;

  isConnectedObligatory: boolean;

  isPreBuilt: boolean;

  isLocked: boolean;

  isGuestLocked: boolean;

  isNew: boolean;
  
  pdfContent: string | null;

  infoContent: string | null

  adhkarSet?: Types.ObjectId | null;  

  quranContent?: Types.ObjectId | null;

  status: HabitStatus;

  isActive: boolean;
  
  prayerCustomizedAt?: Date | null;

  createdAt: Date;

  updatedAt: Date;
}

