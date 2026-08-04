import { Types } from 'mongoose';
import { ConnectedPrayer, HabitCategory, HabitLevel, AllowedConnectedPrayer } from '../../../interfaces';
import { Frequency, HabitType } from '../dashboard/habit-template/system.habit.constant';
import { FrequencyType, HabitLocation, TargetType, WeekDay } from './user.habit.constant';


export interface IFrequency {
  type: FrequencyType;
  selectedDays?: WeekDay[];
  everyNDays?: number;
}

export interface IReminder {
  enabled: boolean;
  time: string;
}

export interface IConnectedHabit {
  userHabit: Types.ObjectId;
  order: number;
}

export interface IUserHabit {
  user: Types.ObjectId;
  template?: Types.ObjectId | null;
  name: string;
  category: HabitCategory;
  connectedPrayer?: ConnectedPrayer;
  allowConnectedPrayers: AllowedConnectedPrayer[];
  isPrayerLocked: boolean;
  location?: HabitLocation;
  frequency: IFrequency;
  allowedFrequencies: Frequency[];
  parent: Types.ObjectId | null;
  habitType?: HabitType | null;
  level: HabitLevel;
  group: Types.ObjectId | null;
  reminder: IReminder;
  isPreBuilt: boolean;
  startDate: Date;
  showOnTodayScreen: boolean;
  targetType?: TargetType;
  infoContent: string | null;
  pdfContent: string | null;
  adhkarSet?: Types.ObjectId | null;  // ref: adhkar_sets
  quranContent?: Types.ObjectId | null;
  isLocked: boolean;
  targetDescription?: string;
  connectedHabits?: IConnectedHabit[];
  customDetails?: string | null;
  isActive: boolean;
  progressRestartedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}