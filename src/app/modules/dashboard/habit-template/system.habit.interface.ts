import { Types } from 'mongoose';
import { AllowedConnectedPrayer, ConnectedPrayer, HabitCategory, HabitLevel } from '../../../../interfaces';
import { FrequencyType, HabitLocation, WeekDay } from '../../user-habit/user.habit.constant';
import { Frequency, HabitType } from './system.habit.constant';



export interface IDefaultFrequency {
  type: FrequencyType;
  selectedDays?: WeekDay[];
  everyNDays?: number;
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
  
  pdfContent: string | null;
  
  infoContent: string | null

  adhkarSet?: Types.ObjectId | null;  

  quranContent?: Types.ObjectId | null;

  isActive: boolean;
  
  createdAt: Date;

  updatedAt: Date;
}

