import { Schema, model } from 'mongoose';
import { IAdhkarSet } from './adhkar.set.interface';

// adhkar set schema
const adhkarItemSchema = new Schema({
    title: { type: String, required: true, trim: true },
    arabic: { type: String, required: true },
    transliteration: { type: String, required: true },
    translation: { type: String, required: true },
    virtue: { type: String, trim: true },
    reference: { type: String, trim: true },
    count: { type: Number, default: null },
    order: { type: Number, required: true },
});


const adhkarSetSchema = new Schema<IAdhkarSet>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        nameArabic: {
            type: String,
            trim: true,
        },
        totalCount: {
            type: Number,
            default: 0,
        },
        items: [adhkarItemSchema],
    },
    {
        timestamps: true,
    }
);

export const AdhkarSet = model<IAdhkarSet>('AdhkarSet', adhkarSetSchema);