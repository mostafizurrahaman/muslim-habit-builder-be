import { Types } from 'mongoose';

export interface SeedContext {
  adminUserId?: Types.ObjectId;
  regularUserId?: Types.ObjectId;
  adhkarSetId?: Types.ObjectId;
  quranContentId?: Types.ObjectId;
  habitTemplateId?: Types.ObjectId;
  userHabitId?: Types.ObjectId;
}

export interface SeedResult {
  collection: string;
  created: number;
  skipped: number;
}

export type SeedFn = (context: SeedContext) => Promise<SeedResult>;
