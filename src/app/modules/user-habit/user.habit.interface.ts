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
  name: string | null;
  template?: Types.ObjectId | null;
  category: HabitCategory;
  connectedPrayer?: ConnectedPrayer;
  location?: HabitLocation;
  frequency: IFrequency;
  allowedFrequencies: Frequency[];
  parent: Types.ObjectId | null;
  reminder: IReminder;
  isPreBuilt: boolean;
  startDate: Date;
  showOnTodayScreen: boolean;
  targetType?: TargetType | null;
  targetDescription?: string | null;
  connectedHabits?: IConnectedHabit[];
  customDetails?: string | null;
  isActive: boolean;
  progressRestartedAt?: Date | null;
  prayerCustomizedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}




/*

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

*/


/*

Group A — সত্যিকারের "user state" (এগুলো UserHabit-এই থাকবে, copy না, genuine user-specific data):

isActive, startDate, progressRestartedAt, showOnTodayScreen, displayOrder
connectedHabits, parent (relationship data, user-এর নিজস্ব graph)
customDetails (শুধু custom habit-এর জন্য)
reminder (user নিজে সেট করে, তাই এটা genuinely user-specific)
template (reference, অবশ্যই থাকবে)

Group B — "template content" (এগুলো আর copy করা যাবে না, request-এর সময় template থেকে populate করে আনতে হবে):

name, category, connectedPrayer, allowConnectedPrayers, isPrayerLocked, location, allowedFrequencies, habitType, targetType, targetDescription, adhkarSet, quranContent, infoContent, pdfContent, isLocked, isPrePuilt, level, group

*/


/*

CREATE TYPE color
AS
ENUM('red', 'blue', 'green');

CREATE TYPE category
AS
ENUM('Shirt', 'T-Shirt', 'Pant');

CREATE TABLE IF NOT EXISTS PRODUCT(
  product_id uuid DEFAULT gen_random_uuid() PRIMARY KEY ,
  product_title VARCHAR(100) NOT NULL,
  product_description VARCHAR(300) NOT NULL,
  product_color COLOR NOT NULL,
  category CATEGORY NOT NULL, 
  created_at DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at DATE NOT NULL DEFAULT CURRENT_DATE
)



INSERT INTO product (product_title,product_description,product_color,category)
VALUES('men tshirt','asdasd','red','Shirt');

*/