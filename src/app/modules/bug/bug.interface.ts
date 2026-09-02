import { Document, Types } from "mongoose";
import { TBug, TBugStatus } from "./bug.constant";

export type TBugImage = {
  bug_images: Express.Multer.File[];
};

export interface IBug extends Document {
  originalReporter: Types.ObjectId;
  featureKey: TBug;
  title: string;
  description: string;
  status: TBugStatus;
  upvoteCount: number;
  upvotedBy: Types.ObjectId[];
  bugImages?: string[];
  createdAt: Date;
  updatedAt: Date;
}