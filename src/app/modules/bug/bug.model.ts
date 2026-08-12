import { model, Schema } from "mongoose";
import { BUG_FEATURES, BUG_STATUS } from "./bug.constant";
import { IBug } from "./bug.interface";




const bugSchema = new Schema<IBug>({
    originalReporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    featureKey: {
        type: String,
        enum: Object.values(BUG_FEATURES),
        required: true
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: Object.values(BUG_STATUS), default: 'pending' },
    upvotedBy: {
        type: [Schema.Types.ObjectId],
        ref: "User",
        default: []
    },
    upvoteCount: { type: Number, default: 1 },
    bugImages: [{ type: String, default: [] }]
}, { timestamps: true, versionKey: false });

bugSchema.index({ status: 1 });

export const Bug = model<IBug>("Bug", bugSchema);